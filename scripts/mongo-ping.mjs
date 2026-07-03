#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { loadEnv } from './load-env.mjs';
import { closeMongo, connectMongo, isMongoEnabled } from '../backend/db/client.js';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/package.json'));
const { MongoClient } = require('mongodb');

loadEnv();

function toDirectUri(uri) {
  const m = uri.match(/^(mongodb(?:\+srv)?:\/\/[^@]+@)([^,/?]+)(?:,[^/]*)?(\/[^?]*)?(?:\?(.*))?$/);
  if (!m) return null;
  const [, prefix, firstHost, dbPath = '', query = ''] = m;
  const params = new URLSearchParams(query);
  params.delete('replicaSet');
  const q = params.toString();
  return `${prefix}${firstHost}${dbPath}${q ? `?${q}` : ''}`;
}

function logServerErrors(err) {
  const servers = err?.reason?.servers;
  if (!servers || typeof servers.entries !== 'function') return;
  for (const [address, desc] of servers) {
    const detail = desc.error?.message || desc.type || 'unknown';
    console.error(`  • ${address} → ${detail}`);
  }
}

async function fetchPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return data.ip || null;
  } catch {
    return null;
  }
}

async function tryDirectPing() {
  const directUri = toDirectUri(process.env.MONGODB_URI);
  if (!directUri) return false;
  const client = new MongoClient(directUri, {
    directConnection: true,
    serverSelectionTimeoutMS: 12000,
  });
  try {
    await client.connect();
    const dbName = process.env.MONGODB_DB || 'asfix_gear';
    await client.db(dbName).command({ ping: 1 });
    console.log(`OK (direct): connected to "${dbName}"`);
    return true;
  } catch (err) {
    console.error('Direct single-host test also failed:', err.message);
    logServerErrors(err);
    return false;
  } finally {
    await client.close().catch(() => {});
  }
}

if (!isMongoEnabled()) {
  console.error('MONGODB_URI is not set. Add it to .env or export it in your shell.');
  process.exit(1);
}

const publicIp = await fetchPublicIp();
if (publicIp) {
  console.log(`Your public IP: ${publicIp}  → add this in Atlas → Network Access if not listed`);
}

try {
  const db = await connectMongo();
  await db.command({ ping: 1 });
  console.log(`OK: connected to database "${db.databaseName}"`);
} catch (err) {
  const msg = String(err?.message || err);
  console.error(`FAIL (replica set): ${msg}`);
  logServerErrors(err);

  const directOk = await tryDirectPing();
  if (directOk) {
    console.log('');
    console.log('Replica-set URI failed but direct host works.');
    console.log('You can migrate using a single-host URI in .env until DNS/replica discovery is fixed.');
    process.exit(0);
  }

  console.error('');
  console.error('Atlas checklist:');
  console.error('  1. Network Access → Active entry for 0.0.0.0/0 OR your IP above (not Expired)');
  console.error('  2. Database → cluster status must be green / Running (not Paused)');
  console.error('  3. Database Access → user password matches .env (rotate if unsure)');
  console.error('  4. Pakistan ISP often blocks MongoDB — try mobile hotspot or VPN, then re-run npm run mongo:ping');
  process.exit(1);
} finally {
  await closeMongo();
}
