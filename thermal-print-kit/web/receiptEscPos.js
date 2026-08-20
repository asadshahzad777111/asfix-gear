/**
 * Generic thermal receipt builder (plain text + ESC/POS base64) for the kit.
 *
 * This is a shop-agnostic version of AsFix's receipt builder. Configure your
 * shop header once, then feed it an order object:
 *
 *   import { configureReceipt, buildThermalReceiptText, buildThermalReceiptEscPosBase64 } from './receiptEscPos';
 *   configureReceipt({
 *     shopName: 'MY SHOP',
 *     subtitle: 'Mobile & Accessories',
 *     addressLines: ['Main Bazaar, Lahore'],
 *     phone: '0300-1234567',
 *     qrUrl: 'https://myshop.com',   // optional QR at the bottom
 *   });
 *
 * Order shape (all optional except items):
 *   {
 *     order_id | id, created_at,
 *     items: [{ name, price, qty }],
 *     subtotal, discount_amount, grand_total | total_amount,
 *     payment_mode, customer_name, phone, created_by_staff_name
 *   }
 *
 * The ESC/POS byte sequence is printer-generic (ESC @, alignment, bold,
 * double-size, GS ( k QR, GS V 1 cut) and works with 58mm (32 col) and 80mm
 * (48 col) printers.
 */

let shop = {
  shopName: 'MY SHOP',
  subtitle: 'Receipt',
  addressLines: [],
  phone: '',
  qrUrl: '',
};

export function configureReceipt(next = {}) {
  shop = { ...shop, ...next };
}

const THERMAL_WIDTH_OPTIONS = ['58mm', '80mm'];

export function normalizeThermalWidth(width) {
  return width === '80mm' ? '80mm' : '58mm';
}

function thermalAmountText(amount) {
  return `Rs. ${Math.round(Number(amount || 0))}`;
}

function receiptNumber(order) {
  return order?.order_id || order?.id || 'DRAFT';
}

function paymentLabel(mode) {
  const labels = {
    cash: 'Cash', card: 'Card', jazzcash: 'JazzCash',
    easypaisa: 'EasyPaisa', bank: 'Bank', cod: 'Cash', other: 'Other',
  };
  return labels[mode] || mode || 'Cash';
}

function receiptTotals(order) {
  const subtotal = (order?.items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * (Number(item.qty) || 1),
    0,
  );
  const savedSubtotal = Number(order?.subtotal);
  const savedDiscount = Number(order?.discount_amount);
  const grandTotal = Number(order?.grand_total ?? order?.total_amount ?? subtotal) || 0;
  return {
    subtotal: Number.isFinite(savedSubtotal) ? savedSubtotal : subtotal,
    grandTotal,
    discount: Number.isFinite(savedDiscount)
      ? Math.max(0, savedDiscount)
      : Math.max(0, subtotal - grandTotal),
  };
}

function shortReceiptDateParts(order) {
  if (!order?.created_at) {
    const d = new Date();
    return dateParts(d);
  }
  const d = new Date(order.created_at);
  if (Number.isNaN(d.getTime())) return { date: '-', time: '-' };
  return dateParts(d);
}

function dateParts(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return { date: `${dd}/${mm}/${yy}`, time: `${hh}:${mi}` };
}

function wrapText(text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/** Shared receipt lines with layout metadata used by both text and ESC/POS. */
export function buildReceiptLines(order, maxChars = 32) {
  const { subtotal, discount, grandTotal } = receiptTotals(order);
  const rows = order?.items || [];
  const lines = [];
  const push = (value = '', options = {}) => {
    lines.push({ value: String(value ?? ''), align: 'left', weight: 'normal', ...options });
  };
  const wrap = (value, options = {}) => {
    wrapText(value, options.maxChars || maxChars).forEach((line) => push(line, options));
  };
  const rule = () => push('-'.repeat(maxChars), { align: 'center', rule: true });
  const kv = (label, value, options = {}) => {
    const left = String(label);
    let right = String(value ?? '');
    if (left.length + 1 + right.length > maxChars) {
      right = right.slice(0, Math.max(3, maxChars - left.length - 1));
    }
    const gap = Math.max(1, maxChars - left.length - right.length);
    push(`${left}${' '.repeat(gap)}${right}`, { ...options, columns: { left, right } });
  };
  const money = (label, value, options = {}) => {
    const left = String(label);
    let right = thermalAmountText(value);
    if (left.length + 1 + right.length > maxChars) right = String(Math.round(Number(value || 0)));
    const gap = Math.max(1, maxChars - left.length - right.length);
    push(`${left}${' '.repeat(gap)}${right}`, { ...options, columns: { left, right } });
  };

  const { date: billDate, time: billTime } = shortReceiptDateParts(order);

  push(shop.shopName, { align: 'center', weight: 'bold', title: true });
  if (shop.subtitle) wrap(shop.subtitle, { align: 'center', small: true });
  (shop.addressLines || []).forEach((line) => wrap(line, { align: 'center', small: true }));
  if (shop.phone) wrap(shop.phone, { align: 'center', small: true });
  rule();
  kv('Bill', receiptNumber(order));
  kv('Date', billDate);
  kv('Time', billTime);
  kv('Staff', String(order?.created_by_staff_name || 'Counter').slice(0, 10));
  kv('Pay', paymentLabel(order?.payment_mode));
  kv('Customer', String(order?.customer_name || 'Walk-in').slice(0, maxChars - 10));
  if (order?.phone) kv('Phone', String(order.phone).slice(0, 12));
  rule();

  if (!rows.length) {
    push('No items');
  } else {
    rows.forEach((item) => {
      const qty = Number(item.qty) || 1;
      const unit = Number(item.price) || 0;
      wrap(item.name || 'Item', { weight: 'bold' });
      let left = `${qty}x${Math.round(unit)}`;
      const right = String(Math.round(unit * qty));
      if (left.length + 1 + right.length > maxChars) left = `${qty}x`;
      const gap = Math.max(1, maxChars - left.length - right.length);
      push(`${left}${' '.repeat(gap)}${right}`, { columns: { left, right } });
    });
  }

  rule();
  money('Subtotal', subtotal);
  if (discount) money('Discount', discount);
  money('TOTAL', grandTotal, { grand: true, weight: 'bold', totalLabel: true });
  rule();
  push('Thank you!', { align: 'center', small: true });
  if (shop.qrUrl) {
    push(shop.qrUrl, { align: 'center', qr: true });
    push(String(shop.qrUrl).replace(/^https?:\/\//, ''), { align: 'center', small: true });
  }
  return lines;
}

export function buildThermalReceiptText(order) {
  if (!order) return '';
  return `${buildReceiptLines(order, 18).map((line) => line.value).join('\n')}\n\n`;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Full-width ESC/POS receipt (alignment, bold, double-size, QR, cut) as base64. */
export function buildThermalReceiptEscPosBase64(order, thermalWidth = '58mm') {
  if (!order || typeof TextEncoder === 'undefined' || typeof btoa !== 'function') return '';
  const width = normalizeThermalWidth(thermalWidth);
  const maxChars = width === '80mm' ? 48 : 32;
  const lines = buildReceiptLines(order, maxChars);
  const encoder = new TextEncoder();
  const parts = [];
  const push = (...values) => parts.push(Uint8Array.from(values));
  const text = (value) => parts.push(encoder.encode(String(value ?? '')));

  push(0x1b, 0x40); // ESC @ init
  for (const line of lines) {
    if (line.qr) {
      const qr = encoder.encode(line.value || shop.qrUrl || '');
      const storeLength = qr.length + 3;
      push(0x1b, 0x61, 0x01); // center
      push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00); // model 2
      push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, width === '80mm' ? 7 : 6); // module size
      push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31); // error correction M
      push(0x1d, 0x28, 0x6b, storeLength & 0xff, (storeLength >> 8) & 0xff, 0x31, 0x50, 0x30); // store
      parts.push(qr);
      push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30); // print
      push(0x0a);
      continue;
    }
    push(0x1b, 0x61, line.align === 'center' ? 0x01 : line.align === 'right' ? 0x02 : 0x00);
    push(0x1b, 0x45, line.weight === 'bold' ? 0x01 : 0x00);
    push(0x1b, 0x4d, line.small ? 0x01 : 0x00);
    push(0x1d, 0x21, line.title ? 0x11 : line.grand ? 0x10 : 0x00);
    text(line.value);
    push(0x0a);
    push(0x1d, 0x21, 0x00);
    push(0x1b, 0x4d, 0x00);
  }
  push(0x1b, 0x61, 0x00, 0x1b, 0x45, 0x00);
  push(0x0a, 0x0a, 0x0a);
  push(0x1d, 0x56, 0x01); // GS V 1 partial cut

  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const payload = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.length;
  }
  return bytesToBase64(payload);
}

export { THERMAL_WIDTH_OPTIONS };
