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
  const lines = [
    'NEW ORDER - ASFIX GEAR',
    '---------------------',
    `Order ID: #${order.order_id}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.phone}`,
    `City: ${order.city || '—'}`,
    `Payment: ${order.payment_mode || 'jazzcash'}`,
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
  const lines = [
    'PAYMENT VERIFIED - ASFIX GEAR',
    '---------------------',
    `Order ID: #${order.order_id}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.phone}`,
    ...locationBlock(order.shipping_address),
    '---------------------',
    `Total: ${formatAmount(order.total_amount)}`,
    'Ready for rider assignment.',
  ];
  return lines.join('\n');
}
