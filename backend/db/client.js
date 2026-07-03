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

async function connectWritableClient(uri) {
  const normalized = String(uri || '').trim();
  if (!normalized) throw new Error('MONGODB_URI is empty');

  const clientOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 20000,
  };

  // Standard driver discovery — works with Atlas SRV and seed-list URIs on Render.
  const candidate = new MongoClient(normalized, clientOptions);
  try {
    await candidate.connect();
    await candidate.db('admin').command({ ping: 1 });
    return candidate;
  } catch (err) {
    await candidate.close().catch(() => {});
    throw err;
  }
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
    database.collection('repair_rates').createIndex({ id: 1 }, { unique: true }),
    database.collection('repair_rates').createIndex({ model: 1, part_type: 1 }),
    database.collection('repair_rate_queries').createIndex({ id: 1 }, { unique: true }),
    database.collection('repair_rate_queries').createIndex({ customer_user_id: 1 }),
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
    ensureIndexes(db).catch((err) => {
      console.error('[MongoDB] index setup:', err.message);
    });
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
