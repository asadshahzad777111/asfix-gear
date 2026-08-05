import { SHOP, whatsappLink } from '../config/shop';
import { mergePaymentSettings } from '../config/payments';
import { googleMapsUrl } from './maps';
import { displayAddressLine } from './address';

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
        : paymentMode === 'cod'
          ? 'Cash on Delivery'
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

  let line = `- ${item.name} x${qty} - ${formatAmount(lineSale)}`;
  if (showCost && unitCost > 0) {
    line += ` (cost ${formatAmount(lineCost)}, profit ${formatAmount(lineProfit)})`;
  }
  return line;
}

function shippingLines(order) {
  const addr = order.shipping_address;
  const addressLine = displayAddressLine(addr);
  if (!addressLine) return [];
  const lines = [`Address: ${addressLine}`];
  const map = googleMapsUrl(addr.lat, addr.lng);
  if (map) lines.push(`Map: ${map}`);
  return lines;
}

export function buildOrderReceipt(order, { showCost = false } = {}) {
  const isReturn = order?.source === 'counter_return' || order?.transaction_type === 'return';
  const returnedAmount = Math.max(0, Number(order?.returned_amount) || 0);
  const items = (order.items || []).map((i) => formatItemLine(i, showCost)).join('\n');
  const costNote =
    showCost && Array.isArray(order.items)
      ? (() => {
          const sign = isReturn ? -1 : 1;
          const costTotal = order.items.reduce(
            (sum, i) => sum + (Number(i.cost_price) || 0) * (Number(i.qty) || 1),
            0
          ) * sign;
          const profit = Number(order.total_amount) - costTotal;
          return costTotal !== 0
            ? `\nCost Total: ${formatAmount(costTotal)}\nProfit: ${formatAmount(profit)}`
            : '';
        })()
      : '';

  const pay = mergePaymentSettings();
  const paymentBlock =
    order.payment_mode === 'bank'
      ? [
          'Pay via: Bank Transfer',
          `Bank: ${pay.bank.bankName}`,
          `Account: ${pay.bank.accountName}`,
          `A/C: ${pay.bank.accountNumber}`,
          `IBAN: ${pay.bank.iban}`,
        ].join('\n')
      : order.payment_mode === 'jazzcash' || order.payment_mode === 'easypaisa'
        ? [
            `Pay via: ${order.payment_mode === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'}`,
            `Number: ${pay[order.payment_mode].number}`,
            `Name: ${pay[order.payment_mode].accountName}`,
          ].join('\n')
        : order.payment_mode === 'cod'
          ? 'Pay via: Cash on Delivery (pay rider on delivery)'
          : null;

  const header = isReturn
    ? [
        'ASFIX GEAR - RETURNED BILL',
        '*** THIS BILL IS A RETURN ***',
        order.original_order_ref ? `Of bill: #${order.original_order_ref}` : null,
      ].filter(Boolean)
    : returnedAmount > 0
      ? [
          'ASFIX GEAR - ORDER RECEIPT',
          returnedAmount >= Math.abs(Number(order.total_amount) || 0) - 0.5
            ? '*** THIS BILL WAS RETURNED ***'
            : '*** THIS BILL HAS A RETURN ***',
        ]
      : ['ASFIX GEAR - ORDER RECEIPT'];

  const text = [
    ...header,
    '---------------------',
    `Order ID: #${order.order_id}`,
    `Date: ${order.created_at ? new Date(order.created_at).toLocaleString('en-PK') : '—'}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.phone}`,
    `Delivery: ${deliveryLine(order.city, order.payment_mode)}`,
    ...shippingLines(order),
    ...(paymentBlock ? ['---------------------', paymentBlock] : []),
    '---------------------',
    'Items:',
    items || '—',
    '---------------------',
    `${isReturn ? 'Refund Total' : 'Sale Total'}: ${formatAmount(order.total_amount)}${costNote}`,
    returnedAmount > 0 && !isReturn
      ? `Returned: ${formatAmount(returnedAmount)}\nNet after return: ${formatAmount(
        Number.isFinite(Number(order.net_amount))
          ? Number(order.net_amount)
          : (Number(order.total_amount) || 0) - returnedAmount,
      )}`
      : null,
    `Status: ${order.shipping_status || 'Pending Verification'}`,
    SHOP.name,
  ].filter((line) => line != null).join('\n');

  return { text, waUrl: whatsappLink(text) };
}

export function buildRepairReceipt(booking) {
  const ref = booking.booking_ref || `ASF-R-${1000 + booking.id}`;
  const device = [booking.device_brand, booking.device_model].filter(Boolean).join(' ');
  const est = booking.estimated_repair_time ? `\nEst. Time: ${booking.estimated_repair_time}` : '';

  const lines = [
    'ASFIX GEAR - REPAIR INTAKE CONFIRMED',
    `Reference: #${ref}`,
    `Customer: ${booking.customer_name} (${booking.phone})`,
    `Device: ${device}`,
    `Issue: ${booking.issue || 'See intake form'}`,
  ];
  if (est) lines.push(est.trim());
  lines.push('Status: Pending Review (Our team will contact you shortly).');

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
