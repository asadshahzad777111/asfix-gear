/** Local smoke: login + GET /api/admin/customers-summary (no secrets printed). */
import { loadEnv } from './load-env.mjs';
import { spawn } from 'node:child_process';
import http from 'node:http';

loadEnv();

const PORT = process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}`;
const password = process.env.ADMIN_PASSWORD;

if (!password) {
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

const server = spawn('node', ['server.js'], {
  cwd: new URL('../backend', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

try {
  await waitForServer();

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'asad', password }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${loginBody.error || loginRes.status}`);

  const token = loginBody.token;
  const summaryRes = await fetch(`${BASE}/api/admin/customers-summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const customers = await summaryRes.json();
  if (!summaryRes.ok) throw new Error(`customers-summary failed: ${JSON.stringify(customers)}`);

  console.log('GET /api/admin/customers-summary — OK');
  console.log(`Storage: ${(await (await fetch(`${BASE}/api/health`)).json()).storage}`);
  console.log(`Customers: ${customers.length}`);
  for (const c of customers) {
    console.log(`  • ${c.name} | orders: ${c.order_count} | spent: Rs ${c.total_spent} | ${c.email || c.phone}`);
  }
} catch (err) {
  console.error('FAIL:', err.message);
  if (serverLog) console.error('Server log tail:\n', serverLog.slice(-800));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
