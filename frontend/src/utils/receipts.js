import { SHOP, whatsappLink } from '../config/shop';

function formatAmount(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
}

function deliveryLine(city, paymentMode) {
  const isLahore = String(city || '').toLowerCase() === 'lahore';
  if (isLahore) {
    return `${city} (COD via Rider)`;
  }
  const advance = paymentMode && paymentMode !== 'cod' ? 'Advance Payment' : 'Advance Payment';
  return `${city || 'Other City'} - ${advance}`;
}

export function buildOrderReceipt(order) {
  const itemsLine = (order.items || [])
    .map((i) => `${i.name} x${i.qty}`)
    .join(', ');

  const text = [
    '📦 *ASFIX GEAR - ORDER CONFIRMED!*',
    `📋 *Order ID:* #${order.order_id}`,
    `👤 *Customer:* ${order.customer_name} (${order.phone})`,
    `📍 *Delivery City:* ${deliveryLine(order.city, order.payment_mode)}`,
    `🛒 *Items Ordered:* ${itemsLine}`,
    `💰 *Total Amount:* ${formatAmount(order.total_amount)}`,
    '🚚 *Status:* Pending Verification (Our team will dispatch via Bykea/Yango shortly).',
  ].join('\n');

  return { text, waUrl: whatsappLink(text) };
}

export function buildRepairReceipt(booking) {
  const ref = booking.booking_ref || `ASF-R-${1000 + booking.id}`;
  const device = [booking.device_brand, booking.device_model].filter(Boolean).join(' ');
  const est = booking.estimated_repair_time ? `\n⏱ *Est. Time:* ${booking.estimated_repair_time}` : '';

  const lines = [
    '🔧 *ASFIX GEAR - REPAIR INTAKE CONFIRMED!*',
    `📋 *Reference:* #${ref}`,
    `👤 *Customer:* ${booking.customer_name} (${booking.phone})`,
    `📱 *Device:* ${device}`,
    `🛠 *Issue:* ${booking.issue || 'See intake form'}`,
  ];
  if (est) lines.push(est.trim());
  lines.push('🚚 *Status:* Pending Review (Our team will contact you shortly).');

  const text = lines.join('\n');

  return { text, waUrl: whatsappLink(text) };
}

export const ORDER_TIMELINE_STEPS = [
  { key: 'placed', statuses: ['pending', 'payment_verified', 'shipped', 'out_for_delivery', 'delivered'] },
  { key: 'payment_verified', statuses: ['payment_verified', 'shipped', 'out_for_delivery', 'delivered'] },
  { key: 'shipped', statuses: ['shipped', 'out_for_delivery', 'delivered'] },
  { key: 'delivered', statuses: ['delivered'] },
];

export function getTimelineStepIndex(status) {
  if (status === 'delivered') return 3;
  if (status === 'shipped' || status === 'out_for_delivery') return 2;
  if (status === 'payment_verified') return 1;
  return 0;
}
