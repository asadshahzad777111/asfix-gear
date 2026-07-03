/**
 * Seed / refresh iPhone repair rate card in JSON or MongoDB store.
 * Run: node scripts/seed-iphone-repair-rates.mjs
 */
import { loadEnv } from './load-env.mjs';
import { initStorage } from '../backend/store/storage.js';
import { buildIphoneRepairRateRecords } from '../backend/rates/iphone-repair-rates.js';
import * as store from '../backend/store.js';

loadEnv();

async function main() {
  await initStorage();
  const records = buildIphoneRepairRateRecords();
  const result = store.upsertRepairRates(records);
  console.log(
    `[seed-repair-rates] Done — inserted ${result.inserted}, updated ${result.updated}, total ${result.total} rates (${records.length} source rows).`
  );
}

main().catch((err) => {
  console.error('[seed-repair-rates] Failed:', err.message);
  process.exitCode = 1;
});
