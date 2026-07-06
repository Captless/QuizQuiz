require('express-async-errors');
const express = require('express');
const stripeLib = require('stripe');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { jsonrepair } = require('jsonrepair');
const { extractTextFromPDF } = require('./utils/pdf');
const { extractTextFromPPTX } = require('./utils/pptx');
const { validateGenerateBody, validateQuizSaveBody } = require('./utils/validate');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/* ===== Supabase availability check ===== */
const SUPABASE_ENABLED = process.env.SUPABASE_ENABLED !== 'false' && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const useLocalFallback = process.env.USE_LOCAL_FALLBACK === 'true';
let getFallbackUsage, incFallbackUsage, setFallbackPaid;
let getFallbackQuizzes, addFallbackQuiz, deleteFallbackQuiz;
if (useLocalFallback) {
  const fb = require('./utils/usageStore');
  getFallbackUsage = fb.getUsage;
  incFallbackUsage = fb.incUsage;
  setFallbackPaid = fb.setPaid;
  const qs = require('./utils/quizzesStore');
  getFallbackQuizzes = qs.getUserQuizzes;
  addFallbackQuiz = qs.addQuiz;
  deleteFallbackQuiz = qs.deleteQuiz;
}

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = process.env.STRIPE_SECRET_KEY
  ? stripeLib(process.env.STRIPE_SECRET_KEY)
  : null;

const upload = multer({ dest: path.join(__dirname, '..', 'uploads'), limits: { fileSize: 2 * 1024 * 1024 } });

/* ===== In-memory session store (fallback when Supabase is not configured) ===== */
const paidSessions = new Map();
const sharedQuizzes = new Map();
const sharedResults = new Map();

/* ===== Middleware ===== */
const corsOrigin = process.env.CORS_ORIGIN || undefined;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.set('trust proxy', 1);

/* ===== Rate Limiting ===== */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.UPSTREAM_RATE_LIMIT) || 100,
  message: { error: 'Too many requests — please slow down.' }
});
app.use('/api/generate', apiLimiter);
app.use('/api/generate-from-file', apiLimiter);
app.use('/api/suggest-topics', apiLimiter);
app.use('/api/quiz/save', apiLimiter);

/* ===== Stripe webhook ===== */
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
    // If user is logged in, update their subscription in Supabase
    if (session.metadata?.user_id && supabaseAdmin) {
      setSubscription(session.metadata.user_id, 'active', session.customer);
    }
  }
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    if (subscription.metadata?.user_id && supabaseAdmin) {
      setSubscription(subscription.metadata.user_id, 'inactive');
    }
  }
  res.json({ received: true });
});

/* ===== Create Stripe Checkout Session ===== */
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.json({ url: process.env.STRIPE_PAYMENT_LINK || '/?paid=true' });
  }
  try {
    const user = await getUserFromToken(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'QuikQuiz Pro', description: 'Unlimited AI quiz generation' },
          unit_amount: 699,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      metadata: user ? { user_id: user.id } : {},
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

  if (paidSessions.has(sessionId)) {
    return res.json({ paid: true });
  }

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

function buildPrompt(topic, difficulty, type, num, fileContent, gradeLevel) {
  const types = type === 'all' ? ['multiple', 'truefalse', 'dropdown'] : type.split(',').filter(Boolean);
  const gradeContext = gradeLevel ? ` for grade ${gradeLevel} students` : '';
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
      multiple: JSON.stringify({ question: 'What is ...?', emoji: '🪐', type: 'multiple', options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 'Option A', explanation: 'Option A is correct because...' }, null, 2),
      truefalse: JSON.stringify({ question: 'True or false: ...', emoji: '🌍', type: 'truefalse', options: ['True', 'False'], answer: 'True', explanation: 'This statement is true because...' }, null, 2),
      dropdown: JSON.stringify({ question: 'Which of the following is ...?', emoji: '📝', type: 'dropdown', options: ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'], answer: 'Option A', explanation: 'Option A is the best answer because...' }, null, 2),

    };
    return map[t] || map.multiple;
  }
  var exampleQuestions = types.map(function (t) { return exampleFor(t); }).join(',\n');
  var exampleJSON = '{\n  "questions": [\n' + exampleQuestions + '\n  ]\n}';

  let userPrompt;
  if (fileContent) {
    userPrompt = `Generate a ${difficulty.toLowerCase()} difficulty quiz${gradeContext} about "${topic}" based on the following material. Create ${num} ${typeInstruction}.

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
- For each question include an "explanation" field with a 1-2 sentence explanation of the correct answer, suitable for a student's learning.
- Make sure the questions are accurate and appropriate for ${difficulty.toLowerCase()} difficulty.`;
  } else {
    userPrompt = `Generate a ${difficulty.toLowerCase()} difficulty quiz${gradeContext} about "${topic}". Create ${num} ${typeInstruction}.

Return JSON in this exact format (no markdown, no code fences):
${exampleJSON}

Rules:
${typeRule}
- For multiple choice, always provide exactly 4 options.
- For true/false, options must be ["True", "False"].
- For dropdown, provide at least 4 options.
- The answer must be one of the options, spelled exactly as it appears in the options array.
- For each question include an "emoji" field with a single relevant emoji character.
- For each question include an "explanation" field with a 1-2 sentence explanation of the correct answer, suitable for a student's learning.
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
app.post('/api/generate', requireUser, validateGenerateBody, async (req, res) => {
  const { topic, difficulty, type, num, gradeLevel } = req.body;

  // Server-side quota enforcement
  const profile = await getProfile(req.user.id, req.user.email);
  const isPaid = profile?.subscription_status === 'active';
  if (!isPaid && (profile?.usage_count || 0) >= 3) {
    return res.status(403).json({ error: 'Free limit reached. Upgrade to Pro to generate more quizzes.', needsUpgrade: true, usageCount: profile?.usage_count || 0 });
  }

  if (!process.env.OPENROUTER_KEY && !process.env.GROQ_KEY) {
    return res.status(500).json({ error: 'No AI API key configured on server' });
  }

  const prompt = buildPrompt(topic, difficulty, type, num, null, gradeLevel);
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

  console.error('All models failed:', errors);
  res.status(503).json({
    error: 'All AI models are currently busy or unavailable. Please try again in a moment.',
    details: errors
  });
});

/* ===== Generate from uploaded file ===== */
app.post('/api/generate-from-file', requireUser, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'Upload error: ' + err.message });
    next();
  });
}, validateGenerateBody, async (req, res) => {
  const { topic, difficulty, type, num, gradeLevel } = req.body;
  const file = req.file;

  // Server-side quota enforcement
  const profile = await getProfile(req.user.id, req.user.email);
  const isPaid = profile?.subscription_status === 'active';
  if (!isPaid && (profile?.usage_count || 0) >= 3) {
    if (file) fs.unlinkSync(file.path);
    return res.status(403).json({ error: 'Free limit reached. Upgrade to Pro to generate more quizzes.', needsUpgrade: true, usageCount: profile?.usage_count || 0 });
  }
  if (!isPaid) {
    if (file) fs.unlinkSync(file.path);
    return res.status(403).json({ error: 'File upload requires Pro.', needsUpgrade: true });
  }

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
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
    return res.status(400).json({ error: 'Failed to extract text from file: ' + err.message });
  }

  fs.unlinkSync(file.path);

  if (!extractedText || extractedText.length < 20) {
    return res.status(400).json({ error: 'Could not extract enough text from the file. It may be empty or image-only.' });
  }

  const resolvedTopic = topic || file.originalname.replace(/\.(pdf|pptx)$/i, '');
  const prompt = buildPrompt(resolvedTopic, difficulty, type, num, extractedText, gradeLevel);
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

/* ===== Demo quiz (no auth required) ===== */
const DEMO_QUESTIONS = [
  { question: 'What is the capital of France?', type: 'multiple', options: ['Paris', 'Berlin', 'Madrid', 'Rome'], answer: 'Paris' },
  { question: 'Water freezes at 0°C.', type: 'truefalse', options: ['True', 'False'], answer: 'True' },
  { question: 'Which planet is known as the Red Planet?', type: 'multiple', options: ['Mars', 'Venus', 'Jupiter', 'Saturn'], answer: 'Mars' },
  { question: 'Select the chemical symbol for gold.', type: 'dropdown', options: ['Au', 'Ag', 'Fe', 'Cu', 'Zn'], answer: 'Au' },
  { question: 'The Great Wall of China is visible from space.', type: 'truefalse', options: ['True', 'False'], answer: 'False' },
  { question: 'What is the largest ocean on Earth?', type: 'multiple', options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], answer: 'Pacific' },
  { question: 'Which gas do plants absorb during photosynthesis?', type: 'dropdown', options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen', 'Methane'], answer: 'Carbon dioxide' },
  { question: 'Mount Everest is located in the Himalayas.', type: 'truefalse', options: ['True', 'False'], answer: 'True' },
  { question: 'What element has the atomic number 1?', type: 'multiple', options: ['Hydrogen', 'Helium', 'Lithium', 'Carbon'], answer: 'Hydrogen' },
  { question: 'Select the longest river in the world.', type: 'dropdown', options: ['Nile', 'Amazon', 'Yangtze', 'Mississippi', 'Danube'], answer: 'Nile' },
  { question: 'Light travels faster than sound.', type: 'truefalse', options: ['True', 'False'], answer: 'True' },
  { question: 'What year did World War II end?', type: 'multiple', options: ['1945', '1944', '1946', '1943'], answer: '1945' },
  { question: 'Which organ pumps blood in the human body?', type: 'dropdown', options: ['Heart', 'Lungs', 'Liver', 'Kidney', 'Brain'], answer: 'Heart' },
  { question: 'The Earth is flat.', type: 'truefalse', options: ['True', 'False'], answer: 'False' },
  { question: 'Who wrote "Romeo and Juliet"?', type: 'multiple', options: ['Shakespeare', 'Dickens', 'Austen', 'Hemingway'], answer: 'Shakespeare' },
  { question: 'What is the speed of light approximately?', type: 'dropdown', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '100,000 km/s', '1,000,000 km/s'], answer: '300,000 km/s' },
  { question: 'Humans have 23 pairs of chromosomes.', type: 'truefalse', options: ['True', 'False'], answer: 'True' },
  { question: 'Which country has the largest population?', type: 'multiple', options: ['India', 'China', 'USA', 'Indonesia'], answer: 'India' },
  { question: 'What is the smallest prime number?', type: 'dropdown', options: ['2', '1', '3', '5', '7'], answer: '2' },
  { question: 'Octopuses have three hearts.', type: 'truefalse', options: ['True', 'False'], answer: 'True' },
];

app.get('/api/quiz/demo', (req, res) => {
  var num = Math.min(10, Math.max(1, parseInt(req.query.num) || 5));
  var format = req.query.format === 'slide' ? 'slide' : 'form';

  var shuffled = DEMO_QUESTIONS.slice().sort(function () { return Math.random() - 0.5; });
  var selected = shuffled.slice(0, num);

  res.json({
    title: 'Demo Quiz',
    subject: 'General Knowledge',
    topic: 'Demo',
    format: format,
    questions: selected
  });
});

/* ===== Save a quiz for sharing ===== */
app.post('/api/quiz/save', requireUser, validateQuizSaveBody, async (req, res) => {
  const { questions, topic, difficulty, showScore, format, title, subject, learningMode } = req.body;
  const id = crypto.randomBytes(6).toString('hex');
  const data = {
    questions,
    topic: topic || 'Untitled Quiz',
    difficulty: difficulty || 'Easy',
    showScore: showScore !== false,
    timerSeconds: parseInt(req.body.timerSeconds) || 0,
    format: format === 'slide' ? 'slide' : 'form',
    title: title || '',
    subject: subject || '',
    learningMode: !!learningMode
  };
  await saveQuiz(id, data);
  res.json({ id, url: `/quiz/${id}` });
});

/* ===== Get a shared quiz ===== */
app.get('/api/quiz/:id', async (req, res) => {
  const quiz = await getQuiz(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found or link expired.' });
  res.json(quiz);
});

/* ===== Update a shared quiz ===== */
app.put('/api/quiz/:id', requireUser, async (req, res) => {
  const quiz = await getQuiz(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  const updates = {};
  if (req.body.showScore !== undefined) updates.show_score = req.body.showScore !== false;
  if (req.body.timerSeconds !== undefined) updates.timer_seconds = parseInt(req.body.timerSeconds) || 0;
  if (req.body.format !== undefined) updates.format = req.body.format === 'slide' ? 'slide' : 'form';
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.subject !== undefined) updates.subject = req.body.subject;
  await updateQuiz(req.params.id, updates);
  res.json({ id: req.params.id, updated: true });
});

/* ===== Student quiz submission ===== */
app.post('/api/quiz/:id/submit', async (req, res) => {
  const quiz = await getQuiz(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

  const { answers, correct, total, percentage } = req.body;
  if (total == null || correct == null) {
    return res.status(400).json({ error: 'Missing submission data.' });
  }

  await saveResult(req.params.id, {
    answers: answers || {},
    correct,
    total,
    percentage: percentage || Math.round((correct / total) * 100)
  });

  res.json({ received: true });
});

/* ===== Get quiz results (teacher) ===== */
app.get('/api/quiz/:id/results', requireUser, async (req, res) => {
  const results = await getResults(req.params.id);
  const quiz = await getQuiz(req.params.id);
  res.json({ results, totalQuestions: quiz?.questions?.length || 0 });
});

/* ===== Adaptive Difficulty Generation ===== */
app.post('/api/generate/adaptive', validateGenerateBody, async (req, res) => {
  const { topic, difficulty, type, num, gradeLevel, previousResults } = req.body;

  if (!process.env.OPENROUTER_KEY && !process.env.GROQ_KEY) {
    return res.status(500).json({ error: 'No AI API key configured on server' });
  }

  // Build adaptive context from previous results
  let adaptiveContext = '';
  if (previousResults && Array.isArray(previousResults) && previousResults.length > 0) {
    const recent = previousResults.slice(-5);
    const correct = recent.filter(r => r.correct).length;
    const total = recent.length;
    const pct = Math.round((correct / total) * 100);

    let trend = 'stable';
    const lastTwo = recent.slice(-2);
    if (lastTwo.length === 2 && lastTwo.every(r => r.correct)) trend = 'improving';
    else if (lastTwo.length === 2 && lastTwo.every(r => !r.correct)) trend = 'struggling';

    let adjustedDifficulty = difficulty;
    if (trend === 'improving') adjustedDifficulty = difficulty === 'Easy' ? 'Medium' : difficulty === 'Medium' ? 'Hard' : 'Hard';
    else if (trend === 'struggling') adjustedDifficulty = difficulty === 'Hard' ? 'Medium' : difficulty === 'Medium' ? 'Easy' : 'Easy';

    adaptiveContext = `The student answered ${correct}/${total} correctly (${pct}%) in recent questions. Their performance trend is "${trend}". Adjust question difficulty to "${adjustedDifficulty}" overall, mixing in some slightly easier or harder questions as appropriate.`;
  }

  const prompt = buildPrompt(topic, difficulty, type, num, null, gradeLevel);
  // Append adaptive context to the user prompt
  prompt.user += `\n\nAdaptive context: ${adaptiveContext || 'No previous results — use standard difficulty.'}`;

  const origin = req.headers.origin || 'http://localhost:3000';
  const errors = [];

  for (const model of FALLBACK_MODELS) {
    try {
      const questions = await callModel(model, prompt, origin);
      return res.json({ questions, adaptive: true });
    } catch (err) {
      errors.push({ model, error: err.message });
      if (err.fatal) break;
    }
  }

  if (process.env.GROQ_KEY) {
    try {
      const questions = await callGroq(prompt);
      return res.json({ questions, adaptive: true });
    } catch (err) {
      errors.push({ model: 'groq/llama-3.3-70b-versatile', error: err.message });
    }
  }

  console.error('All models failed (adaptive):', errors);
  res.status(503).json({ error: 'All AI models are currently busy.', details: errors });
});

/* ===== Performance Insights (Paid) ===== */
app.get('/api/insights/summary', requireUser, async (req, res) => {
  if (!SUPABASE_ENABLED && !useLocalFallback) {
    return res.status(503).json({ error: 'Service offline' });
  }

  // Get profile for subscription check
  const profile = await getProfile(req.user.id, req.user.email);
  if (!profile || profile.subscription_status !== 'active') {
    return res.status(403).json({ error: 'Subscription required' });
  }

  try {
    // Get user quizzes
    const quizzes = await getUserQuizzes(req.user.id);
    const quizIds = quizzes.map(q => q.id);

    let totalQuizzes = quizIds.length;
    let totalSubmissions = 0;
    let totalCorrect = 0;
    let totalQuestions = 0;
    const topicAccuracy = {};

    for (const quizId of quizIds) {
      const results = await getResults(quizId);
      totalSubmissions += results.length;
      for (const r of results) {
        totalCorrect += r.correct || 0;
        totalQuestions += r.total || 0;
      }
      const quiz = await getQuiz(quizId);
      if (quiz && quiz.topic) {
        const resultsForTopic = await getResults(quizId);
        const topicCorrect = resultsForTopic.reduce((s, r) => s + (r.correct || 0), 0);
        const topicTotal = resultsForTopic.reduce((s, r) => s + (r.total || 0), 0);
        if (!topicAccuracy[quiz.topic]) topicAccuracy[quiz.topic] = { correct: 0, total: 0 };
        topicAccuracy[quiz.topic].correct += topicCorrect;
        topicAccuracy[quiz.topic].total += topicTotal;
      }
    }

    const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const weakTopics = Object.entries(topicAccuracy)
      .filter(([, v]) => v.total > 0)
      .map(([topic, v]) => ({
        topic,
        accuracy: Math.round((v.correct / v.total) * 100),
        totalQuestions: v.total
      }))
      .filter(t => t.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy);

    res.json({
      totalQuizzes,
      totalSubmissions,
      overallAccuracy,
      weakTopics,
      topicCount: Object.keys(topicAccuracy).length
    });
  } catch (err) {
    console.error('Insights summary error:', err);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

app.get('/api/insights/weak-topics', requireUser, async (req, res) => {
  if (!SUPABASE_ENABLED && !useLocalFallback) {
    return res.status(503).json({ error: 'Service offline' });
  }

  const profile = await getProfile(req.user.id, req.user.email);
  if (!profile || profile.subscription_status !== 'active') {
    return res.status(403).json({ error: 'Subscription required' });
  }

  try {
    const quizzes = await getUserQuizzes(req.user.id);
    const topicAccuracy = {};

    for (const quiz of quizzes) {
      const results = await getResults(quiz.id);
      if (results.length === 0) continue;
      const topic = quiz.topic || 'Untitled';
      if (!topicAccuracy[topic]) topicAccuracy[topic] = { correct: 0, total: 0, quizzes: [] };
      topicAccuracy[topic].quizzes.push(quiz.title || quiz.id);
      for (const r of results) {
        topicAccuracy[topic].correct += r.correct || 0;
        topicAccuracy[topic].total += r.total || 0;
      }
    }

    const weakTopics = Object.entries(topicAccuracy)
      .filter(([, v]) => v.total > 0)
      .map(([topic, v]) => ({
        topic,
        accuracy: Math.round((v.correct / v.total) * 100),
        totalQuestions: v.total,
        quizzes: v.quizzes
      }))
      .filter(t => t.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy);

    res.json({ weakTopics });
  } catch (err) {
    console.error('Weak topics error:', err);
    res.status(500).json({ error: 'Failed to analyze weak topics' });
  }
});

app.post('/api/insights/recommendations', requireUser, async (req, res) => {
  if (!SUPABASE_ENABLED && !useLocalFallback) {
    return res.status(503).json({ error: 'Service offline' });
  }

  const profile = await getProfile(req.user.id, req.user.email);
  if (!profile || profile.subscription_status !== 'active') {
    return res.status(403).json({ error: 'Subscription required' });
  }

  const { weakTopics } = req.body;
  if (!weakTopics || !Array.isArray(weakTopics) || weakTopics.length === 0) {
    return res.json({ recommendations: ['Keep up the great work! No weak areas detected.'] });
  }

  if (!process.env.OPENROUTER_KEY && !process.env.GROQ_KEY) {
    const fallbackRecs = weakTopics.map(t => `Review "${t.topic}" — consider practicing with additional quizzes on this subject.`);
    return res.json({ recommendations: fallbackRecs });
  }

  const topicList = weakTopics.map(t => `${t.topic} (${t.accuracy}% accuracy)`).join(', ');
  const prompt = {
    system: 'You are an educational advisor. Return ONLY a JSON array of recommendation strings. No markdown, no other text.',
    user: `Based on these weak areas: ${topicList}, suggest 3 specific review topics or study strategies for the student. Return as JSON array: ["Recommendation 1", "Recommendation 2", "Recommendation 3"]`
  };

  const origin = req.headers.origin || 'http://localhost:3000';
  const errors = [];

  async function fetchRecs(model, groq) {
    var url = groq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    var headers = groq
      ? { 'Authorization': 'Bearer ' + process.env.GROQ_KEY, 'Content-Type': 'application/json' }
      : { 'Authorization': 'Bearer ' + process.env.OPENROUTER_KEY, 'HTTP-Referer': origin, 'X-Title': 'QuikQuiz', 'Content-Type': 'application/json' };
    var body = {
      model: groq ? 'llama-3.3-70b-versatile' : (FALLBACK_MODELS[0] || 'qwen/qwen3-coder:free'),
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
          var arr = Array.isArray(parsed) ? parsed : (parsed.recommendations || parsed.topics || []);
          if (Array.isArray(arr) && arr.length > 0) return arr.slice(0, 5);
          throw new Error('no recs');
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
      var recs = await fetchRecs(FALLBACK_MODELS[i], false);
      return res.json({ recommendations: recs });
    } catch (err) { errors.push({ model: FALLBACK_MODELS[i], error: err.message }); }
  }

  if (process.env.GROQ_KEY) {
    try {
      var recs = await fetchRecs(null, true);
      return res.json({ recommendations: recs });
    } catch (err) { errors.push({ model: 'groq', error: err.message }); }
  }

  const fallbackRecs = weakTopics.map(t => `Review "${t.topic}" — consider practicing with additional quizzes on this subject.`);
  res.json({ recommendations: fallbackRecs });
});

/* ===== Template Packs ===== */
const TEMPLATES = [
  { id: 'math-g3-multiplication', title: 'Grade 3 Math — Multiplication', subject: 'math', grade: '3-5', difficulty: 'Easy', num: 10, type: 'all' },
  { id: 'science-g5-solar', title: 'Grade 5 Science — Solar System', subject: 'science', grade: '3-5', difficulty: 'Medium', num: 10, type: 'all' },
  { id: 'history-g6-egypt', title: 'Grade 6 History — Ancient Egypt', subject: 'history', grade: '6-8', difficulty: 'Medium', num: 10, type: 'all' },
  { id: 'english-g4-grammar', title: 'Grade 4 English — Grammar Basics', subject: 'english', grade: '3-5', difficulty: 'Easy', num: 8, type: 'all' },
  { id: 'geo-g9-climate', title: 'Grade 9 Geography — Climate Zones', subject: 'geography', grade: '9-12', difficulty: 'Hard', num: 12, type: 'all' },
  { id: 'math-g7-algebra', title: 'Grade 7 Math — Algebra Basics', subject: 'math', grade: '6-8', difficulty: 'Medium', num: 10, type: 'all' },
];

app.get('/api/templates', (req, res) => {
  res.json({ templates: TEMPLATES });
});

app.post('/api/templates/:id/generate', validateGenerateBody, async (req, res) => {
  const template = TEMPLATES.find(t => t.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { topic } = req.body;
  const resolvedTopic = topic || template.title || template.subject;

  if (!process.env.OPENROUTER_KEY && !process.env.GROQ_KEY) {
    return res.status(500).json({ error: 'No AI API key configured' });
  }

  const prompt = buildPrompt(resolvedTopic, template.difficulty, template.type, template.num, null, template.grade);
  const origin = req.headers.origin || 'http://localhost:3000';
  const errors = [];

  for (const model of FALLBACK_MODELS) {
    try {
      const questions = await callModel(model, prompt, origin);
      return res.json({ questions, template: template.id });
    } catch (err) {
      errors.push({ model, error: err.message });
      if (err.fatal) break;
    }
  }

  if (process.env.GROQ_KEY) {
    try {
      const questions = await callGroq(prompt);
      return res.json({ questions, template: template.id });
    } catch (err) {
      errors.push({ model: 'groq/llama-3.3-70b-versatile', error: err.message });
    }
  }

  res.status(503).json({ error: 'All AI models busy.', details: errors });
});

/* ===== Referral System ===== */
app.post('/api/referral/generate', requireUser, async (req, res) => {
  const referralCode = req.user.id.slice(0, 8) + Math.random().toString(36).slice(2, 6);
  const shareUrl = `${req.headers.origin}/generate?ref=${referralCode}`;
  // Store referral code in Supabase or local store
  if (SUPABASE_ENABLED && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ referral_code: referralCode })
      .eq('id', req.user.id);
    if (error) console.error('Referral code save error:', error);
  }
  res.json({ referralCode, shareUrl });
});

app.post('/api/referral/claim', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Referral code required' });

  // For simplicity, grant 3 extra uses by storing in the referring user's quota
  // In production, this would use a referrals table.
  // Here we just return success — the frontend will increment local usage allowance.
  res.json({ success: true, bonusGenerations: 3 });
});

app.get('/api/referral/stats', requireUser, async (req, res) => {
  // Return referral stats (how many people used your link)
  res.json({ totalReferrals: 0, bonusGenerations: 0 });
});

/* ===== API error handler ===== */
app.use('/api/', (err, req, res, next) => {
  console.error('API error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ===== Sitemap for SEO ===== */
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = req.headers.origin || 'https://quikquiz.app';
  const subjects = ['science', 'math', 'history', 'english', 'geography'];
  const grades = ['K-2', '3-5', '6-8', '9-12'];
  const topics = {
    science: ['Animals', 'Plants', 'Solar-System', 'Human-Body', 'Ecosystems', 'Chemical-Reactions', 'Genetics', 'Physics'],
    math: ['Addition', 'Multiplication', 'Fractions', 'Algebra', 'Geometry', 'Calculus', 'Trigonometry', 'Statistics'],
    history: ['Ancient-Egypt', 'American-Revolution', 'World-War-II', 'Cold-War', 'Renaissance', 'Civil-Rights'],
    english: ['Grammar', 'Vocabulary', 'Reading', 'Shakespeare', 'Poetry', 'Essay-Writing'],
    geography: ['Continents', 'Countries', 'Climate', 'Map-Skills', 'Population', 'Natural-Resources'],
  };

  let urls = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>
    <url><loc>${baseUrl}/generate</loc><priority>0.9</priority></url>
    <url><loc>${baseUrl}/pricing</loc><priority>0.8</priority></url>`;

  subjects.forEach(subject => {
    grades.forEach(grade => {
      const gradeParam = grade;
      urls += `<url><loc>${baseUrl}/generate?subject=${subject}&grade=${gradeParam}</loc><priority>0.7</priority></url>`;
      (topics[subject] || []).forEach(topic => {
        urls += `<url><loc>${baseUrl}/quiz-topic/${subject}/${gradeParam}/${topic}</loc><priority>0.6</priority></url>`;
      });
    });
  });

  urls += '</urlset>';
  res.setHeader('Content-Type', 'application/xml');
  res.send(urls);
});

/* ===== SEO Topic Landing Pages ===== */
app.get('/quiz-topic/:subject/:grade/:topic', (req, res) => {
  const { subject, grade, topic } = req.params;
  const decodedTopic = topic.replace(/-/g, ' ');
  const decodedSubject = subject.replace(/-/g, ' ');
  const decodedGrade = grade.replace(/-/g, ' ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${decodedTopic} Quiz for ${decodedSubject} (${decodedGrade}) | QuikQuiz</title>
  <meta name="description" content="Generate a free ${decodedTopic.toLowerCase()} quiz for ${decodedGrade.toLowerCase()} ${decodedSubject.toLowerCase()} students. AI-powered multiple choice, true/false, and fill-in-the-blank questions.">
  <meta property="og:title" content="${decodedTopic} Quiz for ${decodedSubject} (${decodedGrade})">
  <meta property="og:description" content="Create engaging ${decodedSubject.toLowerCase()} quizzes instantly with AI. Perfect for teachers and parents.">
  <meta property="og:type" content="website">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${req.headers.origin}${req.path}">
  <script>
    window.location.href = '${req.headers.origin}/generate?topic=${encodeURIComponent(decodedTopic)}&subject=${encodeURIComponent(decodedSubject)}&grade=${encodeURIComponent(decodedGrade)}';
  </script>
</head>
<body>
  <h1>${decodedTopic} Quiz for ${decodedSubject} (${decodedGrade})</h1>
  <p>Generate a free, AI-powered quiz about ${decodedTopic.toLowerCase()} for ${decodedGrade.toLowerCase()} ${decodedSubject.toLowerCase()} students.</p>
  <p>Redirecting to QuikQuiz...</p>
  <a href="${req.headers.origin}/generate?topic=${encodeURIComponent(decodedTopic)}&subject=${encodeURIComponent(decodedSubject)}&grade=${encodeURIComponent(decodedGrade)}">Click here if not redirected</a>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/* ===== Health Check ===== */
app.get('/health', (req, res) => res.status(200).send('OK'));

/* ===== Serve static files (production: built React app) ===== */
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

/* ===== Start ===== */
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

/* ===== Supabase Admin Client ===== */
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

if (!SUPABASE_ENABLED && !useLocalFallback) {
  console.error('Supabase not configured and local fallback is disabled. Usage/profile endpoints will return 503.');
  if (process.env.NODE_ENV === 'production') {
    console.error('Production environment detected – aborting.');
    process.exit(1);
  }
} else if (useLocalFallback) {
  console.warn('Local fallback store enabled — profile/usage data will be file-backed.');
} else {
  console.log('Supabase configured — using production data store.');
}

/* ===== Auth middleware (verify Supabase JWT) ===== */
async function getUserFromToken(req) {
  if (!supabaseAdmin) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function requireUser(req, res, next) {
  req.user = await getUserFromToken(req);
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

/* ===== Replace in-memory stores with Supabase queries ===== */
async function saveQuiz(id, data) {
  if (supabaseAdmin) {
    const row = {
      id,
      title: data.title || 'Untitled Quiz',
      topic: data.topic,
      subject: data.subject,
      difficulty: data.difficulty,
      format: data.format || 'form',
      show_score: data.showScore !== false,
      timer_seconds: data.timerSeconds || 0,
      questions: data.questions,
      created_at: new Date().toISOString()
    };
    const { error } = await supabaseAdmin
      .from('quizzes')
      .upsert(row);
    if (error) console.error('Supabase saveQuiz error:', error);
    return !error;
  }
  sharedQuizzes.set(id, data);
  return true;
}

async function getQuiz(id) {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return {
      questions: data.questions,
      topic: data.topic,
      difficulty: data.difficulty,
      showScore: data.show_score,
      timerSeconds: data.timer_seconds,
      format: data.format,
      title: data.title,
      subject: data.subject,
      learningMode: data.learning_mode || data.learningMode || false,
      createdAt: data.created_at
    };
  }
  return sharedQuizzes.get(id) || null;
}

async function updateQuiz(id, updates) {
  if (supabaseAdmin) {
    const row = {};
    if (updates.show_score !== undefined) row.show_score = updates.show_score;
    if (updates.timer_seconds !== undefined) row.timer_seconds = updates.timer_seconds;
    if (updates.format !== undefined) row.format = updates.format;
    if (updates.title !== undefined) row.title = updates.title;
    if (updates.subject !== undefined) row.subject = updates.subject;
    const { error } = await supabaseAdmin
      .from('quizzes')
      .update(row)
      .eq('id', id);
    if (error) console.error('Supabase updateQuiz error:', error);
    return !error;
  }
  const quiz = sharedQuizzes.get(id);
  if (!quiz) return false;
  Object.assign(quiz, updates);
  return true;
}

async function saveResult(quizId, result) {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('results')
      .insert({ quiz_id: quizId, ...result, submitted_at: new Date().toISOString() });
    if (error) console.error('Supabase saveResult error:', error);
    return !error;
  }
  const results = sharedResults.get(quizId) || [];
  results.push(result);
  sharedResults.set(quizId, results);
  return true;
}

async function getResults(quizId) {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('results')
      .select('*')
      .eq('quiz_id', quizId)
      .order('submitted_at', { ascending: false });
    if (error) return [];
    return (data || []).map(r => ({
      answers: r.answers,
      correct: r.correct,
      total: r.total,
      percentage: r.percentage,
      submittedAt: new Date(r.submitted_at).getTime()
    }));
  }
  return sharedResults.get(quizId) || [];
}

async function getProfile(userId, email) {
  if (useLocalFallback) {
    const fallback = await getFallbackUsage(email || userId);
    return { usage_count: fallback.usageCount, subscription_status: fallback.paid ? 'active' : 'inactive' };
  }
  if (!SUPABASE_ENABLED) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function incrementUsage(userId, email, name, avatarUrl) {
  if (useLocalFallback) {
    return await incFallbackUsage(email || userId);
  }
  if (!SUPABASE_ENABLED) return 0;
  // Try the atomic Postgres function: UPDATE profiles SET usage_count = usage_count + 1 WHERE id = user_id RETURNING usage_count
  const { data, error } = await supabaseAdmin.rpc('increment_usage', { user_id: userId });
  console.log('[usage] RPC result:', { data, error: error?.message || null });
  if (!error && data != null) return data;
  if (error) console.error('[usage] RPC error:', error);
  // Fallback: upsert directly
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('usage_count, subscription_status')
    .eq('id', userId)
    .maybeSingle();
  console.log('[usage] fallback select:', profile);
  const current = ((profile?.usage_count) ?? 0) + 1;
  const { error: upsertErr } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      email: email,
      name: name || email,
      avatar_url: avatarUrl,
      usage_count: current,
      subscription_status: profile?.subscription_status || 'inactive'
    }, { onConflict: 'id' });
  if (upsertErr) console.error('[usage] fallback upsert error:', upsertErr);
  console.log('[usage] returning current:', current);
  return current;
}

async function getUserQuizzes(userId) {
  if (useLocalFallback) {
    return await getFallbackQuizzes(userId);
  }
  if (!SUPABASE_ENABLED) return [];
  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(q => ({
    id: q.id,
    title: q.title || 'Untitled Quiz',
    topic: q.topic || '',
    subject: q.subject || '',
    difficulty: q.difficulty || 'Easy',
    questions: q.questions || [],
    timerSeconds: q.timer_seconds || 0,
    format: q.format || 'form',
    showScore: q.show_score !== false,
    shareId: null,
    createdAt: q.created_at
  }));
}

async function setSubscription(userId, status, customerId) {
  if (!supabaseAdmin) return;
  const updates = { subscription_status: status };
  if (customerId) updates.stripe_customer_id = customerId;
  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) console.error('Supabase setSubscription error:', error);
}

/* ===== Protected API routes ===== */

// Get current user profile
app.get('/api/profile', requireUser, async (req, res) => {
  if (!SUPABASE_ENABLED && !useLocalFallback) {
    return res.status(503).json({ error: 'Service offline – Supabase not configured.' });
  }
  const profile = await getProfile(req.user.id, req.user.email);
  if (!profile) {
    if (SUPABASE_ENABLED) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: req.user.id,
          email: req.user.email,
          name: req.user.user_metadata?.full_name || req.user.email,
          avatar_url: req.user.user_metadata?.avatar_url
        })
        .select()
        .single();
      return res.json(data || { id: req.user.id, email: req.user.email, usage_count: 0, subscription_status: 'inactive' });
    }
    return res.json({ id: req.user.id, email: req.user.email, usage_count: 0, subscription_status: 'inactive' });
  }
  res.json(profile);
});

// Get usage
app.get('/api/usage', requireUser, async (req, res) => {
  if (!SUPABASE_ENABLED && !useLocalFallback) {
    return res.json({ usageCount: 0, paid: false, message: 'Demo unavailable – please try later.' });
  }
  let profile = await getProfile(req.user.id, req.user.email);
  if (!profile && SUPABASE_ENABLED) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: req.user.id,
        email: req.user.email,
        name: req.user.user_metadata?.full_name || req.user.email,
        avatar_url: req.user.user_metadata?.avatar_url
      })
      .select()
      .single();
    if (!error) profile = data;
    else console.error('[usage] upsert error in GET /api/usage:', error);
  }
  console.log('[usage] GET /api/usage returning:', { usageCount: profile?.usage_count, paid: profile?.subscription_status });
  res.json({ usageCount: profile?.usage_count || 0, paid: profile?.subscription_status === 'active' });
});

// Increment usage (called after a quiz is generated)
app.post('/api/usage/increment', requireUser, async (req, res) => {
  if (!SUPABASE_ENABLED && !useLocalFallback) {
    return res.status(503).json({ error: 'Cannot increment usage – Supabase not configured.' });
  }
  const { id, email, user_metadata } = req.user;
  const name = user_metadata?.full_name || email;
  const avatarUrl = user_metadata?.avatar_url;
  const newCount = await incrementUsage(id, email, name, avatarUrl);
  res.json({ usageCount: newCount });
});

// Get all quizzes for the current user
app.get('/api/quizzes', requireUser, async (req, res) => {
  if (useLocalFallback) {
    const quizzes = await getFallbackQuizzes(req.user.id);
    return res.json({ quizzes });
  }
  if (!SUPABASE_ENABLED) {
    return res.status(503).json({ error: 'Service offline – Supabase not configured.' });
  }
  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ quizzes: data || [] });
});

// Save a new quiz
app.post('/api/quizzes', requireUser, async (req, res) => {
  const { title, topic, subject, difficulty, questions, timerSeconds, format } = req.body;
  if (!questions?.length) return res.status(400).json({ error: 'Questions are required.' });

  const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  if (useLocalFallback) {
    const entry = {
      id,
      title: title || 'Untitled Quiz',
      topic: topic || '',
      subject: subject || '',
      difficulty: difficulty || 'Easy',
      questions,
      timerSeconds: timerSeconds || 0,
      format: format || 'form',
      showScore: false,
      shareId: null,
      createdAt: new Date().toISOString()
    };
    await addFallbackQuiz(req.user.id, entry);
    return res.json({ id });
  }

  if (!SUPABASE_ENABLED) {
    return res.status(503).json({ error: 'Service offline – Supabase not configured.' });
  }

  const { error } = await supabaseAdmin
    .from('quizzes')
    .insert({
      id,
      user_id: req.user.id,
      title: title || 'Untitled Quiz',
      topic: topic || '',
      subject: subject || '',
      difficulty: difficulty || 'Easy',
      format: format || 'form',
      timer_seconds: timerSeconds || 0,
      questions
    });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id });
});

// Delete a quiz
app.delete('/api/quizzes/:id', requireUser, async (req, res) => {
  const { id } = req.params;

  if (useLocalFallback) {
    await deleteFallbackQuiz(req.user.id, id);
    return res.json({ success: true });
  }

  if (!SUPABASE_ENABLED) {
    return res.status(503).json({ error: 'Service offline – Supabase not configured.' });
  }

  const { error } = await supabaseAdmin
    .from('quizzes')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`QuikQuiz running at http://localhost:${PORT}`);
  if (!process.env.OPENROUTER_KEY) console.warn('WARNING: OPENROUTER_KEY not set in .env');
  if (!process.env.STRIPE_SECRET_KEY) console.warn('WARNING: Stripe keys not set — payments disabled');
  if (!process.env.GOOGLE_CLIENT_ID) console.warn('WARNING: GOOGLE_CLIENT_ID not set — Google sign-in disabled');
  if (!SUPABASE_ENABLED && !useLocalFallback) console.warn('Supabase not configured – usage/profile endpoints will return 503.');
  else if (useLocalFallback) console.log('Local fallback store active – file-backed usage data.');
});
