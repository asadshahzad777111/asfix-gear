#!/usr/bin/env node
/**
 * Migrate backend/data/data.json into MongoDB Atlas (or local Mongo).
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/migrate-json-to-mongo.mjs
 *   MONGODB_URI="..." node scripts/migrate-json-to-mongo.mjs --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrateData, DEFAULT_DATA } from '../backend/store/data-migration.js';
import { writeFullSnapshot } from '../backend/store/mongo-storage.js';
import { closeMongo, isMongoEnabled } from '../backend/db/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'backend', 'data', 'data.json');
const dryRun = process.argv.includes('--dry-run');

function loadJsonData() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Missing ${DATA_FILE} — run seed locally first or copy production backup.`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return migrateData(raw);
}

function summarize(data) {
  return {
    users: data.users.length,
    sessions: data.sessions.length,
    products: data.products.length,
    repair_services: data.repair_services.length,
    repair_bookings: data.repair_bookings.length,
    contact_messages: data.contact_messages.length,
    orders: data.orders.length,
    verification_codes: data.verification_codes.length,
    meta: data.meta,
  };
}

async function main() {
  if (!isMongoEnabled()) {
    console.error('Set MONGODB_URI before running migration.');
    process.exit(1);
  }

  const data = loadJsonData();
  const summary = summarize(data);

  console.log('Source:', DATA_FILE);
  console.log('Counts:', summary);

  if (dryRun) {
    console.log('Dry run — no writes performed.');
    return;
  }

  const saved = await writeFullSnapshot(data);
  console.log('Migration complete.');
  console.log('Meta counters preserved:', saved.meta);

  const emptyMeta = { ...DEFAULT_DATA.meta };
  for (const key of Object.keys(emptyMeta)) {
    if ((saved.meta[key] || 1) < (data.meta[key] || 1)) {
      console.warn(`Warning: meta.${key} may have regressed — check Atlas.`);
    }
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  })
  .finally(() => closeMongo());
