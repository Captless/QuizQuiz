const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.USAGE_STORE_DIR || path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'quizzes.json');

const memoryStore = new Map();

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
    }
  } catch (err) {
    console.error('QuizzesStore: Failed to create data directory or file:', err.message);
  }
}

function readStore() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('QuizzesStore: Failed to read quizzes file, using memory fallback:', err.message);
    return null;
  }
}

function writeStore(store) {
  ensureDataFile();
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('QuizzesStore: Failed to write quizzes file, using memory fallback:', err.message);
  }
}

async function getUserQuizzes(userId) {
  if (!userId) return [];
  const mem = memoryStore.get(userId);
  if (mem) return mem;
  const store = readStore();
  if (store && store[userId]) {
    const list = store[userId];
    memoryStore.set(userId, list);
    return list;
  }
  return [];
}

async function addQuiz(userId, quiz) {
  if (!userId) return;
  const list = await getUserQuizzes(userId);
  const idx = list.findIndex(q => q.id === quiz.id);
  if (idx >= 0) {
    list[idx] = quiz;
  } else {
    list.unshift(quiz);
  }
  memoryStore.set(userId, list);
  const store = readStore();
  if (store) {
    store[userId] = list;
    writeStore(store);
  }
}

async function deleteQuiz(userId, quizId) {
  if (!userId) return;
  const list = await getUserQuizzes(userId);
  const filtered = list.filter(q => q.id !== quizId);
  memoryStore.set(userId, filtered);
  const store = readStore();
  if (store) {
    store[userId] = filtered;
    writeStore(store);
  }
}

ensureDataFile();

module.exports = { getUserQuizzes, addQuiz, deleteQuiz };
