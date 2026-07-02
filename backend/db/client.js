import { MongoClient } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB || 'asfix_gear';

let client = null;
let db = null;
let connectPromise = null;

export function isMongoEnabled() {
  return Boolean(String(process.env.MONGODB_URI || '').trim());
}

export function getStorageBackend() {
  return isMongoEnabled() ? 'mongodb' : 'json';
}

function mongoClientOptions(uri, extra = {}) {
  const opts = { maxPoolSize: 10, serverSelectionTimeoutMS: 15000, ...extra };
  const hostPart = String(uri || '').replace(/^mongodb(\+srv)?:\/\/[^@]+@/, '').split('/')[0];
  if (!hostPart.includes(',')) {
    opts.directConnection = true;
  }
  return opts;
}

function parseMongoUri(uri) {
  const m = String(uri || '').match(/^(mongodb(?:\+srv)?:\/\/)([^@]+@)?(.+)$/);
  if (!m) return null;
  return { prefix: m[1], auth: m[2] || '', rest: m[3] };
}

function buildDirectUri(uri, host) {
  const parsed = parseMongoUri(uri);
  if (!parsed) return uri;
  const slashIdx = parsed.rest.indexOf('/');
  const path = slashIdx >= 0 ? parsed.rest.slice(slashIdx) : '';
  const dbPath = path.split('?')[0] || '';
  const params = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
  params.delete('replicaSet');
  const q = params.toString();
  return `${parsed.prefix}${parsed.auth}${host}${dbPath}${q ? `?${q}` : ''}`;
}

function listSeedHosts(uri) {
  const parsed = parseMongoUri(uri);
  if (!parsed) return [];
  const slashIdx = parsed.rest.indexOf('/');
  const hostPart = slashIdx >= 0 ? parsed.rest.slice(0, slashIdx) : parsed.rest;
  return hostPart.split(',').filter(Boolean);
}

async function connectWritableClient(uri) {
  const seeds = listSeedHosts(uri);
  if (!seeds.length) throw new Error('MONGODB_URI has no hosts');
  let lastError;

  for (const host of seeds) {
    const directUri = seeds.length > 1 ? buildDirectUri(uri, host) : uri;
    const candidate = new MongoClient(directUri, mongoClientOptions(directUri));
    try {
      await candidate.connect();
      const hello = await candidate.db('admin').command({ hello: 1 });
      if (hello.isWritablePrimary) return candidate;
      await candidate.close();
      lastError = new Error(`Host ${host} is not primary`);
    } catch (err) {
      lastError = err;
      await candidate.close().catch(() => {});
    }
  }

  throw lastError || new Error('Could not reach a writable MongoDB primary');
}

/** Block the main thread until a promise settles (keeps store API synchronous). */
export function runSync(promise) {
  const sab = new SharedArrayBuffer(4);
  const slot = new Int32Array(sab);
  let result;
  let error;
  Promise.resolve(promise).then(
    (value) => {
      result = value;
      Atomics.store(slot, 0, 1);
      Atomics.notify(slot, 0);
    },
    (err) => {
      error = err;
      Atomics.store(slot, 0, 1);
      Atomics.notify(slot, 0);
    }
  );
  Atomics.wait(slot, 0, 0);
  if (error) throw error;
  return result;
}

async function ensureIndexes(database) {
  await Promise.all([
    database.collection('users').createIndex({ id: 1 }, { unique: true }),
    database.collection('users').createIndex({ email: 1 }),
    database.collection('users').createIndex({ username: 1 }),
    database.collection('sessions').createIndex({ token: 1 }, { unique: true }),
    database.collection('sessions').createIndex({ user_id: 1 }),
    database.collection('products').createIndex({ id: 1 }, { unique: true }),
    database.collection('repair_services').createIndex({ id: 1 }, { unique: true }),
    database.collection('repair_bookings').createIndex({ id: 1 }, { unique: true }),
    database.collection('contact_messages').createIndex({ id: 1 }, { unique: true }),
    database.collection('orders').createIndex({ id: 1 }, { unique: true }),
    database.collection('verification_codes').createIndex({ id: 1 }, { unique: true }),
    database.collection('verification_codes').createIndex({ purpose: 1, target: 1 }),
  ]);
}

export async function connectMongo() {
  if (!isMongoEnabled()) return null;
  if (db) return db;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    client = await connectWritableClient(process.env.MONGODB_URI);
    db = client.db(DB_NAME);
    await ensureIndexes(db);
    return db;
  })();

  try {
    return await connectPromise;
  } catch (err) {
    connectPromise = null;
    throw err;
  }
}

export function getDb() {
  if (!db) {
    throw new Error('MongoDB not connected — call connectMongo() before using the store');
  }
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
  }
  client = null;
  db = null;
  connectPromise = null;
}
