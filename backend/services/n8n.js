/**
 * Fire-and-forget webhooks to n8n (or any automation host).
 * Set N8N_WEBHOOK_URL (one catch-all) and/or per-event URLs.
 * Never blocks API responses; failures are logged only.
 */

const TIMEOUT_MS = 8000;

function trimUrl(value) {
  const s = String(value || '').trim();
  if (!s || !/^https?:\/\//i.test(s)) return '';
  return s;
}

/** @returns {boolean} */
export function isN8nConfigured() {
  return Boolean(
    trimUrl(process.env.N8N_WEBHOOK_URL) ||
      trimUrl(process.env.N8N_WEBHOOK_ORDER) ||
      trimUrl(process.env.N8N_WEBHOOK_REPAIR) ||
      trimUrl(process.env.N8N_WEBHOOK_CONTACT)
  );
}

function urlsForEvent(event) {
  const urls = [];
  const catchAll = trimUrl(process.env.N8N_WEBHOOK_URL);
  if (catchAll) urls.push(catchAll);

  if (event.startsWith('order_')) {
    const u = trimUrl(process.env.N8N_WEBHOOK_ORDER);
    if (u) urls.push(u);
  } else if (event.startsWith('repair_')) {
    const u = trimUrl(process.env.N8N_WEBHOOK_REPAIR);
    if (u) urls.push(u);
  } else if (event.startsWith('contact_')) {
    const u = trimUrl(process.env.N8N_WEBHOOK_CONTACT);
    if (u) urls.push(u);
  } else if (event.startsWith('ad_')) {
    const u = trimUrl(process.env.N8N_WEBHOOK_AD);
    if (u) urls.push(u);
  }

  return [...new Set(urls)];
}

async function postJson(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'AsFix-Gear-n8n/1.0',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[n8n] ${res.status} ${url.slice(0, 48)}… ${text.slice(0, 120)}`);
    }
  } catch (err) {
    console.warn(`[n8n] webhook failed: ${err.message || err}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} event e.g. order_created | repair_created | contact_created
 * @param {Record<string, unknown>} data sanitized payload
 */
export function notifyN8n(event, data = {}) {
  const urls = urlsForEvent(event);
  if (!urls.length) return;

  const payload = {
    source: 'asfixgear',
    event,
    at: new Date().toISOString(),
    data,
  };

  for (const url of urls) {
    postJson(url, payload).catch(() => {});
  }
}

export function notifyN8nOrderCreated(order) {
  if (!order) return;
  notifyN8n('order_created', {
    id: order.id,
    order_id: order.order_id,
    customer_name: order.customer_name || '',
    phone: order.phone || '',
    city: order.city || '',
    payment_mode: order.payment_mode || '',
    fulfillment_method: order.fulfillment_method || '',
    total: order.total ?? order.grand_total ?? null,
    items_count: Array.isArray(order.items) ? order.items.length : 0,
    notes: order.notes || '',
    customer_user_id: order.customer_user_id ?? null,
  });
}

export function notifyN8nRepairCreated(booking) {
  if (!booking) return;
  notifyN8n('repair_created', {
    id: booking.id,
    booking_ref: booking.booking_ref,
    customer_name: booking.customer_name || '',
    phone: booking.phone || '',
    device_brand: booking.device_brand || '',
    device_model: booking.device_model || '',
    issue: booking.issue || '',
    issue_types: booking.issue_types || [],
    status: booking.status || '',
    preferred_date: booking.preferred_date || '',
    customer_user_id: booking.customer_user_id ?? null,
  });
}

export function notifyN8nContactCreated(message) {
  if (!message) return;
  notifyN8n('contact_created', {
    id: message.id,
    name: message.name || '',
    email: message.email || '',
    phone: message.phone || '',
    message:
      typeof message.message === 'string' ? message.message.slice(0, 500) : '',
    customer_user_id: message.customer_user_id ?? null,
  });
}

const REPAIR_DONE_STATUSES = new Set([
  'completed',
  'ready',
  'delivered',
  'picked_up',
  'closed',
]);

/** Status changes — also emits repair_completed when status looks "done". */
export function notifyN8nRepairUpdated(booking, previousStatus = null) {
  if (!booking) return;
  const status = String(booking.status || '').toLowerCase();
  notifyN8n('repair_updated', {
    id: booking.id,
    booking_ref: booking.booking_ref,
    customer_name: booking.customer_name || '',
    phone: booking.phone || '',
    email: booking.email || '',
    device_brand: booking.device_brand || '',
    device_model: booking.device_model || '',
    status: booking.status || '',
    previous_status: previousStatus,
    customer_user_id: booking.customer_user_id ?? null,
  });
  if (REPAIR_DONE_STATUSES.has(status) && previousStatus !== status) {
    notifyN8n('repair_completed', {
      id: booking.id,
      booking_ref: booking.booking_ref,
      customer_name: booking.customer_name || '',
      phone: booking.phone || '',
      email: booking.email || '',
      device_brand: booking.device_brand || '',
      device_model: booking.device_model || '',
      status: booking.status || '',
      customer_user_id: booking.customer_user_id ?? null,
      review_url:
        process.env.SHOP_GOOGLE_REVIEW_URL ||
        'https://www.google.com/maps?q=AsFix+%26+Gear+Lahore',
    });
  }
}

export function notifyN8nAdCreated(payload) {
  if (!payload) return;
  notifyN8n('ad_created', {
    title: payload.title || '',
    price: payload.price || '',
    format: payload.format || 'square',
    image_url: payload.image_url || '',
    caption: payload.caption || '',
  });
}
