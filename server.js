require('express-async-errors');
const express = require('express');
const stripeLib = require('stripe');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const JSZip = require('jszip');
const { jsonrepair } = require('jsonrepair');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = process.env.STRIPE_SECRET_KEY
  ? stripeLib(process.env.STRIPE_SECRET_KEY)
  : null;

const upload = multer({ dest: 'uploads/', limits: { fileSize: 2 * 1024 * 1024 } });

async function extractTextFromPPTX(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort();
  let text = '';
  for (const slide of slides) {
    const content = await zip.files[slide].async('string');
    const matches = content.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
    text += matches.map(m => m.replace(/<\/?a:t[^>]*>/g, '')).join(' ') + '\n';
  }
  return text.trim();
}

async function extractTextFromPDF(buffer) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/* ===== In-memory session store ===== */
const paidSessions = new Map();
const sharedQuizzes = new Map();
const sharedResults = new Map();

/* ===== Middleware ===== */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ===== Stripe webhook (needs raw body) ===== */
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(200).json({ received: true });
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    paidSessions.set(session.id, { paid: true, email: session.customer_details?.email, timestamp: Date.now() });
  }
  res.json({ received: true });
});

/* ===== Create Stripe Checkout Session ===== */
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.json({ url: process.env.STRIPE_PAYMENT_LINK || '/?paid=true' });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'QuikQuiz Pro', description: 'Unlimited AI quiz generation' },
          unit_amount: 900,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      success_url: `${req.headers.origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/* ===== Check payment status ===== */
app.get('/api/status', (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.json({ paid: false });

  // Check in-memory store first (webhook path)
  if (paidSessions.has(sessionId)) {
    return res.json({ paid: true });
  }

  // Fallback: verify directly with Stripe
  if (stripe && sessionId.startsWith('cs_')) {
    stripe.checkout.sessions.retrieve(sessionId)
      .then(session => {
        const paid = session.payment_status === 'paid' || session.status === 'complete';
        if (paid) paidSessions.set(sessionId, { paid: true });
        res.json({ paid });
      })
      .catch(() => res.json({ paid: false }));
  } else {
    res.json({ paid: false });
  }
});

/* ===== OpenRouter helpers ===== */
const FALLBACK_MODELS = [
  process.env.OPENROUTER_MODEL,
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free'
].filter(Boolean);

function repairJSON(text) {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  s = s.replace(/,(\s*[}\]])/g, '$1');
  s = s.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');
  return s;
}

function buildPrompt(topic, difficulty, type, num, fileContent) {
  const types = type === 'all' ? ['multiple', 'truefalse', 'dropdown'] : type.split(',').filter(Boolean);
  const typeMap = {
    multiple: 'multiple choice (4 options each)',
    truefalse: 'true/false',
    dropdown: 'dropdown/select (4+ options each)'
  };
  const typeInstruction = types.length === 1
    ? typeMap[types[0]] + ' only'
    : 'a mix of ' + types.map(t => typeMap[t] || 'multiple choice').join(' and ');

  const typeRule = types.length === 1
    ? '- ALL questions must be ' + types[0] + '. Do not include any other question types.'
    : '- Distribute question types evenly across the quiz.';

  function exampleFor(t) {
    var map = {
      multiple: JSON.stringify({ question: 'What is ...?', emoji: '🪐', type: 'multiple', options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 'Option A' }, null, 2),
      truefalse: JSON.stringify({ question: 'True or false: ...', emoji: '🌍', type: 'truefalse', options: ['True', 'False'], answer: 'True' }, null, 2),
      dropdown: JSON.stringify({ question: 'Which of the following is ...?', emoji: '📝', type: 'dropdown', options: ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'], answer: 'Option A' }, null, 2)
    };
    return map[t] || map.multiple;
  }
  var exampleQuestions = types.map(function (t) { return exampleFor(t); }).join(',\n');
  var exampleJSON = '{\n  "questions": [\n' + exampleQuestions + '\n  ]\n}';

  let userPrompt;
  if (fileContent) {
    userPrompt = `Generate a ${difficulty.toLowerCase()} difficulty quiz about "${topic}" based on the following material. Create ${num} ${typeInstruction}.

Use the material below to create accurate and relevant questions:
--- MATERIAL START ---
${fileContent.slice(0, 15000)}
--- MATERIAL END ---

Return JSON in this exact format (no markdown, no code fences):
${exampleJSON}

Rules:
${typeRule}
- For multiple choice, always provide exactly 4 options.
- For true/false, options must be ["True", "False"].
- For dropdown, provide at least 4 options.
- The answer must be one of the options, spelled exactly as it appears in the options array.
- For each question include an "emoji" field with a single relevant emoji character.
- Make sure the questions are accurate and appropriate for ${difficulty.toLowerCase()} difficulty.`;
  } else {
    userPrompt = `Generate a ${difficulty.toLowerCase()} difficulty quiz about "${topic}". Create ${num} ${typeInstruction}.

Return JSON in this exact format (no markdown, no code fences):
${exampleJSON}

Rules:
${typeRule}
- For multiple choice, always provide exactly 4 options.
- For true/false, options must be ["True", "False"].
- For dropdown, provide at least 4 options.
- The answer must be one of the options, spelled exactly as it appears in the options array.
- For each question include an "emoji" field with a single relevant emoji character.
- Make sure the questions are accurate and appropriate for ${difficulty.toLowerCase()} difficulty.`;
  }

  return {
    system: 'You are a quiz generator. Return ONLY valid JSON. No markdown, no other text.',
    user: userPrompt
  };
}

async function callModel(model, prompt, origin, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
          'HTTP-Referer': origin || 'http://localhost:3000',
          'X-Title': 'QuikQuiz',
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('empty response');

        console.log('Raw response from', model, ':', content.slice(0, 500));
        const cleaned = jsonrepair(content);
        const parsed = JSON.parse(cleaned);
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions;
        }
        throw new Error('invalid quiz format');
      }

      const status = response.status;
      const body = await response.text();

      if (status === 400) {
        throw Object.assign(new Error(body.slice(0, 200)), { code: 400, fatal: true });
      }
      if (status === 429 || status >= 500) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw new Error(`Service busy (${status})`);
      }
      throw new Error(`API error (${status}): ${body.slice(0, 200)}`);
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw new Error('Request timed out');
      }
      if (err.fatal) throw err;
      if (attempt >= retries) throw err;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

async function callGroq(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('empty response');

        console.log('Raw response from groq/llama-3.3-70b-versatile:', content.slice(0, 500));
        const cleaned = jsonrepair(content);
        const parsed = JSON.parse(cleaned);
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions;
        }
        throw new Error('invalid quiz format');
      }

      const status = response.status;
      const body = await response.text();

      if (status === 401 || status === 403) {
        throw Object.assign(new Error(body.slice(0, 200)), { code: status, fatal: true });
      }
      if (status === 429 || status >= 500) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw new Error('Service busy (' + status + ')');
      }
      throw new Error('API error (' + status + '): ' + body.slice(0, 200));
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw new Error('Request timed out');
      }
      if (err.fatal) throw err;
      if (attempt >= retries) throw err;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

/* ===== Generate quiz (OpenRouter proxy with fallbacks) ===== */
app.post('/api/generate', async (req, res) => {
  const { topic, difficulty, type, num } = req.body;

  if (!topic || !difficulty || !type || !num) {
    return res.status(400).json({ error: 'Missing required fields: topic, difficulty, type, num' });
  }

  if (!process.env.OPENROUTER_KEY && !process.env.GROQ_KEY) {
    return res.status(500).json({ error: 'No AI API key configured on server' });
  }

  const prompt = buildPrompt(topic, difficulty, type, num);
  const origin = req.headers.origin || 'http://localhost:3000';

  const errors = [];

  for (const model of FALLBACK_MODELS) {
    try {
      const questions = await callModel(model, prompt, origin);
      return res.json({ questions });
    } catch (err) {
      errors.push({ model, error: err.message });
      if (err.fatal) break;
    }
  }

  // Try Groq as independent fallback
  if (process.env.GROQ_KEY) {
    try {
      const questions = await callGroq(prompt);
      return res.json({ questions });
    } catch (err) {
      errors.push({ model: 'groq/llama-3.3-70b-versatile', error: err.message });
    }
  }

  console.error('All models failed:', errors);
  res.status(503).json({
    error: 'All AI models are currently busy or unavailable. Please try again in a moment.',
    details: errors
  });
});

/* ===== Generate from uploaded file ===== */
app.post('/api/generate-from-file', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'Upload error: ' + err.message });
    next();
  });
}, async (req, res) => {
  const { topic, difficulty, type, num } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  if (!difficulty || !type || !num) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!process.env.OPENROUTER_KEY && !process.env.GROQ_KEY) {
    fs.unlinkSync(file.path);
    return res.status(500).json({ error: 'No AI API key configured on server' });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf' && ext !== '.pptx') {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Only PDF and PPTX files are supported' });
  }

  let extractedText;
  try {
    const buffer = fs.readFileSync(file.path);
    extractedText = ext === '.pdf'
      ? await extractTextFromPDF(buffer)
      : await extractTextFromPPTX(buffer);
  } catch (err) {
    fs.unlinkSync(file.path);
    return res.status(500).json({ error: 'Failed to extract text from file: ' + err.message });
  }

  fs.unlinkSync(file.path);

  if (!extractedText || extractedText.length < 20) {
    return res.status(400).json({ error: 'Could not extract enough text from the file. It may be empty or image-only.' });
  }

  const resolvedTopic = topic || file.originalname.replace(/\.(pdf|pptx)$/i, '');
  const prompt = buildPrompt(resolvedTopic, difficulty, type, num, extractedText);
  const origin = req.headers.origin || 'http://localhost:3000';
  const errors = [];

  for (const model of FALLBACK_MODELS) {
    try {
      const questions = await callModel(model, prompt, origin);
      return res.json({ questions });
    } catch (err) {
      errors.push({ model, error: err.message });
      if (err.fatal) break;
    }
  }

  if (process.env.GROQ_KEY) {
    try {
      const questions = await callGroq(prompt);
      return res.json({ questions });
    } catch (err) {
      errors.push({ model: 'groq/llama-3.3-70b-versatile', error: err.message });
    }
  }

  console.error('All models failed for file:', errors);
  res.status(503).json({
    error: 'All AI models are currently busy or unavailable. Please try again in a moment.',
    details: errors
  });
});

/* ===== AI Topic Suggestions ===== */
app.post('/api/suggest-topics', async (req, res) => {
  const { subject, grade, topic } = req.body;
  if (!process.env.OPENROUTER_KEY && !process.env.GROQ_KEY) {
    return res.status(200).json({ topics: [] });
  }

  const ctx = subject && grade ? ' about ' + subject + ' for grade ' + grade : '';
  const hint = topic ? ' related to "' + topic + '"' : '';
  const prompt = {
    system: 'You are a topic suggestion engine. Return ONLY a JSON array of strings. No markdown, no other text.',
    user: 'Suggest 8 engaging quiz topics' + ctx + hint + '. Return as JSON array: ["Topic 1", "Topic 2", ...]'
  };

  const origin = req.headers.origin || 'http://localhost:3000';
  const errors = [];

  async function fetchTopics(model, groq) {
    var url = groq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    var headers = groq
      ? { 'Authorization': 'Bearer ' + process.env.GROQ_KEY, 'Content-Type': 'application/json' }
      : { 'Authorization': 'Bearer ' + process.env.OPENROUTER_KEY, 'HTTP-Referer': origin, 'X-Title': 'QuikQuiz', 'Content-Type': 'application/json' };
    var body = {
      model: groq ? 'llama-3.3-70b-versatile' : model,
      messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      temperature: 0.7, max_tokens: 2000
    };
    for (var a = 0; a <= 2; a++) {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, 15000);
      try {
        var resp = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal });
        clearTimeout(t);
        if (resp.ok) {
          var data = await resp.json();
          var content = data.choices?.[0]?.message?.content;
          if (!content) throw new Error('empty');
          var cleaned = jsonrepair(content);
          var parsed = JSON.parse(cleaned);
          var arr = Array.isArray(parsed) ? parsed : (parsed.topics || parsed.questions || []);
          if (Array.isArray(arr) && arr.length > 0) return arr.slice(0, 8);
          throw new Error('no topics');
        }
        var status = resp.status;
        var text = await resp.text();
        if (status === 429 || status >= 500) { if (a < 2) { await new Promise(function (r) { setTimeout(r, 1500); }); continue; } throw new Error('busy ' + status); }
        if (status === 401 || status === 403) throw Object.assign(new Error(text.slice(0, 200)), { fatal: true });
        throw new Error('API error ' + status + ': ' + text.slice(0, 200));
      } catch (e) {
        clearTimeout(t);
        if (e.name === 'AbortError') { if (a < 2) { await new Promise(function (r) { setTimeout(r, 1500); }); continue; } throw new Error('timeout'); }
        if (e.fatal) throw e;
        if (a >= 2) throw e;
        await new Promise(function (r) { setTimeout(r, 1500); });
      }
    }
  }

  for (var i = 0; i < FALLBACK_MODELS.length; i++) {
    try {
      var topics = await fetchTopics(FALLBACK_MODELS[i], false);
      return res.json({ topics: topics });
    } catch (err) {
      errors.push({ model: FALLBACK_MODELS[i], error: err.message });
    }
  }

  if (process.env.GROQ_KEY) {
    try {
      var topics = await fetchTopics(null, true);
      return res.json({ topics: topics });
    } catch (err) {
      errors.push({ model: 'groq/llama-3.3-70b-versatile', error: err.message });
    }
  }

  res.json({ topics: [] });
});

/* ===== Public config for frontend ===== */
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripePaymentLink: process.env.STRIPE_PAYMENT_LINK || ''
  });
});

/* ===== Save a quiz for sharing ===== */
app.post('/api/quiz/save', (req, res) => {
  const { questions, topic, difficulty, showScore, format, title, subject } = req.body;
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Invalid quiz data' });
  }
  const id = crypto.randomBytes(6).toString('hex');
  sharedQuizzes.set(id, {
    questions,
    topic: topic || 'Untitled Quiz',
    difficulty: difficulty || 'Easy',
    showScore: showScore !== false,
    timerSeconds: parseInt(req.body.timerSeconds) || 0,
    format: format === 'slide' ? 'slide' : 'form',
    title: title || '',
    subject: subject || '',
    createdAt: Date.now()
  });
  res.json({ id, url: `/quiz/${id}` });
});

/* ===== Get a shared quiz ===== */
app.get('/api/quiz/:id', (req, res) => {
  const quiz = sharedQuizzes.get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found or link expired.' });
  res.json(quiz);
});

/* ===== Update a shared quiz (showScore, timer, format) ===== */
app.put('/api/quiz/:id', (req, res) => {
  const quiz = sharedQuizzes.get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  if (req.body.showScore !== undefined) quiz.showScore = req.body.showScore !== false;
  if (req.body.timerSeconds !== undefined) quiz.timerSeconds = parseInt(req.body.timerSeconds) || 0;
  if (req.body.format !== undefined) quiz.format = req.body.format === 'slide' ? 'slide' : 'form';
  if (req.body.title !== undefined) quiz.title = req.body.title;
  if (req.body.subject !== undefined) quiz.subject = req.body.subject;
  res.json({ id: req.params.id, updated: true });
});

/* ===== Student quiz submission ===== */
app.post('/api/quiz/:id/submit', (req, res) => {
  const quiz = sharedQuizzes.get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

  const { answers, correct, total, percentage } = req.body;
  if (total == null || correct == null) {
    return res.status(400).json({ error: 'Missing submission data.' });
  }

  const results = sharedResults.get(req.params.id) || [];
  results.push({
    answers: answers || {},
    correct,
    total,
    percentage: percentage || Math.round((correct / total) * 100),
    submittedAt: Date.now()
  });
  sharedResults.set(req.params.id, results);

  res.json({ received: true });
});

/* ===== Get quiz results (teacher) ===== */
app.get('/api/quiz/:id/results', (req, res) => {
  const results = sharedResults.get(req.params.id) || [];
  const quiz = sharedQuizzes.get(req.params.id);
  res.json({ results, totalQuestions: quiz?.questions?.length || 0 });
});

/* ===== Serve student quiz page ===== */
app.get('/quiz/:id', (req, res) => {
  if (!sharedQuizzes.has(req.params.id)) {
    return res.status(404).send('<h1>Quiz not found</h1><p>This link may have expired.</p>');
  }
  res.sendFile(path.join(__dirname, 'student.html'));
});

/* ===== API error handler ===== */
app.use('/api/', (err, req, res, next) => {
  console.error('API error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ===== Serve static files ===== */
app.use(express.static(path.join(__dirname)));

/* ===== SPA fallback ===== */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ===== Start ===== */
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}
app.listen(PORT, () => {
  console.log(`QuikQuiz running at http://localhost:${PORT}`);
  if (!process.env.OPENROUTER_KEY) console.warn('WARNING: OPENROUTER_KEY not set in .env');
  if (!process.env.STRIPE_SECRET_KEY) console.warn('WARNING: Stripe keys not set — payments disabled');
  if (!process.env.GOOGLE_CLIENT_ID) console.warn('WARNING: GOOGLE_CLIENT_ID not set — Google sign-in disabled');
});
