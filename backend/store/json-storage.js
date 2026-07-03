import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_DATA, migrateData } from './data-migration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const LOCK_FILE = path.join(DATA_DIR, '.data.lock');
const LOCK_MAX_SPINS = 200;
const LOCK_STALE_MS = 3000;

function writeDataAtomic(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmp = `${DATA_FILE}.tmp`;
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    writeDataAtomic(DEFAULT_DATA);
  }
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function acquireDataLock() {
  for (let i = 0; i < LOCK_MAX_SPINS; i += 1) {
    try {
      fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
      return;
    } catch {
      try {
        const stat = fs.statSync(LOCK_FILE);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(LOCK_FILE);
          continue;
        }
      } catch {
        /* lock file vanished */
      }
      sleepSync(5);
    }
  }
  throw new Error('Data store is busy — please try again');
}

function releaseDataLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    /* lock already released */
  }
}

function readDataRaw() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

export function readData() {
  const parsed = readDataRaw();
  const before = JSON.stringify(parsed);
  const data = migrateData(parsed);
  if (JSON.stringify(data) !== before) {
    writeDataAtomic(data);
  }
  return data;
}

function writeData(data) {
  writeDataAtomic(data);
}

export function withData(mutator) {
  acquireDataLock();
  try {
    const data = readData();
    const result = mutator(data);
    writeData(data);
    return result;
  } finally {
    releaseDataLock();
  }
}

export function getDataFilePath() {
  return DATA_FILE;
}
