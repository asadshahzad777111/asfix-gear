import { SHOP, whatsappLink } from '../config/shop';

function formatAmount(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
}

function deliveryLine(city, paymentMode) {
  const mode = paymentMode === 'jazzcash'
    ? 'JazzCash'
    : paymentMode === 'easypaisa'
      ? 'EasyPaisa'
      : paymentMode === 'bank'
        ? 'Bank Transfer'
        : 'Advance Payment';
  return `${city || 'Other City'} — ${mode}`;
}

function formatItemLine(item, showCost) {
  const qty = Number(item.qty) || 1;
  const unitSale = Number(item.price) || 0;
  const lineSale = unitSale * qty;
  const unitCost = Number(item.cost_price) || 0;
  const lineCost = unitCost * qty;
  const lineProfit = lineSale - lineCost;

  let line = `• ${item.name} ×${qty} — ${formatAmount(lineSale)}`;
  if (showCost && unitCost > 0) {
    line += ` (asal ${formatAmount(lineCost)}, profit ${formatAmount(lineProfit)})`;
  }
  return line;
}

export function buildOrderReceipt(order, { showCost = false } = {}) {
  const items = (order.items || []).map((i) => formatItemLine(i, showCost)).join('\n');
  const costNote =
    showCost && Array.isArray(order.items)
      ? (() => {
          const costTotal = order.items.reduce(
            (sum, i) => sum + (Number(i.cost_price) || 0) * (Number(i.qty) || 1),
            0
          );
          const profit = Number(order.total_amount) - costTotal;
          return costTotal > 0
            ? `\n📊 *Cost Total:* ${formatAmount(costTotal)}\n💹 *Profit:* ${formatAmount(profit)}`
            : '';
        })()
      : '';

  const text = [
    '📦 *ASFIX GEAR — ORDER RECEIPT*',
    '─────────────────────',
    `📋 *Order ID:* #${order.order_id}`,
    `📅 *Date:* ${order.created_at ? new Date(order.created_at).toLocaleString('en-PK') : '—'}`,
    `👤 *Customer:* ${order.customer_name}`,
    `📞 *Phone:* ${order.phone}`,
    `📍 *Delivery:* ${deliveryLine(order.city, order.payment_mode)}`,
    '─────────────────────',
    '*Items*',
    items || '—',
    '─────────────────────',
    `💰 *Sale Total:* ${formatAmount(order.total_amount)}${costNote}`,
    `🚚 *Status:* ${order.shipping_status || 'Pending Verification'}`,
    `🏪 ${SHOP.name}`,
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
