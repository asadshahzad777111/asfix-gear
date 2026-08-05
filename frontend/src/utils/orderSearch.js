/** Client-side order search — name, phone, product, order id (ASF-1001 / ASF1001 / ASF101 / 1001). */

/** Normalize "# ASF - 1043" / "ASF 1043" → "asf-1043" before token split. */
export function normalizeOrderSearchQuery(query) {
  let q = String(query || '').trim();
  q = q.replace(/#/g, ' ');
  q = q.replace(/\basf\b\s*[-–—]?\s*(\d+)/gi, 'asf-$1');
  q = q.replace(/\s+/g, ' ').trim();
  return q;
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function compactId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-token match so "1" does not hit inside "1002". */
function haystackHasToken(haystack, token) {
  const t = String(token || '').trim().toLowerCase();
  if (!t) return false;
  if (t.length <= 2) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}(?:$|[^a-z0-9])`).test(haystack);
  }
  return haystack.includes(t);
}

/**
 * Build candidate id shapes from a search token.
 * ASF-1001 / ASF1001 / 1001 → order id ASF-1001 (internal id 1)
 * ASF101 → also try ASF-1001 (common missing-zero typing)
 */
function parseOrderIdCandidates(token) {
  const raw = String(token || '').trim().replace(/[#\s]/g, '');
  const m = raw.match(/^(?:asf-?)?(\d+)$/i);
  if (!m) return [];

  const num = m[1];
  const n = Number(num);
  if (!Number.isFinite(n)) return [];
  const hasAsfPrefix = /^asf/i.test(raw);

  const candidates = [
    {
      digits: num,
      compact: `asf${num}`,
      hyphen: `asf-${num}`,
      /* ASF-1001 → internal id 1 (only for 4+ digit public numbers) */
      internalId: n >= 1000 ? String(n - 1000) : null,
      /* "101" may mean internal id; "ASF101" means slip number, not id 101 */
      matchInternalDirect: !hasAsfPrefix,
    },
  ];

  /* Short ASF101 / 101 → also try ASF-1001 (common missing-zero typing) */
  if (num.length >= 2 && num.length <= 3) {
    const asf10xx = `10${num.slice(-2)}`;
    candidates.push({
      digits: asf10xx,
      compact: `asf${asf10xx}`,
      hyphen: `asf-${asf10xx}`,
      internalId: String(Number(asf10xx) - 1000),
      matchInternalDirect: false,
    });
  }

  return candidates;
}

function orderMatchesIdCandidate(order, parsed) {
  if (!parsed) return false;
  const orderId = String(order?.order_id || '').toLowerCase();
  const compact = compactId(orderId);
  if (compact === parsed.compact || orderId === parsed.hyphen) return true;
  if (parsed.matchInternalDirect && String(order?.id) === parsed.digits) return true;
  if (parsed.internalId != null && String(order?.id) === parsed.internalId) {
    return parsed.digits.length >= 4;
  }
  return false;
}

function orderMatchesIdQuery(order, token) {
  return parseOrderIdCandidates(token).some((c) => orderMatchesIdCandidate(order, c));
}

function orderMatchesPhoneQuery(order, token) {
  const q = digitsOnly(token);
  if (q.length < 7) return false;
  const candidates = [
    digitsOnly(order?.phone),
    digitsOnly(order?.shipping_address?.phone),
  ].filter(Boolean);

  return candidates.some((phone) => {
    if (phone.includes(q) || q.includes(phone)) return true;
    const norm = (p) => {
      if (p.startsWith('92') && p.length >= 12) return `0${p.slice(2)}`;
      if (p.startsWith('0') && p.length >= 11) return `92${p.slice(1)}`;
      return p;
    };
    return norm(phone) === norm(q) || phone.endsWith(q.slice(-10)) || q.endsWith(phone.slice(-10));
  });
}

function orderHaystack(order) {
  const parts = [
    order?.order_id,
    order?.id,
    order?.customer_name,
    order?.phone,
    order?.city,
    order?.gmail,
    order?.payment_mode,
    order?.payment_status,
    order?.shipping_status,
    order?.notes,
    ...(order?.items || []).map((item) => `${item.name} ${item.qty || 1}`),
    order?.shipping_address?.text,
    order?.shipping_address?.name,
    order?.shipping_address?.phone,
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function filterOrders(orders, query) {
  if (!Array.isArray(orders)) return [];
  const q = normalizeOrderSearchQuery(query).toLowerCase();
  if (!q) return orders;

  const tokens = q.split(/\s+/).filter(Boolean);

  return orders.filter((order) => {
    const haystack = orderHaystack(order);
    return tokens.every((token) => {
      const cleaned = String(token).replace(/[#\s]/g, '');
      /* Order-number tokens only (not phone). Avoid qty "1" false hits in haystack. */
      const idLike =
        /^(?:asf-?)\d+$/i.test(cleaned) ||
        (/^\d+$/.test(cleaned) && cleaned.length <= 6);
      if (idLike) return orderMatchesIdQuery(order, token);
      if (orderMatchesPhoneQuery(order, token)) return true;
      return haystackHasToken(haystack, token);
    });
  });
}

export function isPaymentVerified(order) {
  if (!order) return false;
  if (order.payment_status === 'payment_verified' || order.payment_status === 'paid') return true;
  const status = order.shipping_status;
  return ['payment_verified', 'shipped', 'out_for_delivery', 'delivered'].includes(status);
}
