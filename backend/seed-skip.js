import { isMongoEnabled } from './db/client.js';

/** Skip slow Mongo seed during Render build — Atlas already has shop data. */
export function shouldSkipSeed() {
  if (process.env.SKIP_SEED === '1') return true;
  if (process.env.RENDER && isMongoEnabled()) return true;
  return false;
}

export function exitIfSeedSkipped(label = 'seed') {
  if (!shouldSkipSeed()) return false;
  console.log(`Skipping ${label} on Render (MongoDB Atlas — data already in cloud).`);
  process.exit(0);
}
