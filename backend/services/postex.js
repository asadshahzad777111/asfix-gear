/**
 * PostEx COD courier API (Pakistan).
 * Docs pattern: token header + /services/integration/api/order/v3/create-order
 * Token from merchant.postex.pk → Setting → API / Integration.
 */

const DEFAULT_BASE = 'https://api.postex.pk/services/integration/api/order';

export function isPostExConfigured() {
  return Boolean(String(process.env.POSTEX_TOKEN || '').trim());
}

function baseUrl() {
  return String(process.env.POSTEX_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
}

function token() {
  return String(process.env.POSTEX_TOKEN || '').trim();
}

async function postexFetch(path, { method = 'GET', body } = {}) {
  const t = token();
  if (!t) {
    const err = new Error('PostEx is not configured. Set POSTEX_TOKEN on the server.');
    err.code = 'POSTEX_NOT_CONFIGURED';
    throw err;
  }

  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      token: t,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      data?.statusMessage ||
      data?.message ||
      data?.error ||
      `PostEx HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = 'POSTEX_HTTP';
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  const code = String(data?.statusCode ?? res.status);
  if (code !== '200' && code !== '201') {
    const err = new Error(data?.statusMessage || 'PostEx request failed');
    err.code = 'POSTEX_API';
    err.payload = data;
    throw err;
  }

  return data;
}

/** Normalize PK phone to 03xxxxxxxxx for PostEx. */
export function toPostExPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('92') && digits.length >= 12) return `0${digits.slice(2)}`;
  if (digits.startsWith('0') && digits.length >= 11) return digits.slice(0, 11);
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

export async function listPickupAddresses(cityName = 'Lahore') {
  const city = encodeURIComponent(String(cityName || 'Lahore').trim());
  return postexFetch(`/v1/get-merchant-address?cityName=${city}`, { method: 'GET' });
}

/** Cities PostEx delivers to (for checkout / admin). */
export async function listOperationalCities() {
  return postexFetch('/v2/get-operational-city', { method: 'GET' });
}

/**
 * Book a Normal COD / prepaid shipment.
 * @returns {{ trackingNumber: string, raw: object }}
 */
export async function createOrder(payload) {
  const data = await postexFetch('/v3/create-order', {
    method: 'POST',
    body: payload,
  });
  const trackingNumber =
    data?.dist?.trackingNumber ||
    data?.dist?.trackingNo ||
    data?.trackingNumber ||
    null;
  return { trackingNumber, raw: data };
}

/** Map AsFix order → PostEx create-order body. */
export function buildCreateOrderPayload(order, { pickupAddressCode } = {}) {
  const addr = order.shipping_address || {};
  const name =
    String(addr.name || order.customer_name || order.name || '').trim() || 'Customer';
  const phone = toPostExPhone(addr.phone || order.phone);
  const city = String(addr.city || order.city || 'Lahore').trim() || 'Lahore';
  const address = String(
    addr.text ||
      [addr.line1, addr.line2, addr.area, city].filter(Boolean).join(', ') ||
      order.address ||
      ''
  ).trim();

  if (!phone) {
    const err = new Error('Order has no valid customer phone for PostEx');
    err.code = 'POSTEX_BAD_PHONE';
    throw err;
  }
  if (!address) {
    const err = new Error('Order has no delivery address for PostEx');
    err.code = 'POSTEX_BAD_ADDRESS';
    throw err;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = Math.max(
    1,
    items.reduce((n, it) => n + (Number(it.qty) || Number(it.quantity) || 1), 0)
  );
  const detail =
    items
      .map((it) => `${it.name || 'Item'}×${Number(it.qty) || Number(it.quantity) || 1}`)
      .join(', ')
      .slice(0, 480) || `AsFix order #${order.order_id || order.id}`;

  const isCod = String(order.payment_mode || '').toLowerCase() === 'cod';
  const codAmount = isCod ? Math.max(0, Math.round(Number(order.total_amount) || 0)) : 0;

  const pickup =
    pickupAddressCode ||
    String(process.env.POSTEX_PICKUP_ADDRESS_CODE || '').trim() ||
    undefined;

  const body = {
    orderRefNumber: String(order.order_id || order.id),
    invoicePayment: String(codAmount),
    orderDetail: detail,
    customerName: name.slice(0, 120),
    customerPhone: phone,
    deliveryAddress: address.slice(0, 250),
    cityName: city,
    invoiceDivision: 1,
    items: itemCount,
    orderType: 'Normal',
  };
  if (pickup) body.pickupAddressCode = pickup;
  return body;
}
