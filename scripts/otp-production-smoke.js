/**
 * Production OTP auth smoke test — hits live API endpoints for signup,
 * sign-in OTP, and password reset. Does NOT boot a local server.
 *
 * Usage:
 *   BASE_URL=https://asfix-gear.onrender.com node scripts/otp-production-smoke.js
 *   BASE_URL=https://asfixgear.com node scripts/otp-production-smoke.js
 *
 * Full verify steps need the 6-digit code from email:
 *   OTP_CODE=123456 node scripts/otp-production-smoke.js
 *
 * Or pass codes per flow:
 *   OTP_REGISTER=123456 OTP_LOGIN=654321 OTP_RESET=111222 node scripts/otp-production-smoke.js
 */
const BASE = (process.env.BASE_URL || 'https://asfix-gear.onrender.com').replace(/\/$/, '');
const API = `${BASE}/api`;

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    method: options.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text.slice(0, 300) };
  }
  return { status: res.status, data, ok: res.ok };
}

async function testHealth() {
  const { status, data } = await call('/health', { method: 'GET' });
  record('Health check', status === 200 && data.status === 'ok', `status=${status}`);
}

async function testOtpValidation() {
  const bad = await call('/auth/register/verify', {
    body: { code: '12345', email: 'test@gmail.com', phone: '' },
  });
  record(
    '6-digit OTP validation (reject 5 digits)',
    bad.status === 400 && /6-digit/.test(bad.data.error || ''),
    bad.data.error || `status=${bad.status}`
  );

  const bad2 = await call('/auth/login/otp/verify', {
    body: { code: 'abcdef', login: 'test@gmail.com' },
  });
  record(
    'Login OTP validation (reject non-digits)',
    bad2.status === 400 && /6-digit/.test(bad2.data.error || ''),
    bad2.data.error || `status=${bad2.status}`
  );
}

async function testSignupFlow(otpCode) {
  const email = `prod.smoke.${Date.now()}@gmail.com`;
  const username = `prodsmoke${Date.now()}`.slice(0, 28);
  const password = 'TestPass123';

  const start = await call('/auth/register/start', {
    body: {
      name: 'Prod Smoke Test',
      username,
      email,
      phone: '',
      password,
      confirmPassword: password,
    },
  });

  const startOk =
    start.status === 200 &&
    start.data.channel === 'email' &&
    !start.data.devCode &&
    (start.data.message || start.data.sent !== false);
  record(
    'Signup — register/start (Gmail OTP send)',
    startOk,
    startOk
      ? `channel=${start.data.channel}, sent=${start.data.sent ?? 'n/a'}`
      : start.data.error || JSON.stringify(start.data).slice(0, 120)
  );
  if (!startOk) return { email, username, password, skipped: true };

  if (!otpCode) {
    record('Signup — register/verify (needs OTP_CODE)', false, 'Set OTP_REGISTER or OTP_CODE env var');
    return { email, username, password, skipped: true };
  }

  const verify = await call('/auth/register/verify', {
    body: { code: otpCode, email, phone: '' },
  });
  const verifyOk = verify.status === 201 && verify.data.token && verify.data.user?.email === email;
  record(
    'Signup — register/verify',
    verifyOk,
    verifyOk ? 'token issued' : verify.data.error || `status=${verify.status}`
  );
  if (!verifyOk) return { email, username, password, skipped: true };

  const me = await call('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${verify.data.token}` },
  });
  record('Signup — auth/me', me.status === 200 && me.data.user?.email === email);

  await call('/auth/logout', { headers: { Authorization: `Bearer ${verify.data.token}` } });

  const dupe = await call('/auth/register/start', {
    body: {
      name: 'Duplicate',
      username: `${username}x`,
      email,
      phone: '',
      password,
      confirmPassword: password,
    },
  });
  record('Signup — duplicate Gmail rejected', dupe.status === 400, dupe.data.error || `status=${dupe.status}`);

  return { email, username, password, token: verify.data.token };
}

async function testLoginOtpFlow(email, otpCode) {
  if (!email) {
    record('Sign-in OTP — skipped', false, 'No registered email from signup flow');
    return;
  }

  const start = await call('/auth/login/otp/start', { body: { login: email } });
  const startOk = start.status === 200 && start.data.channel === 'email' && !start.data.devCode;
  record(
    'Sign-in OTP — login/otp/start',
    startOk,
    startOk ? `channel=${start.data.channel}` : start.data.error || `status=${start.status}`
  );
  if (!startOk) return;

  if (!otpCode) {
    record('Sign-in OTP — login/otp/verify (needs OTP_LOGIN)', false, 'Set OTP_LOGIN or OTP_CODE env var');
    return;
  }

  const verify = await call('/auth/login/otp/verify', {
    body: { code: otpCode, login: email },
  });
  record(
    'Sign-in OTP — login/otp/verify',
    verify.status === 200 && verify.data.token,
    verify.data.token ? 'token issued' : verify.data.error || `status=${verify.status}`
  );
}

async function testPasswordResetFlow(email, otpCode) {
  if (!email) {
    record('Password reset — skipped', false, 'No registered email from signup flow');
    return;
  }

  const start = await call('/auth/password/reset/start', { body: { login: email } });
  const startOk = start.status === 200 && start.data.channel === 'email' && !start.data.devCode;
  record(
    'Password reset — reset/start',
    startOk,
    startOk ? `channel=${start.data.channel}` : start.data.error || `status=${start.status}`
  );
  if (!startOk) return;

  if (!otpCode) {
    record('Password reset — reset/verify (needs OTP_RESET)', false, 'Set OTP_RESET or OTP_CODE env var');
    return;
  }

  const newPassword = 'NewPass456!';
  const verify = await call('/auth/password/reset/verify', {
    body: {
      login: email,
      code: otpCode,
      newPassword,
      confirmPassword: newPassword,
    },
  });
  const verifyOk = verify.status === 200 && verify.data.message;
  record(
    'Password reset — reset/verify',
    verifyOk,
    verifyOk ? verify.data.message : verify.data.error || `status=${verify.status}`
  );
  if (!verifyOk) return;

  const login = await call('/auth/login', { body: { login: email, password: newPassword } });
  record(
    'Password reset — login with new password',
    login.status === 200 && login.data.token,
    login.data.token ? 'ok' : login.data.error || `status=${login.status}`
  );
}

async function main() {
  console.log(`Production OTP smoke test → ${API}\n`);

  const otpRegister = process.env.OTP_REGISTER || process.env.OTP_CODE || '';
  const otpLogin = process.env.OTP_LOGIN || process.env.OTP_CODE || '';
  const otpReset = process.env.OTP_RESET || process.env.OTP_CODE || '';

  await testHealth();
  await testOtpValidation();

  const account = await testSignupFlow(otpRegister);
  if (!account.skipped) {
    await testLoginOtpFlow(account.email, otpLogin);
    await testPasswordResetFlow(account.email, otpReset);
  } else if (account.email) {
    // Still test login/reset start against a known-good email shape if register/start worked
    await testLoginOtpFlow(null, otpLogin);
    await testPasswordResetFlow(null, otpReset);
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n--- Summary: ${passed} passed, ${failed} failed (${results.length} checks) ---`);

  if (failed > 0 && !otpRegister) {
    console.log('\nTip: OTP send steps may pass while verify steps need the email code.');
    console.log('Re-run with OTP_REGISTER=<code> OTP_LOGIN=<code> OTP_RESET=<code>');
  }

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('Smoke test crashed:', err.message);
  process.exit(1);
});
