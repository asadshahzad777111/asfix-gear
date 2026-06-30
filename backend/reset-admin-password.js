import { resetSuperAdminPassword } from './store.js';

const password = process.env.ADMIN_PASSWORD || 'AsFix2026!';

const user = resetSuperAdminPassword(password);

if (!user) {
  console.error('No super admin account found. Run: npm run seed');
  process.exit(1);
}

console.log('✓ Admin password reset');
console.log(`  Email:    ${user.email}`);
console.log(`  Username: ${user.username}`);
console.log(`  Password: ${password}`);
