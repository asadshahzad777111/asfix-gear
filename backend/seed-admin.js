import { ensureSuperAdmin, syncSuperAdminEmail, resetSuperAdminPassword } from './store.js';

const DEFAULT = {
  email: 'asadshahzad777111@gmail.com',
  username: 'asad',
  password: process.env.ADMIN_PASSWORD || 'AsFix2026!',
};

const created = ensureSuperAdmin(DEFAULT);
const { user: synced, changed: emailSynced } = syncSuperAdminEmail(DEFAULT.email);
let user = created || synced;

if (!created && process.env.SYNC_ADMIN_ON_DEPLOY === '1') {
  const reset = resetSuperAdminPassword(DEFAULT.password);
  if (reset) {
    user = reset;
    console.log('✓ Super admin password synced (SYNC_ADMIN_ON_DEPLOY=1)');
  }
}

if (created) {
  console.log('✓ Super admin created');
} else if (emailSynced) {
  console.log('✓ Super admin email updated');
} else {
  console.log('Super admin already exists — skipped.');
}

if (user) {
  console.log(`  Email:    ${user.email}`);
  console.log(`  Username: ${user.username}`);
  if (created) {
    console.log(`  Password: ${DEFAULT.password}`);
    console.log('  Change this password after first login.');
  } else {
    console.log('To reset password: npm run reset-admin');
  }
} else {
  console.log('To reset password: npm run reset-admin');
}
