#!/usr/bin/env node
/** Quick production API smoke test — no auth required for public routes. */
const BASE = (process.env.BASE_URL || 'https://asfixgear.com').replace(/\/$/, '');

const checks = [];

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 200) };
}

function pass(name, detail = '') {
  checks.push({ ok: true, name, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  checks.push({ ok: false, name, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log(`Production smoke: ${BASE}\n`);

const health = await get('/api/health');
if (health.json?.status === 'ok' && health.json?.storage === 'mongodb') {
  pass('Health + MongoDB', `r2=${health.json.r2}`);
} else {
  fail('Health + MongoDB', JSON.stringify(health.json || health.text));
}

if (health.json?.r2 === 'configured') pass('R2 configured');
else fail('R2 configured', String(health.json?.r2));

const stats = await get('/api/stats');
if (stats.json?.products >= 1) {
  pass('Stats', `${stats.json.products} products, ${stats.json.services} services`);
} else {
  fail('Stats', JSON.stringify(stats.json));
}

const products = await get('/api/products');
if (Array.isArray(products.json) && products.json.length >= 1) {
  const withImage = products.json.filter((p) => String(p.image || '').startsWith('http'));
  pass('Products API', `${products.json.length} items, ${withImage.length} with http image URL`);
} else {
  fail('Products API', `status ${products.status}`);
}

const shop = await get('/api/shop/status');
if (shop.json && 'is_open' in shop.json) pass('Shop status', shop.json.is_open ? 'open' : 'closed');
else fail('Shop status', JSON.stringify(shop.json)?.slice(0, 120));

const r2Sample = products.json?.find((p) => String(p.image || '').includes('r2.dev'));
if (r2Sample) pass('R2 image in catalog', r2Sample.image.slice(0, 60) + '...');
else pass('R2 image in catalog', 'none yet (upload test optional)');

const uploadProbe = await fetch(`${BASE}/api/products/upload-image`, {
  method: 'POST',
  signal: AbortSignal.timeout(15000),
});
if (uploadProbe.status === 401) pass('Upload route exists', '401 without auth (expected)');
else if (uploadProbe.status === 404) fail('Upload route exists', '404 — old code?');
else pass('Upload route exists', `HTTP ${uploadProbe.status}`);

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length ? 1 : 0);
