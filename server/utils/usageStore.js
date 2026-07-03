const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.USAGE_STORE_DIR || path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'usage.json');

// In-memory fallback if file I/O fails
const memoryStore = new Map();

// Ensure data directory and file exist
function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
    }
  } catch (err) {
    console.error('UsageStore: Failed to create data directory or file:', err.message);
  }
}

// Read all usage records from file
function readStore() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('UsageStore: Failed to read usage file, using memory fallback:', err.message);
    return null;
  }
}

// Write all usage records to file
function writeStore(store) {
  ensureDataFile();
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('UsageStore: Failed to write usage file, using memory fallback:', err.message);
  }
}

function getEntry(userId) {
  const store = readStore();
  if (store && store[userId]) {
    return store[userId];
  }
  // Fallback to in-memory
  const mem = memoryStore.get(userId);
  return mem || { usageCount: 0, paid: false };
}

function setEntry(userId, entry) {
  memoryStore.set(userId, entry);
  const store = readStore();
  if (store) {
    store[userId] = entry;
    writeStore(store);
  }
}

async function getUsage(userId) {
  if (!userId) return { usageCount: 0, paid: false };
  const entry = getEntry(userId);
  return { usageCount: entry.usageCount || 0, paid: entry.paid || false };
}

async function incUsage(userId) {
  if (!userId) return 0;
  const entry = getEntry(userId);
  const newCount = (entry.usageCount || 0) + 1;
  setEntry(userId, { usageCount: newCount, paid: entry.paid || false });
  return newCount;
}

async function setPaid(userId, paid) {
  if (!userId) return;
  const entry = getEntry(userId);
  setEntry(userId, { usageCount: entry.usageCount || 0, paid: !!paid });
}

// Initialize on import
ensureDataFile();

module.exports = { getUsage, incUsage, setPaid };
