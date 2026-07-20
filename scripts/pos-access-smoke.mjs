import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'backend', 'data', 'data.json');
const PORT = Number(process.env.POS_SMOKE_PORT || 5107);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const ADMIN_LOGIN = 'pos_smoke_admin';
const POS_LOGIN = 'pos_smoke_staff';
const ADMIN_PASSWORD = 'PosSmokeAdmin2026!';
const POS_PASSWORD = 'PosSmokeStaff2026!';

function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) {
            resolve();
            return;
          }
          retry();
        })
        .on('error', retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Server did not respond at ${url}`));
        return;
      }
      setTimeout(check, 400);
    };
    check();
  });
}

async function request(pathname, { token, expected, ...options } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${pathname}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (expected != null && res.status !== expected) {
    throw new Error(`${pathname} expected ${expected}, got ${res.status}: ${text}`);
  }
  if (expected == null && !res.ok) {
    throw new Error(`${pathname} failed ${res.status}: ${text}`);
  }
  return { status: res.status, data };
}

async function seedTemporaryData() {
  process.env.MONGODB_URI = '';
  const store = await import('../backend/store.js');
  await store.initStorage();

  const admin = store.createUser({
    email: 'pos.smoke.admin@gmail.com',
    username: ADMIN_LOGIN,
    name: 'POS Smoke Admin',
    password: ADMIN_PASSWORD,
    role: 'admin',
    createdBy: null,
  });
  const pos = store.createUser({
    email: 'pos.smoke.staff@gmail.com',
    username: POS_LOGIN,
    name: 'POS Smoke Staff',
    password: POS_PASSWORD,
    role: 'counter',
    createdBy: admin.id,
  });
  const product = store.createProduct({
    name: `POS Smoke Product ${Date.now()}`,
    category: 'Smoke Test',
    brand: 'AsFix',
    compatible_models: 'POS smoke',
    price: 1200,
    cost_price: 800,
    description: 'Temporary POS access smoke product',
    stock: 3,
    status: 'published',
    created_by: admin.id,
    created_by_name: admin.name,
  });

  return { admin, pos, product };
}

async function runBrowserChecks() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/pos/login`, { waitUntil: 'load', timeout: 15000 });
    await page.fill('#pos-login', POS_LOGIN);
    await page.fill('#pos-password', POS_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/pos', { timeout: 15000 });

    await page.goto(`${BASE_URL}/admin?tab=products`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForURL('**/pos', { timeout: 15000 });
  } finally {
    await browser.close();
  }
}

async function main() {
  const hadDataFile = fs.existsSync(DATA_FILE);
  const backup = hadDataFile ? fs.readFileSync(DATA_FILE, 'utf8') : null;
  let server;

  try {
    const seeded = await seedTemporaryData();
    server = spawn(process.execPath, ['backend/server.js'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SERVE_SPA: '1',
        PORT: String(PORT),
        MONGODB_URI: '',
      },
    });
    server.stdout.on('data', (chunk) => process.stdout.write(chunk));
    server.stderr.on('data', (chunk) => process.stderr.write(chunk));

    await waitForServer(`${BASE_URL}/api/health`);

    const posLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: POS_LOGIN, password: POS_PASSWORD }),
    });
    if (posLogin.data.user.role !== 'counter') throw new Error('POS login did not return counter role');
    const posToken = posLogin.data.token;

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD }),
    });
    if (adminLogin.data.user.role !== 'admin') throw new Error('Admin login did not return admin role');
    const adminToken = adminLogin.data.token;

    await request('/api/auth/users', {
      token: adminToken,
      method: 'POST',
      expected: 201,
      body: JSON.stringify({
        name: 'Admin Created POS',
        email: 'admin.created.pos@gmail.com',
        password: 'AdminCreatedPos2026!',
        confirmPassword: 'AdminCreatedPos2026!',
        role: 'counter',
      }),
    });
    await request('/api/auth/users', {
      token: adminToken,
      method: 'POST',
      expected: 403,
      body: JSON.stringify({
        name: 'Blocked Editor',
        email: 'admin.created.editor@gmail.com',
        password: 'AdminCreatedEditor2026!',
        confirmPassword: 'AdminCreatedEditor2026!',
        role: 'editor',
      }),
    });

    const sale = await request('/api/orders/counter-sale', {
      token: posToken,
      method: 'POST',
      expected: 201,
      body: JSON.stringify({
        customer_name: 'Walk-in Smoke',
        phone: '03000000000',
        payment_mode: 'cash',
        payment_note: 'smoke dry-run',
        items: [{ product_id: seeded.product.id, qty: 1 }],
      }),
    });
    if (!sale.data.order?.order_id) throw new Error('POS sale did not return printable order data');

    await request('/api/orders/counter-sales', { token: posToken, expected: 200 });
    await request('/api/admin/dashboard-stats', { token: posToken, expected: 403 });
    await request('/api/orders', { token: posToken, expected: 403 });
    await request(`/api/products/${seeded.product.id}`, {
      token: posToken,
      method: 'PUT',
      expected: 403,
      body: JSON.stringify({ price: 999 }),
    });
    await request('/api/admin/dashboard-stats', { token: adminToken, expected: 200 });

    await runBrowserChecks();

    console.log(JSON.stringify({
      ok: true,
      pos_user: seeded.pos.username,
      sale_order_id: sale.data.order.order_id,
      checks: [
        'pos_login',
        'admin_created_pos_staff',
        'admin_editor_create_403',
        'pos_sale_created',
        'receipt_data_returned',
        'pos_sales_history',
        'pos_admin_api_403',
        'pos_orders_api_403',
        'pos_product_edit_403',
        'admin_api_allowed',
        'admin_url_redirects_to_pos',
      ],
    }, null, 2));
  } finally {
    if (server) {
      server.kill();
      await new Promise((resolve) => server.once('close', resolve));
    }
    if (backup != null) {
      fs.writeFileSync(DATA_FILE, backup, 'utf8');
    } else if (!hadDataFile && fs.existsSync(DATA_FILE)) {
      fs.rmSync(DATA_FILE);
    }
  }
}

main().catch((err) => {
  console.error(`[pos-smoke] ${err.message}`);
  process.exit(1);
});
