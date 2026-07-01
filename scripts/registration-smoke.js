/**
 * Registration/auth flow smoke test — boots the backend API in dev mode
 * (no real SMTP/WhatsApp secrets required, since NODE_ENV !== 'production'
 * makes otpDelivery.js return the code directly as `devCode`) and drives the
 * exact HTTP calls the customer-facing signup UI makes:
 *   register/start -> register/verify -> me -> logout
 * and the password-reset flow:
 *   password/reset/start -> password/reset/verify -> login
 *
 * This exists so a real regression in the registration/auth routes fails CI
 * with a clear error message, instead of only being noticed when a real
 * customer can't create an account in production.
 *
 * Run with: node scripts/registration-smoke.js
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = process.env.REG_SMOKE_PORT || 5098;
const BASE_URL = `http://localhost:${PORT}/api`;

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Server did not respond at ${url} within ${timeoutMs}ms`));
            return;
          }
          setTimeout(check, 300);
        });
    };
    check();
  });
}

async function call(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response from ${path} (status ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok && options.expectFail !== true) {
    throw new Error(`${path} -> ${res.status}: ${data.error || text}`);
  }
  return { status: res.status, data };
}

async function testCustomerRegistration() {
  const email = `smoke.test.${Date.now()}@gmail.com`;
  const username = `smoketest${Date.now()}`.slice(0, 28);

  const start = await call('/auth/register/start', {
    body: {
      name: 'CI Smoke Test',
      username,
      email,
      phone: '',
      password: 'TestPass123',
      confirmPassword: 'TestPass123',
    },
  });
  if (!start.data.devCode) {
    throw new Error('register/start did not return a devCode in dev mode — cannot verify OTP delivery path');
  }

  const verify = await call('/auth/register/verify', {
    body: { code: start.data.devCode, email, phone: '' },
  });
  if (!verify.data.token || !verify.data.user) {
    throw new Error('register/verify did not return a session token + user');
  }

  const me = await call('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${verify.data.token}` },
  });
  if (me.data.user?.email !== email) {
    throw new Error('auth/me returned an unexpected account after registration');
  }

  await call('/auth/logout', { headers: { Authorization: `Bearer ${verify.data.token}` } });

  const dupe = await call('/auth/register/start', {
    body: {
      name: 'Duplicate',
      username: `${username}2`,
      email,
      phone: '',
      password: 'TestPass123',
      confirmPassword: 'TestPass123',
    },
    expectFail: true,
  });
  if (dupe.status !== 400) {
    throw new Error('Registering the same Gmail twice should be rejected with 400');
  }

  return { email, username };
}

async function testPasswordReset(email) {
  const start = await call('/auth/password/reset/start', { body: { login: email } });
  if (!start.data.devCode) {
    throw new Error('password/reset/start did not return a devCode in dev mode');
  }

  const verify = await call('/auth/password/reset/verify', {
    body: {
      login: email,
      code: start.data.devCode,
      newPassword: 'NewPass456',
      confirmPassword: 'NewPass456',
    },
  });
  if (!verify.data.message) {
    throw new Error('password/reset/verify did not confirm success');
  }

  const login = await call('/auth/login', { body: { login: email, password: 'NewPass456' } });
  if (!login.data.token) {
    throw new Error('Login with the newly reset password failed');
  }
}

async function main() {
  console.log(`Starting dev-mode backend on port ${PORT}...`);
  const server = spawn(process.execPath, ['backend/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT) },
  });

  let exited = false;
  const cleanup = () => {
    if (!exited) {
      exited = true;
      server.kill();
    }
  };
  process.on('exit', cleanup);

  try {
    await waitForServer(`${BASE_URL}/health`);
    console.log('Server up. Running registration + password-reset flow...');

    process.stdout.write('Customer signup (register/start -> verify -> me -> logout) ... ');
    const { email } = await testCustomerRegistration();
    console.log('OK');

    process.stdout.write('Forgot-password flow (reset/start -> verify -> login) ... ');
    await testPasswordReset(email);
    console.log('OK');

    console.log('\nRegistration smoke test passed.');
  } catch (err) {
    console.error('\nRegistration smoke test FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

main();
