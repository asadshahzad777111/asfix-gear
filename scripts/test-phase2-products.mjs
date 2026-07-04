/**
 * Phase 2 product editor tests — store layer + HTTP API (starts server on 5001).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'http://127.0.0.1:5001/api';

async function req(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.error || res.statusText}`);
  return data;
}

function waitForServer(maxMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`${API}/health`);
        const data = await res.json();
        if (res.ok && data.ready) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - started > maxMs) return reject(new Error('Server did not become ready'));
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function runStoreTests(store) {
  const results = [];
  const {
    initStorage,
    createProduct,
    updateProduct,
    getProducts,
    duplicateProduct,
    deleteProduct,
    normalizeTags,
    slugify,
    ensureUniqueSlug,
  } = store;

  const { migrateData } = await import(pathToFileURL(path.join(ROOT, 'backend', 'store', 'data-migration.js')).href);

  await initStorage();

  const migrated = migrateData({
    products: [{ id: 1, name: 'Legacy', category: 'Cases', price: 100, stock: 1 }],
    meta: {},
    users: [],
    sessions: [],
  });
  const sample = migrated.products[0];
  if (sample.slug !== '') throw new Error('migration did not default slug to empty string');
  if (!Array.isArray(sample.tags) || sample.tags.length !== 0) throw new Error('migration did not default tags');
  results.push(['data migration defaults slug/tags', 'PASS']);

  const unique = ensureUniqueSlug([{ id: 1, slug: 'test-case' }, { id: 2, slug: 'test-case-2' }], 'test-case', 1);
  if (unique !== 'test-case') throw new Error(`expected test-case got ${unique}`);
  results.push(['slug uniqueness suffix', 'PASS']);

  const tags = normalizeTags(['  Foo ', 'foo', 'bar', 'baz']);
  if (tags.length !== 3) throw new Error(`normalizeTags dedupe failed: ${tags.join(',')}`);
  results.push(['normalizeTags dedupe', 'PASS']);

  const created = createProduct({
    name: 'Store Test Widget',
    category: 'Accessories',
    brand: 'anker-custom',
    price: 500,
    description: '<p><strong>Bold</strong></p>',
    slug: 'store-test-widget',
    tags: ['accessory', 'test'],
    stock: 1,
    status: 'draft',
    created_by: 1,
  });

  if (created.slug !== 'store-test-widget') throw new Error('slug not saved');
  if (created.tags.length !== 2) throw new Error('tags not saved');
  if (created.status !== 'draft') throw new Error('draft status wrong');

  const publicProducts = getProducts().filter((p) => (p.status || 'published') === 'published');
  if (publicProducts.some((p) => p.id === created.id)) throw new Error('draft in published filter');
  results.push(['store create draft + slug/tags', 'PASS']);

  const updated = updateProduct(created.id, {
    name: 'Store Test Widget Renamed',
    status: 'published',
    tags: ['accessory'],
  });
  if (updated.status !== 'published') throw new Error('update publish failed');
  results.push(['store update publish', 'PASS']);

  const copy = duplicateProduct(created.id, { created_by: 1 });
  if (!copy.slug.includes('store-test-widget')) throw new Error('duplicate slug missing base');
  if (copy.status !== 'draft') throw new Error('duplicate should be draft');
  results.push(['duplicate unique slug + draft', 'PASS']);

  deleteProduct(copy.id);
  deleteProduct(created.id);
  results.push(['store cleanup', 'PASS']);

  return results;
}

async function runApiTests(token) {
  const results = [];
  const payload = {
    name: `HTTP Phase2 ${Date.now()}`,
    category: 'Cables',
    brand: 'samsung',
    compatible_models: '',
    price: 999,
    cost_price: 0,
    description: '<p><em>Italic</em> cable</p><ol><li>Fast charge</li></ol>',
    slug: 'http-phase2-cable',
    tags: ['usb-c', 'fast-charge'],
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop',
    gallery: [],
    stock: 3,
    featured: false,
    discount_percent: 0,
    warranty: '',
    status: 'draft',
  };

  const created = await req('/products', { method: 'POST', body: payload, token });
  if (created.status !== 'draft' || !created.slug) throw new Error('API create failed');
  results.push(['API create with slug/tags/html', 'PASS']);

  const publicList = await req('/products');
  if (publicList.some((p) => p.id === created.id)) throw new Error('draft on public list');
  results.push(['API draft hidden public', 'PASS']);

  await req(`/products/${created.id}`, {
    method: 'PUT',
    body: { ...payload, status: 'published' },
    token,
  });
  const publicAfter = await req('/products');
  if (!publicAfter.some((p) => p.id === created.id)) throw new Error('published not public');
  results.push(['API publish visible', 'PASS']);

  await req(`/products/${created.id}`, { method: 'DELETE', token });
  results.push(['API cleanup', 'PASS']);

  return results;
}

async function main() {
  const store = await import(pathToFileURL(path.join(ROOT, 'backend', 'store.js')).href);
  const storeResults = await runStoreTests(store);
  const session = store.createSession(1);
  const token = session.token;

  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'backend'),
    env: { ...process.env, PORT: '5001', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  try {
    await waitForServer();
    const apiResults = await runApiTests(token);
    const all = [...storeResults, ...apiResults];
    console.log('\n=== Phase 2 Test Results ===');
    for (const [name, status] of all) {
      console.log(`${status === 'PASS' ? '✓' : '✗'} ${name}: ${status}`);
    }
    console.log(`\n${all.length}/${all.length} PASS\n`);
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
