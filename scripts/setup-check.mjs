#!/usr/bin/env node
/**
 * Pre-deploy checklist — MongoDB + R2 readiness.
 * Usage: npm run setup:check
 */
import { loadEnv } from './load-env.mjs';
import { closeMongo, connectMongo, isMongoEnabled } from '../backend/db/client.js';
import { isR2Configured } from '../backend/services/r2.js';

loadEnv();

const checks = [];

function ok(label, detail = '') {
  checks.push({ ok: true, label, detail });
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail = '') {
  checks.push({ ok: false, label, detail });
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('AsFix & Gear — setup check\n');

// MongoDB
if (!isMongoEnabled()) {
  fail('MONGODB_URI', 'Add to .env or Render Environment');
} else {
  try {
    const db = await connectMongo();
    await db.command({ ping: 1 });
    const products = await db.collection('products').countDocuments();
    const users = await db.collection('users').countDocuments();
    ok('MongoDB', `database "${db.databaseName}" — ${products} products, ${users} users`);
  } catch (err) {
    fail('MongoDB connect', err.message);
  } finally {
    await closeMongo();
  }
}

// R2
if (!isR2Configured()) {
  fail('R2 env vars', 'Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL in .env');
} else {
  const placeholders = ['PASTE_', 'paste_', 'your_'];
  const vals = [
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_PUBLIC_BASE_URL,
  ];
  if (vals.some((v) => placeholders.some((p) => String(v || '').includes(p)))) {
    fail('R2 keys', 'Replace PASTE_ placeholders with real Cloudflare values');
  } else {
    ok('R2 configured', `bucket ${process.env.R2_BUCKET_NAME}`);
  }
}

// Render reminder
console.log('\n--- Production (Render) ---');
console.log('Health must show: "storage":"mongodb" and "r2":"configured"');
console.log('URL: https://asfixgear.com/api/health');
console.log('Until then, redeploy can wipe shop data (JSON disk).\n');

const failed = checks.filter((c) => !c.ok);
process.exit(failed.length ? 1 : 0);
