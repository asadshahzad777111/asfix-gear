/**
 * Local / one-off email delivery check.
 * Usage: node scripts/test-email.mjs
 * Optional: TO=you@gmail.com node scripts/test-email.mjs
 */
import { loadEnv } from './load-env.mjs';

loadEnv({ override: true });

const to =
  process.env.TO ||
  process.env.ORDER_NOTIFY_EMAIL ||
  process.env.SHOP_NOTIFY_EMAIL ||
  process.env.SHOP_EMAIL ||
  'asadshahzad777111@gmail.com';

const { verifySmtpConnection, deliverTransactionalEmail, getEmailDeliveryStatus } = await import(
  '../backend/services/otpDelivery.js'
);

const status = getEmailDeliveryStatus();
console.log('[test-email] status:', JSON.stringify(status));

const verify = await verifySmtpConnection();
console.log('[test-email] verify:', JSON.stringify({ ok: verify.ok, provider: verify.provider, reason: verify.reason }));

if (!status.configured) {
  console.error(
    '[test-email] FAIL — no credentials in .env. Set RESEND_API_KEY or GMAIL_USER+GMAIL_APP_PASSWORD (see .env.example).'
  );
  process.exit(2);
}

const stamp = new Date().toISOString();
const result = await deliverTransactionalEmail(to, {
  subject: 'AsFix & Gear — test email (script)',
  text: `Script test at ${stamp}`,
  html: `<p>AsFix test email (script)</p><p>${stamp}</p>`,
});

console.log('[test-email] send:', JSON.stringify({ to, ...result }));
process.exit(result.sent ? 0 : 1);
