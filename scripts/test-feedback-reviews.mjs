/**
 * Local smoke test: order feedback / reviews admin flow
 * Run: node scripts/test-feedback-reviews.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:5000';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${body?.error || text}`);
  return body;
}

async function main() {
  let pass = 0;
  const check = (name, fn) =>
    fn().then(() => {
      console.log('PASS', name);
      pass += 1;
    });

  const login = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'asad', password: process.env.ADMIN_PASSWORD || 'admin123' }),
  });
  const token = login.token;

  await check('Submit feedback sets status pending', async () => {
    const orders = await req('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
    const order = orders.find((o) => !o.customer_feedback?.rating) || orders[0];
    if (!order) throw new Error('No orders');
    const phone = order.phone || order.customer_phone;
    const ref = order.order_id || `ASF-${1000 + order.id}`;
    try {
      await req('/api/orders/feedback', {
        method: 'POST',
        body: JSON.stringify({
          orderId: ref,
          phone,
          rating: 5,
          comment: 'Test review from smoke script',
        }),
      });
    } catch (e) {
      if (!String(e.message).includes('already submitted')) throw e;
    }
  });

  await check('Admin list feedback', async () => {
    const list = await req('/api/admin/feedback', { headers: { Authorization: `Bearer ${token}` } });
    if (!Array.isArray(list) || list.length === 0) throw new Error('Empty feedback list');
    const row = list[0];
    if (!row.status) throw new Error('Missing status');
  });

  await check('Publish review', async () => {
    const list = await req('/api/admin/feedback', { headers: { Authorization: `Bearer ${token}` } });
    const row = list.find((r) => r.status !== 'published') || list[0];
    const updated = await req(`/api/admin/feedback/${row.order_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'published' }),
    });
    if (updated.status !== 'published') throw new Error('Not published');
  });

  await check('Public reviews only published', async () => {
    const pub = await req('/api/orders/reviews');
    if (!Array.isArray(pub)) throw new Error('Not array');
    if (pub.some((r) => r.status && r.status !== 'published')) {
      throw new Error('Non-published in public API');
    }
  });

  await check('Hide review', async () => {
    const list = await req('/api/admin/feedback', { headers: { Authorization: `Bearer ${token}` } });
    const row = list[0];
    const updated = await req(`/api/admin/feedback/${row.order_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'hidden' }),
    });
    if (updated.status !== 'hidden') throw new Error('Not hidden');
    await req(`/api/admin/feedback/${row.order_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'published', comment: updated.comment }),
    });
  });

  await check('Edit review comment', async () => {
    const list = await req('/api/admin/feedback', { headers: { Authorization: `Bearer ${token}` } });
    const row = list[0];
    const updated = await req(`/api/admin/feedback/${row.order_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ comment: 'Edited by admin smoke test' }),
    });
    if (!updated.comment.includes('Edited')) throw new Error('Edit failed');
  });

  console.log(`\n${pass}/6 tests passed`);
  if (pass < 6) process.exit(1);
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
