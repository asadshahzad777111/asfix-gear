import { resetSuperAdminPassword, syncSuperAdminEmail } from './store.js';

const ADMIN_EMAIL = 'asadshahzad777111@gmail.com';
const password = process.env.ADMIN_PASSWORD || 'AsFix2026!';

const user = resetSuperAdminPassword(password);
if (!user) {
  console.error('No super admin account found. Run: npm run seed');
  process.exit(1);
}

const { user: synced, changed: emailSynced } = syncSuperAdminEmail(ADMIN_EMAIL);
const final = synced || user;

console.log('✓ Admin credentials reset');
if (emailSynced) console.log('✓ Admin email synced to seed default');
console.log(`  Email:    ${final.email}`);
console.log(`  Username: ${final.username}`);
console.log(`  Password: ${password}`);
