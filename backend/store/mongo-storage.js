import { connectMongo, getDb } from '../db/client.js';
import { DEFAULT_DATA, migrateData } from './data-migration.js';

const COLLECTIONS = [
  'users',
  'sessions',
  'products',
  'repair_services',
  'repair_bookings',
  'repair_rates',
  'repair_rate_queries',
  'repair_messages',
  'contact_messages',
  'orders',
  'verification_codes',
];

const LOCK_MAX_SPINS = 200;

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

let writeLock = false;
/** In-memory snapshot — sync store API reads/writes here; Mongo I/O stays async. */
let memoryCache = null;
let persistChain = Promise.resolve();

function acquireWriteLock() {
  for (let i = 0; i < LOCK_MAX_SPINS; i += 1) {
    if (!writeLock) {
      writeLock = true;
      return;
    }
    sleepSync(5);
  }
  throw new Error('Data store is busy — please try again');
}

function releaseWriteLock() {
  writeLock = false;
}

function stripMongoId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

async function loadMeta(db) {
  const doc = await db.collection('meta').findOne({ _id: 'meta' });
  if (!doc) return { ...DEFAULT_DATA.meta };
  const { _id, ...meta } = doc;
  return { ...DEFAULT_DATA.meta, ...meta };
}

async function loadSettings(db) {
  const doc = await db.collection('settings').findOne({ _id: 'settings' });
  if (!doc) return structuredClone(DEFAULT_DATA.settings);
  return {
    shop: {
      manual_override: doc.shop?.manual_override ?? null,
      updated_at: doc.shop?.updated_at ?? null,
      updated_by: doc.shop?.updated_by ?? null,
    },
  };
}

async function loadCollection(db, name) {
  const docs = await db.collection(name).find({}).toArray();
  return docs.map(stripMongoId);
}

async function readDataAsync() {
  await connectMongo();
  const db = getDb();
  const data = {
    meta: await loadMeta(db),
    settings: await loadSettings(db),
    users: await loadCollection(db, 'users'),
    sessions: await loadCollection(db, 'sessions'),
    products: await loadCollection(db, 'products'),
    repair_services: await loadCollection(db, 'repair_services'),
    repair_bookings: await loadCollection(db, 'repair_bookings'),
    repair_rates: await loadCollection(db, 'repair_rates'),
    repair_rate_queries: await loadCollection(db, 'repair_rate_queries'),
    repair_messages: await loadCollection(db, 'repair_messages'),
    contact_messages: await loadCollection(db, 'contact_messages'),
    orders: await loadCollection(db, 'orders'),
    verification_codes: await loadCollection(db, 'verification_codes'),
  };
  return migrateData(data);
}

function collectionIdField(name) {
  return name === 'sessions' ? 'token' : 'id';
}

function toMongoDoc(name, item) {
  const idField = collectionIdField(name);
  const key = item[idField];
  return { _id: key, ...item };
}

async function saveCollection(db, name, items) {
  const col = db.collection(name);
  const idField = collectionIdField(name);
  const keys = items.map((item) => item[idField]);

  if (keys.length === 0) {
    await col.deleteMany({});
    return;
  }

  await col.deleteMany({ [idField]: { $nin: keys } });

  if (items.length === 0) return;

  const ops = items.map((item) => ({
    replaceOne: {
      filter: { [idField]: item[idField] },
      replacement: toMongoDoc(name, item),
      upsert: true,
    },
  }));
  await col.bulkWrite(ops, { ordered: false });
}

async function writeDataAsync(data) {
  const db = getDb();
  await Promise.all(COLLECTIONS.map((name) => saveCollection(db, name, data[name] || [])));
  await db.collection('meta').replaceOne(
    { _id: 'meta' },
    { _id: 'meta', ...data.meta },
    { upsert: true }
  );
  await db.collection('settings').replaceOne(
    { _id: 'settings' },
    {
      _id: 'settings',
      shop: data.settings?.shop || DEFAULT_DATA.settings.shop,
    },
    { upsert: true }
  );
}

function requireCache() {
  if (!memoryCache) {
    throw new Error('MongoDB cache not warm — storage still starting');
  }
  return memoryCache;
}

function schedulePersist(data) {
  const snapshot = structuredClone(data);
  persistChain = persistChain
    .then(() => writeDataAsync(snapshot))
    .catch((err) => {
      console.error('[MongoDB] persist failed:', err.message);
    });
}

/** Load MongoDB into memory — must complete before sync store calls. */
export async function warmCache() {
  memoryCache = await readDataAsync();
  return memoryCache;
}

export function isCacheWarm() {
  return memoryCache != null;
}

export function readData() {
  return structuredClone(requireCache());
}

export function withData(mutator) {
  acquireWriteLock();
  try {
    const data = structuredClone(requireCache());
    const result = mutator(data);
    memoryCache = migrateData(data);
    schedulePersist(memoryCache);
    return result;
  } finally {
    releaseWriteLock();
  }
}

/** Used by migration script to bulk-load a full snapshot. */
export async function writeFullSnapshot(data) {
  await connectMongo();
  const migrated = migrateData(structuredClone(data));
  await writeDataAsync(migrated);
  memoryCache = migrated;
  return migrated;
}

export async function readFullSnapshot() {
  return readDataAsync();
}

/** Flush pending writes — for tests and graceful shutdown. */
export async function flushPersistQueue() {
  await persistChain;
}
