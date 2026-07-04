/**
 * Local smoke test for shop draft + category fixes.
 * Usage: node scripts/test-shop-bugs.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://localhost:5000').replace(/\/$/, '');

async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`Testing ${BASE}/api ...\n`);

  // Find a gaming trigger product and set to draft
  const all = (await get('/api/products')).body;
  assert(Array.isArray(all), 'GET /products should return array');
  const trigger = all.find((p) => /trigger/i.test(p.name));
  assert(trigger, 'Need a trigger product in seed data');

  // Simulate staff save to draft via store (API PUT needs auth)
  const store = await import('../backend/store.js');
  store.updateProduct(trigger.id, { status: 'draft' });

  const publicList = (await get('/api/products')).body;
  const draftInList = publicList.some((p) => p.id === trigger.id);
  assert(!draftInList, `Draft "${trigger.name}" must not appear in public list`);

  const detail = await get(`/api/products/${trigger.id}`);
  assert(detail.status === 404, 'Draft detail must 404 for public');

  // Staff token simulation: public list still hides drafts
  const withFakeStaff = await get('/api/products', {
    Authorization: 'Bearer invalid-but-present',
  });
  const draftWithToken = (withFakeStaff.body || []).some((p) => p.id === trigger.id);
  assert(!draftWithToken, 'Draft must stay hidden even when Authorization header is sent');

  const adminList = await get('/api/products?status=all', {
    Authorization: 'Bearer invalid',
  });
  // Without valid staff token, admin catalog should still hide drafts
  const draftInAdminWithoutAuth = (adminList.body || []).some((p) => p.id === trigger.id);
  assert(!draftInAdminWithoutAuth, 'status=all without staff auth must not expose drafts');

  // Restore published for category tests
  store.updateProduct(trigger.id, { status: 'published' });

  for (const cat of ['Accessories', 'Gaming', 'Cases', 'Chargers']) {
    const items = (await get(`/api/products?category=${encodeURIComponent(cat)}`)).body;
    const expected = store.getProducts({ category: cat }).filter((p) => store.isPublishedProduct(p));
    assert(
      items.length === expected.length,
      `Category "${cat}": API returned ${items.length}, expected ${expected.length}`
    );
    console.log(`PASS category ${cat}: ${items.length} product(s)`);
  }

  // Case-insensitive category
  const lower = (await get('/api/products?category=accessories')).body;
  const proper = (await get('/api/products?category=Accessories')).body;
  assert(lower.length === proper.length && lower.length > 0, 'Case-insensitive category filter failed');
  console.log('PASS case-insensitive category match');

  // Order rejects draft
  store.updateProduct(trigger.id, { status: 'draft' });
  try {
    store.createOrder({
      customer_name: 'Test',
      phone: '03001234567',
      items: [{ product_id: trigger.id, name: trigger.name, qty: 1, price: trigger.price }],
    });
    throw new Error('Order with draft product should fail');
  } catch (err) {
    assert(/no longer available/i.test(err.message), `Expected draft order rejection, got: ${err.message}`);
    console.log('PASS order rejects draft product');
  }
  store.updateProduct(trigger.id, { status: 'published' });

  console.log('\nAll shop bug checks passed.');
}

main().catch((err) => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
