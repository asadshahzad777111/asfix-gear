/**
 * Verifies repair chat rate limits:
 * - GET message polling is NOT blocked by writeLimiter (15/min)
 * - Staff can send many quick-reply messages without false 429s
 *
 * Run: node scripts/repair-chat-rate-limit-test.mjs
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = process.env.RATE_TEST_PORT || 5199;
const BASE = `http://127.0.0.1:${PORT}`;

function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(`${BASE}/api/health`, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else if (Date.now() - start > timeoutMs) reject(new Error('Health check failed'));
          else setTimeout(check, 400);
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) reject(new Error(`Server not up at ${BASE}`));
          else setTimeout(check, 400);
        });
    };
    check();
  });
}

async function jsonFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function main() {
  const child = spawn('node', ['backend/server.js'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLog = '';
  child.stdout.on('data', (d) => { serverLog += d; });
  child.stderr.on('data', (d) => { serverLog += d; });

  try {
    await waitForServer();

    // Public GET polling must not hit the old writeLimiter (15/min on all /repairs)
    for (let i = 0; i < 20; i += 1) {
      const poll = await jsonFetch('/api/repairs/services');
      if (poll.status === 429) {
        throw new Error(`GET poll #${i + 1} got 429 — writeLimiter still blocking reads: ${poll.data.error}`);
      }
    }
    console.log('OK: 20 repair GET polls — no writeLimiter 429');

    // Optional staff POST test when credentials work locally
    const login = await jsonFetch('/api/auth/login', {
      method: 'POST',
      body: { login: 'asad', password: process.env.ADMIN_PASSWORD || 'AsFix2026!' },
    });
    if (login.status === 200 && login.data.token) {
      const token = login.data.token;
      const bookingsRes = await jsonFetch('/api/repairs/bookings', { token });
      const bookings = bookingsRes.data;
      if (Array.isArray(bookings) && bookings.length > 0) {
        const bookingId = bookings[0].id;
        for (let i = 0; i < 8; i += 1) {
          const sent = await jsonFetch(`/api/repairs/bookings/${bookingId}/messages`, {
            method: 'POST',
            token,
            body: { text: `Rate-limit test message ${i + 1}` },
          });
          if (sent.status !== 201) {
            throw new Error(`Staff send #${i + 1} failed (${sent.status}): ${sent.data.error}`);
          }
        }
        console.log('OK: 8 staff quick-reply POSTs — no false rate limit');
      }
    } else {
      console.log('SKIP: staff POST test (login unavailable in this env)');
    }

    console.log('repair-chat-rate-limit-test: PASSED');
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode == null) child.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('repair-chat-rate-limit-test: FAILED');
  console.error(err.message || err);
  process.exit(1);
});
