/** Set local admin password from ADMIN_PASSWORD env — no password printed. */
import { loadEnv } from './load-env.mjs';
import { resetSuperAdminPassword, initStorage } from '../backend/store.js';

loadEnv();
await initStorage();

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('Set ADMIN_PASSWORD in .env first');
  process.exit(1);
}

const user = resetSuperAdminPassword(password);
if (!user) {
  console.error('No super admin found — run npm run seed');
  process.exit(1);
}

console.log(`Admin password updated for ${user.email} (local JSON store)`);
