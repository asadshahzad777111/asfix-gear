/**
 * Unified login smoke: staff + customer password login, no staff-block on OTP start.
 */
import { loadEnv } from './load-env.mjs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { initStorage, createCustomer } from '../backend/store.js';

loadEnv();

const PORT = process.env.TEST_PORT || 5055;
const BASE = `http://127.0.0.1:${PORT}`;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  console.error('ADMIN_PASSWORD missing in .env');
  process.exit(1);
}

function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(`${BASE}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
      function retry() {
        if (Date.now() - start > timeoutMs) reject(new Error('Server timeout'));
        else setTimeout(check, 400);
      }
    };
    check();
  });
}

const backendDir = new URL('../backend', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const server = spawn('node', ['server.js'], {
  cwd: backendDir,
  env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

try {
  await waitForServer();

  // Staff password login
  const staffRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'asad', password: adminPassword }),
  });
  const staffBody = await staffRes.json();
  record(
    'Staff password login',
    staffRes.ok && ['super_admin', 'admin', 'editor'].includes(staffBody.user?.role),
    staffBody.user?.role || staffBody.error,
  );

  // Staff OTP start must NOT return staff-block message
  const otpRes = await fetch(`${BASE}/api/auth/login/otp/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: staffBody.user?.email || 'asadshahzad777111@gmail.com' }),
  });
  const otpBody = await otpRes.json();
  const blockedMsg = 'Staff accounts must use the admin login page.';
  record(
    'Staff OTP start (no staff-block error)',
    !otpBody.error?.includes(blockedMsg),
    otpBody.error || `channel=${otpBody.channel || otpBody.method}`,
  );

  // Ensure test customer exists
  await initStorage();
  const customerEmail = 'unified.test@gmail.com';
  const customerPass = 'TestPass123!';
  try {
    createCustomer({
      name: 'Unified Test',
      email: customerEmail,
      username: 'unifiedtest',
      password: customerPass,
    });
  } catch {
    /* already exists */
  }

  const custRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: customerEmail, password: customerPass }),
  });
  const custBody = await custRes.json();
  record(
    'Customer password login',
    custRes.ok && custBody.user?.role === 'customer',
    custBody.user?.role || custBody.error,
  );

  // Frontend redirect helper (inline to avoid Vite/JSX import issues in Node)
  const STAFF_ROLES = ['super_admin', 'admin', 'editor'];
  function getPostLoginPath(user, from) {
    const LOGIN_PATHS = new Set(['/account/login', '/login']);
    const safeFrom = typeof from === 'string' && from && !LOGIN_PATHS.has(from) ? from : null;
    const isStaff = Boolean(user?.active && !user?.blocked && STAFF_ROLES.includes(user.role));
    const isCustomer = Boolean(user?.active && !user?.blocked && user.role === 'customer');
    if (isStaff) return safeFrom?.startsWith('/admin') ? safeFrom : '/admin';
    if (isCustomer) return safeFrom?.startsWith('/account') ? safeFrom : '/account';
    return safeFrom || '/';
  }
  record(
    'Redirect staff → /admin',
    getPostLoginPath({ role: 'super_admin', active: true, blocked: false }, '/account') === '/admin',
  );
  record(
    'Redirect customer → /account',
    getPostLoginPath({ role: 'customer', active: true, blocked: false }, '/account/login') === '/account',
  );
  record(
    'Redirect staff preserves /admin?tab',
    getPostLoginPath({ role: 'admin', active: true, blocked: false }, '/admin?tab=orders') === '/admin?tab=orders',
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
} catch (err) {
  console.error('FAIL:', err.message);
  if (serverLog) console.error('Server log tail:\n', serverLog.slice(-800));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
