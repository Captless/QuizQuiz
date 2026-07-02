/* ===== API calls to backend ===== */

async function generateQuiz(topic, difficulty, type, num) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, difficulty, type, num })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate quiz');
  if (!data.questions || !data.questions.length) throw new Error('No questions returned');
  return data.questions;
}

async function createCheckoutSession() {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create checkout session');
  return data.url;
}

async function checkPaymentStatus(sessionId) {
  const res = await fetch(`/api/status?session_id=${encodeURIComponent(sessionId)}`);
  const data = await res.json();
  return data.paid === true;
}

async function suggestTopics(subject, grade, topic) {
  try {
    const res = await fetch('/api/suggest-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, grade, topic })
    });
    const data = await res.json();
    return data.topics || [];
  } catch { return []; }
}

async function generateQuizFromFile(topic, difficulty, type, num, file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('topic', topic);
  fd.append('difficulty', difficulty);
  fd.append('type', type);
  fd.append('num', num);
  const res = await fetch('/api/generate-from-file', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate quiz from file');
  if (!data.questions?.length) throw new Error('No questions returned');
  return data.questions;
}
