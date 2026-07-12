/**
 * Plain-ASCII WhatsApp order alerts for shop staff.
 * Avoid emoji / special Unicode — some clients render them as broken chars.
 */

function formatAmount(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
}

function mapsLink(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return `https://www.google.com/maps?q=${la},${ln}`;
}

function locationBlock(shippingAddress) {
  if (!shippingAddress?.text) return [];
  const lines = [`Delivery location: ${shippingAddress.text}`];
  const map = mapsLink(shippingAddress.lat, shippingAddress.lng);
  if (map) lines.push(`Map: ${map}`);
  return lines;
}

function itemLines(items) {
  return (items || []).map((item) => {
    const qty = Number(item.qty) || 1;
    const line = Number(item.price || 0) * qty;
    return `- ${item.name} x${qty} - ${formatAmount(line)}`;
  });
}

/** New order placed — notify shop with delivery pin. */
export function buildNewOrderShopMessage(order) {
  const pay =
    order.payment_mode === 'cod'
      ? 'COD (Cash on Delivery)'
      : order.payment_mode || 'jazzcash';
  const lines = [
    'NEW ORDER - ASFIX GEAR',
    '---------------------',
    `Order ID: #${order.order_id}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.phone}`,
    `City: ${order.city || '—'}`,
    `Payment: ${pay}`,
    ...locationBlock(order.shipping_address),
    '---------------------',
    'Items:',
    ...itemLines(order.items),
    '---------------------',
    `Total: ${formatAmount(order.total_amount)}`,
    `Status: ${order.shipping_status || 'pending'}`,
  ];
  return lines.join('\n');
}

/** Payment verified — ready for rider; include location for dispatch. */
export function buildPaidOrderShopMessage(order) {
  const isCod = order.payment_mode === 'cod';
  const lines = [
    isCod ? 'COD CONFIRMED - ASFIX GEAR' : 'PAYMENT VERIFIED - ASFIX GEAR',
    '---------------------',
    `Order ID: #${order.order_id}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.phone}`,
    `Payment: ${isCod ? 'COD' : order.payment_mode || '—'}`,
    ...locationBlock(order.shipping_address),
    '---------------------',
    `Total: ${formatAmount(order.total_amount)}`,
    'Ready for rider assignment.',
  ];
  return lines.join('\n');
}

/** Customer WhatsApp — order placed or status change (plain ASCII). */
export function buildOrderStatusCustomerMessage(order, status) {
  const name = order.customer_name || 'Customer';
  const orderId = order.order_id || order.id;
  const total = formatAmount(order.total_amount);
  const isCod = String(order.payment_mode || '').toLowerCase() === 'cod';

  if (status === 'placed') {
    const pay = isCod
      ? 'Cash on Delivery — delivery par cash ready rakhein.'
      : `Payment: ${order.payment_mode || 'advance'} — Order ID transfer note mein likhein.`;
    return [
      `Assalam o Alaikum ${name}!`,
      `AsFix & Gear — aapka order #${orderId} receive ho gaya.`,
      `Total: ${total}`,
      pay,
      'Track: asfixgear.com/track',
      'WhatsApp help: 03039227000',
    ].join('\n');
  }

  const messages = {
    payment_verified: isCod
      ? `Assalam o Alaikum ${name}! Order #${orderId} COD confirm — dispatch ke liye ready. Track: asfixgear.com/track`
      : `Assalam o Alaikum ${name}! Order #${orderId} payment verify ho gayi. Jaldi dispatch. Track: asfixgear.com/track`,
    shipped: `Assalam o Alaikum ${name}! Order #${orderId} ship ho gaya. Track: asfixgear.com/track`,
    out_for_delivery: `Assalam o Alaikum ${name}! Order #${orderId} ab out for delivery hai${isCod ? ' — cash ready rakhein' : ''}. Track: asfixgear.com/track`,
    cancelled: `Assalam o Alaikum ${name}. Order #${orderId} cancel ho gaya. Sawal ho to WhatsApp 03039227000.`,
  };

  return messages[status] || null;
}
