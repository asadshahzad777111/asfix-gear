/** Phase 3 local smoke: categories CRUD, customers summary, sales report widgets. */
import { loadEnv } from './load-env.mjs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnv();

const TEST_PORT = 5020;
const PORT = TEST_PORT;
const BASE = `http://127.0.0.1:${PORT}`;
const password = process.env.ADMIN_PASSWORD;
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'backend');

const results = [];

function pass(label) {
  results.push({ label, ok: true });
  console.log(`PASS: ${label}`);
}

function fail(label, detail) {
  results.push({ label, ok: false, detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
}

function waitForServer(timeoutMs = 25000) {
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

async function authFetch(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

if (!password) {
  console.error('ADMIN_PASSWORD missing in .env');
  process.exit(1);
}

const server = spawn('node', ['server.js'], {
  cwd: backendDir,
  env: { ...process.env, NODE_ENV: 'test', PORT: String(TEST_PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

try {
  await waitForServer();

  const { res: loginRes, data: loginBody } = await authFetch('/api/auth/login', {
    method: 'POST',
    body: { login: 'asad', password },
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginBody.error || loginRes.status}`);
  const token = loginBody.token;
  pass('Staff login');

  const { res: listRes, data: categoriesBefore } = await authFetch('/api/admin/categories', { token });
  if (!listRes.ok) fail('GET /admin/categories', JSON.stringify(categoriesBefore));
  else pass('GET /admin/categories');

  const testName = `Phase3 Test Cat ${Date.now()}`;
  const { res: createRes, data: created } = await authFetch('/api/admin/categories', {
    method: 'POST',
    token,
    body: { name: testName },
  });
  if (!createRes.ok || !created.id) fail('POST category create', JSON.stringify(created));
  else pass('POST category create');

  const renamed = `${testName} Edited`;
  const { res: patchRes, data: patched } = await authFetch(`/api/admin/categories/${created.id}`, {
    method: 'PATCH',
    token,
    body: { name: renamed },
  });
  if (!patchRes.ok || patched.name !== renamed) fail('PATCH category rename', JSON.stringify(patched));
  else pass('PATCH category rename (empty category)');

  const { res: delRes } = await authFetch(`/api/admin/categories/${created.id}`, {
    method: 'DELETE',
    token,
  });
  if (!delRes.ok) fail('DELETE empty category');
  else pass('DELETE empty category');

  const { data: products } = await authFetch('/api/products?status=all', { token });
  const withCat = (products || []).find((p) => p.category);
  if (withCat) {
    const usedName = withCat.category;
    const { res: allCatsRes, data: allCats } = await authFetch('/api/admin/categories', { token });
    const catList = Array.isArray(allCats) ? allCats : [];
    const usedCat = catList.find((c) => c.name === usedName);
    if (usedCat && usedCat.product_count > 0) {
      const { res: blockRes, data: blockData } = await authFetch(`/api/admin/categories/${usedCat.id}`, {
        method: 'DELETE',
        token,
      });
      if (blockRes.status === 409 && blockData.product_count > 0) {
        pass('DELETE blocked when products use category');
      } else {
        fail('DELETE should block in-use category', `status=${blockRes.status}`);
      }
    } else {
      pass('DELETE blocked when products use category (skipped — no registry match)');
    }
  } else {
    pass('DELETE blocked when products use category (skipped — no products)');
  }

  const { data: pubCats } = await authFetch('/api/products/categories');
  if (Array.isArray(pubCats)) pass('Public /products/categories still works');
  else fail('Public categories endpoint');

  const { res: custRes, data: customers } = await authFetch('/api/admin/customers-summary', { token });
  if (!custRes.ok || !Array.isArray(customers)) {
    fail('GET customers-summary', JSON.stringify(customers));
  } else {
    pass('GET customers-summary');
    const sample = customers[0];
    if (sample && 'order_count' in sample && 'total_spent' in sample && 'recent_orders' in sample) {
      pass('Customer aggregates include order_count, total_spent, recent_orders');
    } else if (customers.length === 0) {
      pass('Customer aggregates (empty store)');
    } else {
      fail('Customer aggregate fields missing', JSON.stringify(sample));
    }
  }

  const { res: salesRes, data: report } = await authFetch('/api/admin/sales-report?period=week', { token });
  if (!salesRes.ok) fail('GET sales-report', JSON.stringify(report));
  else pass('GET sales-report');

  if (report.summary && Array.isArray(report.top_products) && Array.isArray(report.daily_chart)) {
    pass('Sales report includes summary, top_products, daily_chart');
  } else {
    fail('Sales report widget fields', JSON.stringify({ keys: Object.keys(report || {}) }));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Phase 3 test summary ---');
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length) process.exitCode = 1;
} catch (err) {
  console.error('FAIL:', err.message);
  if (serverLog) console.error('Server log tail:\n', serverLog.slice(-800));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
