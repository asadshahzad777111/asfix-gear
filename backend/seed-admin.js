import { ensureSuperAdmin } from './store.js';

const DEFAULT = {
  email: 'asadshahzad77111@gmail.com',
  username: 'asad',
  password: process.env.ADMIN_PASSWORD || 'AsFix2026!',
};

const user = ensureSuperAdmin(DEFAULT);

if (user) {
  console.log('✓ Super admin created');
  console.log(`  Email:    ${user.email}`);
  console.log(`  Username: ${user.username}`);
  console.log(`  Password: ${DEFAULT.password}`);
  console.log('  Change this password after first login.');
} else {
  console.log('Super admin already exists — skipped.');
  console.log('To reset password: npm run reset-admin');
}
