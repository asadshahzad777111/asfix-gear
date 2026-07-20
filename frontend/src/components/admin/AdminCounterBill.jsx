import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, formatPrice } from '../../api/client';
import { SHOP } from '../../config/shop';
import { useAuth } from '../../context/AuthContext';
import { getDefaultImage } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import './admin-counter-bill.css';

const COUNTER_BILL_DRAFT_KEY = 'asfix_counter_bill_draft_v1';
const HELD_BILLS_KEY = 'asfix_counter_held_bills_v1';
export const THERMAL_RECEIPT_WIDTH_KEY = 'asfix_counter_thermal_width_v1';
const ALL_CATEGORIES = 'all';
const PAYMENT_OPTIONS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'easypaisa', label: 'EasyPaisa' },
  { id: 'jazzcash', label: 'JazzCash' },
];
const THERMAL_WIDTH_OPTIONS = ['58mm', '80mm'];
const RECEIPT_SITE = 'asfixgear.com';
const THERMAL_PAGE_STYLE_ID = 'thermal-page-size';
const PRINT_ROOT_ID = 'counter-receipt-print-root';
const DEFAULT_POS_SETTINGS = {
  posReturnWindowHours: 24,
  posDiscountMaxPercentWithoutPin: 10,
  posDiscountMaxAmountWithoutPin: 500,
};
const MAX_HELD_BILLS = 5;

export function readThermalReceiptWidth() {
  if (typeof window === 'undefined') return '58mm';
  try {
    const width = window.localStorage.getItem(THERMAL_RECEIPT_WIDTH_KEY);
    return THERMAL_WIDTH_OPTIONS.includes(width) ? width : '58mm';
  } catch {
    return '58mm';
  }
}

function writeThermalReceiptWidth(width) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THERMAL_RECEIPT_WIDTH_KEY, width);
  } catch {
    // Local storage is a convenience only; the current React state still applies.
  }
}

function readCounterBillDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(COUNTER_BILL_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return {
      ...draft,
      lines: Array.isArray(draft.lines) ? draft.lines : [],
    };
  } catch {
    return null;
  }
}

function writeCounterBillDraft(draft) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(COUNTER_BILL_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable in private mode; React state still protects this session.
  }
}

function clearCounterBillDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(COUNTER_BILL_DRAFT_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function readHeldBills() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(HELD_BILLS_KEY);
    const held = raw ? JSON.parse(raw) : [];
    return Array.isArray(held) ? held.filter((entry) => Array.isArray(entry.lines)) : [];
  } catch {
    return [];
  }
}

function writeHeldBills(heldBills) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(HELD_BILLS_KEY, JSON.stringify(heldBills.slice(0, MAX_HELD_BILLS)));
  } catch {
    // Held bills are a session convenience only.
  }
}

function salePrice(product) {
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) return 0;
  const discount = Math.min(90, Math.max(0, Number(product.discount_percent) || 0));
  return Math.round(price * (1 - discount / 100));
}

function matchesQuery(product, query) {
  const term = query.trim().toLowerCase();
  if (!term) return false;
  return [
    product.name,
    product.brand,
    product.model,
    product.model_name,
    product.compatible_models,
    String(product.id),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term);
}

function paymentLabel(mode) {
  const labels = {
    cash: 'Cash',
    card: 'Card',
    jazzcash: 'JazzCash',
    easypaisa: 'EasyPaisa',
    bank: 'Bank',
    cod: 'Cash',
    other: 'Other',
  };
  return labels[mode] || mode;
}

function counterPaymentNote(order) {
  return String(order?.notes || '').startsWith('Counter sale payment note:')
    ? String(order.notes).replace('Counter sale payment note:', '').trim()
    : '';
}

function receiptTotals(order) {
  const subtotal = (order?.items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * (Number(item.qty) || 1),
    0
  );
  const savedSubtotal = Number(order?.subtotal);
  const savedDiscount = Number(order?.discount_amount);
  const grandTotal = Number(order?.grand_total ?? order?.total_amount ?? subtotal) || 0;
  return {
    subtotal: Number.isFinite(savedSubtotal) ? savedSubtotal : subtotal,
    grandTotal,
    discount: Number.isFinite(savedDiscount) ? Math.max(0, savedDiscount) : Math.max(0, subtotal - grandTotal),
  };
}

function clampDiscountAmount({ subtotal, type, value }) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0 || subtotal <= 0) return 0;
  if (type === 'percent') {
    return Math.min(subtotal, Math.round((subtotal * Math.min(100, raw)) / 100));
  }
  return Math.min(subtotal, Math.round(raw));
}

function receiptNumber(order) {
  return order?.order_id || order?.id || 'DRAFT';
}

function receiptFilename(order) {
  return `asfix-${String(receiptNumber(order)).replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-invoice.pdf`;
}

function amountText(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

/** Compact amount for 58mm thermal — short, but with a space after Rs for clarity. */
function thermalAmountText(amount) {
  return `Rs. ${Math.round(Number(amount || 0))}`;
}

function buildThermalReceiptText(order) {
  if (!order) return '';
  /* Fewer chars/line → larger glyphs on paper (sample AS FIX bill size) */
  return `${buildReceiptLines(order, 20).map((line) => line.value).join('\n')}\n\n`;
}

/** Mate Technologies "Bluetooth Thermal Printer" (Thermer) — package mate.bluetoothprint */
const MATE_THERMAL_PACKAGE = 'mate.bluetoothprint';

function mateThermalTextHref(order) {
  const text = buildThermalReceiptText(order);
  return (
    `intent:#Intent;action=android.intent.action.SEND;type=text/plain;`
    + `package=${MATE_THERMAL_PACKAGE};`
    + `S.android.intent.extra.TEXT=${encodeURIComponent(text)};end`
  );
}

function openMateThermalText(order) {
  if (!order || typeof window === 'undefined' || typeof document === 'undefined') return false;
  const anchor = document.createElement('a');
  anchor.href = mateThermalTextHref(order);
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapPdfText(text, maxChars) {
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

function pdfPointsFromMillimeters(mm) {
  return (Number(mm) || 58) * 72 / 25.4;
}

function normalizeThermalWidth(thermalWidth) {
  return thermalWidth === '80mm' ? '80mm' : '58mm';
}

function approximatePdfTextWidth(value, size) {
  return String(value ?? '').length * size * 0.56;
}

/** Shared receipt lines — big POS size matching AS FIX & GEAR BILL sample. */
function shortReceiptDate(order) {
  if (!order?.created_at) return '-';
  const d = new Date(order.created_at);
  if (Number.isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function buildReceiptLines(order, maxChars = 20) {
  const { subtotal, discount, grandTotal } = receiptTotals(order);
  const rows = order?.items || [];
  const lines = [];
  const push = (value = '', options = {}) => {
    lines.push({
      value: String(value ?? ''),
      align: 'left',
      weight: 'normal',
      ...options,
    });
  };
  const wrap = (value, options = {}) => {
    wrapPdfText(value, options.maxChars || maxChars).forEach((line) => push(line, options));
  };
  const rule = () => push('-'.repeat(maxChars), { align: 'center', rule: true });
  const kv = (label, value, options = {}) => {
    const left = String(label);
    let right = String(value ?? '');
    if (left.length + 1 + right.length > maxChars) {
      right = right.slice(0, Math.max(3, maxChars - left.length - 1));
    }
    const gap = Math.max(1, maxChars - left.length - right.length);
    push(`${left}${' '.repeat(gap)}${right}`, {
      ...options,
      columns: { left, right },
    });
  };
  const money = (label, value, options = {}) => {
    let right = thermalAmountText(value);
    const left = String(label);
    if (left.length + 1 + right.length > maxChars) {
      right = String(Math.round(Number(value || 0)));
    }
    const gap = Math.max(1, maxChars - left.length - right.length);
    push(`${left}${' '.repeat(gap)}${right}`, {
      ...options,
      columns: { left, right },
    });
  };

  /* Sample style header — short lines so glyphs stay LARGE */
  push('AS FIX & GEAR', { align: 'center', weight: 'bold', title: true });
  push('BILL', { align: 'center', weight: 'bold', title: true });
  wrap('Mobile Repair', { align: 'center', small: true });
  wrap(SHOP.addressLine2, { align: 'center', small: true });
  wrap(SHOP.phone, { align: 'center', small: true });
  rule();
  kv('Bill', receiptNumber(order));
  kv('Date', shortReceiptDate(order));
  kv('Staff', (order?.created_by_staff_name || 'Counter').slice(0, 12));
  kv('Pay', paymentLabel(order?.payment_mode));
  kv('Cust', (order?.customer_name || 'Walk-in').slice(0, 12));
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
      let right = String(Math.round(unit * qty));
      if (left.length + 1 + right.length > maxChars) {
        left = `${qty}x`;
        right = String(Math.round(unit * qty));
      }
      const gap = Math.max(1, maxChars - left.length - right.length);
      push(`${left}${' '.repeat(gap)}${right}`, { columns: { left, right } });
    });
  }

  rule();
  money('Subtotal', subtotal);
  if (discount) money('Discount', discount);
  rule();
  push('TOTAL AMOUNT', { align: 'center', weight: 'bold', totalLabel: true });
  push(thermalAmountText(grandTotal), { align: 'center', weight: 'bold', grand: true });
  const note = counterPaymentNote(order);
  if (note) wrap(`Note: ${note}`, { small: true });
  rule();
  push('Thank You', { align: 'center', weight: 'bold' });
  push(RECEIPT_SITE, { align: 'center', weight: 'bold', small: true });
  return lines;
}

/**
 * BIG thermal PNG — glyph size fills ~20 columns like the sample AS FIX bill.
 * Does NOT shrink the whole slip for one long line (wrap/truncate instead).
 */
export async function createCounterReceiptPngBlob(order, thermalWidth = '58mm') {
  const pageWidth = normalizeThermalWidth(thermalWidth);
  const baseWidth = pageWidth === '80mm' ? 576 : 384;
  const scale = 4;
  const widthPx = baseWidth * scale;
  const maxChars = pageWidth === '80mm' ? 28 : 20;
  const padX = Math.round(widthPx * 0.07);
  const padY = Math.round(18 * scale);
  const lines = buildReceiptLines(order, maxChars);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const usable = widthPx - padX * 2;
  const fontStack = '"Courier New", Courier, monospace';

  const setFont = (size) => {
    ctx.font = `bold ${size}px ${fontStack}`;
  };

  const letterGapFor = (size) => Math.max(4, Math.round(size * 0.1));

  const measureSpaced = (text, size) => {
    setFont(size);
    const letterGap = letterGapFor(size);
    const chars = Array.from(String(text ?? ''));
    if (!chars.length) return 0;
    let width = 0;
    chars.forEach((ch, index) => {
      width += ctx.measureText(ch).width;
      if (index < chars.length - 1) width += letterGap;
    });
    return width;
  };

  /* Size so maxChars columns fill the paper — this is the sample “bara size”. */
  let fontSize = Math.floor(usable / (maxChars * 0.62));
  const minFont = Math.round(usable / (maxChars * 0.78));
  while (fontSize > minFont && measureSpaced('M'.repeat(maxChars), fontSize) > usable) {
    fontSize -= 1;
  }
  /* Prefer filling width: bump up if still loose */
  while (measureSpaced('M'.repeat(maxChars), fontSize + 1) <= usable) {
    fontSize += 1;
  }

  const lineSize = (line, base) => {
    if (line.grand) return Math.round(base * 1.7);
    if (line.totalLabel) return Math.round(base * 1.15);
    if (line.title) return Math.round(base * 1.2);
    if (line.small) return Math.max(minFont, Math.round(base * 0.82));
    if (line.rule) return Math.max(minFont, Math.round(base * 0.9));
    return base;
  };

  const fitSize = (text, preferred) => {
    let size = preferred;
    const floor = Math.max(10 * scale, Math.round(preferred * 0.7));
    while (size > floor && measureSpaced(text, size) > usable) size -= 1;
    return size;
  };

  const lineH = Math.ceil(fontSize * 1.85);
  let heightPx = padY * 2 + 10 * scale;
  lines.forEach((line) => {
    const size = lineSize(line, fontSize);
    if (line.grand) heightPx += Math.ceil(size * 1.4) + 8 * scale;
    else if (line.totalLabel) heightPx += Math.ceil(lineH * 1.05) + 4 * scale;
    else if (line.title) heightPx += lineH + 4 * scale;
    else if (line.rule) heightPx += Math.ceil(lineH * 0.7);
    else heightPx += lineH;
  });

  canvas.width = widthPx;
  canvas.height = heightPx;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.imageSmoothingEnabled = false;

  const drawSpacedText = (text, anchorX, y, size, align = 'left') => {
    const fitted = fitSize(text, size);
    setFont(fitted);
    const letterGap = letterGapFor(fitted);
    const chars = Array.from(String(text ?? ''));
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const totalW = widths.reduce((sum, w, i) => sum + w + (i < widths.length - 1 ? letterGap : 0), 0);

    let x = anchorX;
    if (align === 'center') x = anchorX - totalW / 2;
    if (align === 'right') x = anchorX - totalW;
    if (x < padX) x = padX;
    if (x + totalW > widthPx - padX) x = Math.max(padX, widthPx - padX - totalW);

    ctx.lineWidth = Math.max(3, Math.round(scale * 1.4));
    ctx.lineJoin = 'round';

    let cursor = x;
    chars.forEach((ch, index) => {
      ctx.strokeText(ch, cursor, y);
      ctx.fillText(ch, cursor, y);
      cursor += widths[index] + letterGap;
    });
    return fitted;
  };

  let y = padY;
  lines.forEach((line) => {
    const size = lineSize(line, fontSize);

    if (line.columns) {
      let rightSize = size;
      const colGap = 14 * scale;
      const leftW = measureSpaced(line.columns.left, size);
      let rightW = measureSpaced(line.columns.right, rightSize);
      while (leftW + colGap + rightW > usable && rightSize > minFont) {
        rightSize -= 2;
        rightW = measureSpaced(line.columns.right, rightSize);
      }
      drawSpacedText(line.columns.left, padX, y, size, 'left');
      drawSpacedText(line.columns.right, widthPx - padX, y, rightSize, 'right');
      y += lineH;
    } else {
      const align = line.align === 'center' ? 'center' : line.align === 'right' ? 'right' : 'left';
      const anchor = align === 'center'
        ? widthPx / 2
        : align === 'right'
          ? widthPx - padX
          : padX;
      drawSpacedText(line.value, anchor, y, size, align);
      if (line.grand) y += Math.ceil(size * 1.4) + 8 * scale;
      else if (line.totalLabel) y += Math.ceil(lineH * 1.05) + 4 * scale;
      else if (line.title) y += lineH + 4 * scale;
      else if (line.rule) y += Math.ceil(lineH * 0.7);
      else y += lineH;
    }
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))),
      'image/png',
      1
    );
  });
}

export function createCounterInvoicePdfBlob(order, thermalWidth = '58mm') {
  const pageWidth = normalizeThermalWidth(thermalWidth);
  const widthMm = pageWidth === '80mm' ? 80 : 58;
  const width = pdfPointsFromMillimeters(widthMm);
  /* Near-zero margins — content must span the full MediaBox */
  const marginX = pdfPointsFromMillimeters(0.8);
  const marginTop = pdfPointsFromMillimeters(1.2);
  const marginBottom = pdfPointsFromMillimeters(1.2);
  const maxChars = pageWidth === '80mm' ? 28 : 20;
  const bodySize = pageWidth === '80mm' ? 12 : 11;
  const bodyLeading = pageWidth === '80mm' ? 16 : 15;
  const receiptLines = buildReceiptLines(order, maxChars).map((line) => ({
    value: line.value,
    size: line.title ? bodySize + 3 : line.small ? bodySize - 0.5 : bodySize,
    leading: line.title ? bodyLeading + 3 : bodyLeading,
    align: line.align || 'left',
    font: line.weight === 'bold' || line.title ? 'F2' : 'F1',
  }));

  const height = Math.ceil(
    marginTop + marginBottom + receiptLines.reduce((sum, line) => sum + line.leading, 0)
  );
  const commands = [];

  const text = (value, x, y, size = 10, font = 'F1', fill = '0.08 0.08 0.08 rg') => {
    commands.push(`BT /${font} ${size} Tf ${fill} ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
  };

  let y = height - marginTop;
  receiptLines.forEach((line) => {
    y -= line.leading;
    const lineWidth = approximatePdfTextWidth(line.value, line.size);
    const x = line.align === 'center'
      ? Math.max(marginX, (width - lineWidth) / 2)
      : line.align === 'right'
        ? Math.max(marginX, width - marginX - lineWidth)
        : marginX;
    text(line.value, x.toFixed(2), y.toFixed(2), line.size, line.font, '0 0 0 rg');
  });

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /CropBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function waitForNextPaint() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isAndroidDevice() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
}

/** True 58/80mm receipt document — NEVER A4 (A4→thermal scales to a tiny center strip). */
function buildThermalReceiptHtml(order, thermalWidth = '58mm') {
  const widthMm = thermalWidth === '80mm' ? 80 : 58;
  const { subtotal, discount, grandTotal } = receiptTotals(order);
  const paymentNote = counterPaymentNote(order);
  const items = (order?.items || []).map((item) => {
    const qty = Number(item.qty) || 1;
    const unit = Number(item.price) || 0;
    return `<div class="r-item">
      <strong>${escapeHtml(item.name || 'Item')}</strong>
      <div class="r-row"><span>${qty}x${Math.round(unit)}</span><b>${Math.round(unit * qty)}</b></div>
    </div>`;
  }).join('');

  const css = `
@page { size: ${widthMm}mm auto; margin: 0; }
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: ${widthMm}mm !important;
  max-width: ${widthMm}mm !important;
  background: #fff !important;
  color: #000 !important;
}
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.receipt {
  width: ${widthMm}mm !important;
  max-width: ${widthMm}mm !important;
  margin: 0 !important;
  padding: 3.5mm 3mm !important;
  font-family: "Courier New", Courier, monospace !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  line-height: 1.6 !important;
  letter-spacing: 0.08em !important;
}
.r-shop { text-align: center; margin-bottom: 7px; }
.r-shop h1 { margin: 0 0 2px; font-size: 18px; font-weight: 900; letter-spacing: 0.1em; }
.r-shop .r-bill { margin: 0 0 5px; font-size: 16px; font-weight: 900; letter-spacing: 0.12em; }
.r-shop p { margin: 2px 0; font-size: 12px; letter-spacing: 0.06em; }
.r-meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 7px 0; font-size: 14px; }
.r-meta span:last-child { text-align: right; }
.r-rule { border: 0; border-top: 1px dashed #000; margin: 7px 0; }
.r-item { margin: 0 0 7px; }
.r-item strong { display: block; font-size: 14px; letter-spacing: 0.07em; }
.r-row { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.r-totals { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; font-size: 14px; }
.r-totals > * { min-width: 0; }
.r-totals strong { text-align: right; white-space: nowrap; }
.r-grand-wrap { text-align: center; margin: 10px 0 6px; }
.r-grand-label { display: block; font-size: 15px; font-weight: 900; letter-spacing: 0.1em; }
.r-grand { display: block; font-size: 24px; font-weight: 900; letter-spacing: 0.12em; margin-top: 5px; }
.r-thanks, .r-site { text-align: center; margin: 6px 0 0; font-size: 13px; font-weight: 700; }
`.trim();

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=${widthMm}, initial-scale=1" />
<title>AsFix ${escapeHtml(receiptNumber(order))}</title>
<style>${css}</style></head><body>
<main class="receipt">
  <div class="r-shop">
    <h1>AS FIX &amp; GEAR</h1>
    <p class="r-bill">BILL</p>
    <p>Mobile Repair</p>
    <p>${escapeHtml(SHOP.addressLine2)}</p>
    <p>${escapeHtml(SHOP.phone)}</p>
  </div>
  <hr class="r-rule" />
  <div class="r-meta">
    <span>Bill</span><span>${escapeHtml(receiptNumber(order))}</span>
    <span>Date</span><span>${escapeHtml(order?.created_at ? (() => {
      const d = new Date(order.created_at);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yy} ${hh}:${mi}`;
    })() : '-')}</span>
    <span>Staff</span><span>${escapeHtml((order?.created_by_staff_name || 'Counter').slice(0, 12))}</span>
    <span>Pay</span><span>${escapeHtml(paymentLabel(order?.payment_mode))}${paymentNote ? ` (${escapeHtml(paymentNote)})` : ''}</span>
    <span>Cust</span><span>${escapeHtml((order?.customer_name || 'Walk-in').slice(0, 12))}</span>
    ${order?.phone ? `<span>Phone</span><span>${escapeHtml(String(order.phone).slice(0, 12))}</span>` : ''}
  </div>
  <hr class="r-rule" />
  ${items || '<div class="r-item">No items</div>'}
  <hr class="r-rule" />
  <div class="r-totals">
    <span>Subtotal</span><strong>${escapeHtml(thermalAmountText(subtotal))}</strong>
    ${discount ? `<span>Discount</span><strong>${escapeHtml(thermalAmountText(discount))}</strong>` : ''}
  </div>
  <hr class="r-rule" />
  <div class="r-grand-wrap">
    <span class="r-grand-label">TOTAL AMOUNT</span>
    <strong class="r-grand">${escapeHtml(thermalAmountText(grandTotal))}</strong>
  </div>
  <hr class="r-rule" />
  <p class="r-thanks">Thank You</p>
  <p class="r-site">${escapeHtml(RECEIPT_SITE)}</p>
</main>
</body></html>`;
}

function finishPrintJob(inFlightRef) {
  document.getElementById(THERMAL_PAGE_STYLE_ID)?.remove();
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.body.classList.remove('counter-receipt-printing', 'receipt-thermal-80mm');
  if (inFlightRef) inFlightRef.current = false;
}

/** Same-origin iframe print — no popup, no PDF download. */
function printViaIframe(html, inFlightRef) {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  const iframe = document.createElement('iframe');
  iframe.id = PRINT_ROOT_ID;
  iframe.title = 'AsFix 58mm receipt';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    finishPrintJob(inFlightRef);
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    finishPrintJob(inFlightRef);
    return false;
  }

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    try { iframe.remove(); } catch { /* ignore */ }
    finishPrintJob(inFlightRef);
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 90_000);

  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  }, 200);
  return true;
}

const PRINT_COOLDOWN_MS = 5000;
let lastPrintKey = '';
let lastPrintAt = 0;

function claimPrintSlot(order) {
  const key = receiptNumber(order);
  const now = Date.now();
  if (key && key === lastPrintKey && now - lastPrintAt < PRINT_COOLDOWN_MS) {
    return false;
  }
  lastPrintKey = key;
  lastPrintAt = now;
  return true;
}

function receiptPngFilename(order) {
  return `asfix-receipt-${receiptNumber(order)}.png`;
}

/**
 * Print for BT800S 58mm thermal:
 * - Android → Mate "Bluetooth Thermal Printer" (PNG share, then text intent)
 * - Other → isolated 58mm HTML iframe print
 */
export async function printActiveCounterReceipt({
  thermalWidth = '58mm',
  inFlightRef,
  order = null,
} = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (inFlightRef?.current) return false;
  if (!order) return false;
  if (!claimPrintSlot(order)) return false;

  if (inFlightRef) inFlightRef.current = true;
  try {
    /* Android → Mate Technologies Bluetooth Thermal Printer (not RawBT) */
    if (isAndroidDevice()) {
      try {
        const blob = await createCounterReceiptPngBlob(order, thermalWidth);
        const file = new File([blob], receiptPngFilename(order), { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `${SHOP.name} ${receiptNumber(order)}`,
            text: `${SHOP.name} receipt — open in Bluetooth Thermal Printer`,
            files: [file],
          });
          finishPrintJob(inFlightRef);
          return true;
        }
        downloadBlob(blob, file.name);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          openMateThermalText(order);
        }
        finishPrintJob(inFlightRef);
        return err?.name === 'AbortError';
      }
      openMateThermalText(order);
      finishPrintJob(inFlightRef);
      return true;
    }

    const width = normalizeThermalWidth(thermalWidth);
    const html = buildThermalReceiptHtml(order, width);
    return printViaIframe(html, inFlightRef);
  } catch {
    finishPrintJob(inFlightRef);
    return false;
  }
}

/** Open Mate Bluetooth Thermal Printer with receipt text (Android). */
export function openMateThermalReceipt(order) {
  if (!order || typeof window === 'undefined') return false;
  if (!claimPrintSlot(order)) return false;
  return openMateThermalText(order);
}

export function downloadCounterInvoicePdf(order, thermalWidth = readThermalReceiptWidth()) {
  if (!order) return;
  /* Android: thick high-DPI PNG for Mate Image print; PDF letterboxes on 58mm */
  if (isAndroidDevice()) {
    createCounterReceiptPngBlob(order, thermalWidth)
      .then((blob) => downloadBlob(blob, receiptPngFilename(order)))
      .catch(() => {
        downloadBlob(createCounterInvoicePdfBlob(order, thermalWidth), receiptFilename(order));
      });
    return;
  }
  downloadBlob(createCounterInvoicePdfBlob(order, thermalWidth), receiptFilename(order));
}

export async function shareCounterInvoicePdf(order, thermalWidth = readThermalReceiptWidth()) {
  if (!order) return false;

  if (isAndroidDevice()) {
    const blob = await createCounterReceiptPngBlob(order, thermalWidth);
    const file = new File([blob], receiptPngFilename(order), { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `${SHOP.name} ${receiptNumber(order)}`,
        text: `${SHOP.name} receipt — choose Bluetooth Thermal Printer`,
        files: [file],
      });
      return true;
    }
    downloadBlob(blob, file.name);
    openMateThermalText(order);
    return false;
  }

  const blob = createCounterInvoicePdfBlob(order, thermalWidth);
  const file = new File([blob], receiptFilename(order), { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `${SHOP.name} ${receiptNumber(order)}`,
      text: `${SHOP.name} receipt ${receiptNumber(order)}`,
      files: [file],
    });
    return true;
  }
  downloadBlob(blob, file.name);
  return false;
}

export function CounterBillReceipt({ order, printable = false, thermalWidth = '58mm' }) {
  const { t } = useTranslation();
  if (!order) return null;

  const paymentNote = counterPaymentNote(order);
  const { subtotal, discount, grandTotal } = receiptTotals(order);

  return (
    <div
      className={`counter-bill-print${printable ? ' counter-bill-print--active' : ''}`}
      style={{ '--thermal-receipt-width': thermalWidth }}
      aria-label={t('admin.counterBillReceipt')}
    >
      <div className="counter-bill-print__shop">
        <h2>ASFIX &amp; GEAR</h2>
        <p>{SHOP.addressLine1}</p>
        <p>{SHOP.addressLine2} | {SHOP.phone}</p>
      </div>
      <div className="counter-bill-print__meta">
        <span>{t('admin.counterBillNo')}: {order.order_id || order.id}</span>
        <span>{t('admin.counterBillDate')}: {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</span>
        <span>{t('admin.counterBillStaff')}: {order.created_by_staff_name || 'Counter staff'}</span>
        <span>
          {t('admin.counterBillPayment')}: {paymentLabel(order.payment_mode)}
          {paymentNote ? ` (${paymentNote})` : ''}
        </span>
        <span>{t('admin.counterBillCustomer')}: {order.customer_name || 'Walk-in Customer'}</span>
        {order.phone ? <span>{t('admin.counterBillPhone')}: {order.phone}</span> : null}
      </div>
      <div className="counter-bill-print__rule" />
      <div className="counter-bill-print__items">
        {(order.items || []).map((item, index) => {
          const qty = Number(item.qty) || 1;
          const unit = Number(item.price) || 0;
          return (
            <div className="counter-bill-print__item" key={`${item.product_id}-${index}`}>
              <strong>{item.name}</strong>
              <span>{qty} x {formatPrice(unit)}</span>
              <b>{formatPrice(unit * qty)}</b>
            </div>
          );
        })}
      </div>
      <div className="counter-bill-print__rule" />
      <div className="counter-bill-print__totals">
        <span>{t('admin.counterBillSubtotal')}</span>
        <strong>{formatPrice(subtotal)}</strong>
        {discount ? (
          <>
            <span>{t('admin.counterBillDiscount')}</span>
            <strong>{formatPrice(discount)}</strong>
          </>
        ) : null}
        <span className="counter-bill-print__grand-label">{t('admin.counterBillGrandTotal')}</span>
        <strong className="counter-bill-print__grand">{formatPrice(grandTotal)}</strong>
      </div>
      <p className="counter-bill-print__thanks">{t('admin.counterBillThanks')}</p>
      <p className="counter-bill-print__site">{RECEIPT_SITE}</p>
    </div>
  );
}

export default function AdminCounterBill({
  products,
  onBillCreated,
  onPrintOrder,
  onThermalWidthChange,
  onJumpToSales,
  onOpenReturnFlow,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const searchRef = useRef(null);
  const noteRef = useRef(null);
  const printInFlightRef = useRef(false);
  const autoPrintedOrderRef = useRef(null);
  const [draftSeed] = useState(() => readCounterBillDraft());
  const [thermalWidth, setThermalWidth] = useState(() => readThermalReceiptWidth());
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [lines, setLines] = useState(() => draftSeed?.lines || []);
  const [customerName, setCustomerName] = useState(() => draftSeed?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(() => draftSeed?.customerPhone || '');
  const [showCustomerDetails, setShowCustomerDetails] = useState(() => Boolean(draftSeed?.customerName || draftSeed?.customerPhone));
  const [paymentMode, setPaymentMode] = useState(() =>
    PAYMENT_OPTIONS.some((option) => option.id === draftSeed?.paymentMode) ? draftSeed.paymentMode : 'cash'
  );
  const [paymentNote, setPaymentNote] = useState(() => draftSeed?.paymentNote || '');
  const [productPanelCollapsed, setProductPanelCollapsed] = useState(false);
  const [discountType, setDiscountType] = useState(() => draftSeed?.discountType || 'fixed');
  const [discountValue, setDiscountValue] = useState(() => draftSeed?.discountValue || '');
  const [heldBills, setHeldBills] = useState(() => readHeldBills());
  const [serverDrafts, setServerDrafts] = useState([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [posSettings, setPosSettings] = useState(DEFAULT_POS_SETTINGS);
  const [cashReceived, setCashReceived] = useState('');
  const [cartFlashKey, setCartFlashKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const showMateThermalLink = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  const availableProducts = useMemo(() => {
    return products
      .filter((p) => (p.status || 'published') === 'published' && Number(p.stock) > 0)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [products]);

  const categories = useMemo(() => {
    return [...new Set(availableProducts.map((product) => product.category).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [availableProducts]);

  const filteredProducts = useMemo(() => {
    const hasQuery = query.trim().length > 0;
    return availableProducts.filter((product) => {
      const inCategory = selectedCategory === ALL_CATEGORIES || product.category === selectedCategory;
      const inSearch = !hasQuery || matchesQuery(product, query);
      return inCategory && inSearch;
    });
  }, [availableProducts, query, selectedCategory]);

  const autocompleteProducts = useMemo(() => {
    if (!query.trim()) return [];
    return availableProducts.filter((product) => matchesQuery(product, query));
  }, [availableProducts, query]);

  const showSearchDropdown = searchFocused && query.trim().length > 0;

  const subtotal = lines.reduce((sum, line) => sum + salePrice(line.product) * line.qty, 0);
  const discountAmount = clampDiscountAmount({ subtotal, type: discountType, value: discountValue });
  const effectiveDiscountPercent = subtotal > 0 && discountAmount > 0
    ? Number(((discountAmount / subtotal) * 100).toFixed(2))
    : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const discountNeedsOverride = discountAmount > Number(posSettings.posDiscountMaxAmountWithoutPin || 0)
    || effectiveDiscountPercent > Number(posSettings.posDiscountMaxPercentWithoutPin || 0);
  const cashReceivedValue = Number(cashReceived);
  const changeDue = paymentMode === 'cash' && Number.isFinite(cashReceivedValue) ? Math.max(0, cashReceivedValue - total) : 0;
  const hasActiveBill = Boolean(lines.length || customerName || customerPhone || paymentNote || discountValue);

  const billSnapshot = useCallback(() => ({
    lines: lines.map((line) => ({
      product: line.product,
      qty: line.qty,
    })),
    customerName,
    customerPhone,
    paymentMode,
    paymentNote,
    discountType,
    discountValue,
  }), [customerName, customerPhone, discountType, discountValue, lines, paymentMode, paymentNote]);

  const applyBillSnapshot = useCallback((snapshot = {}) => {
    const nextLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
    setLines(nextLines);
    setCustomerName(snapshot.customerName || '');
    setCustomerPhone(snapshot.customerPhone || '');
    setPaymentMode(PAYMENT_OPTIONS.some((option) => option.id === snapshot.paymentMode) ? snapshot.paymentMode : 'cash');
    setPaymentNote(snapshot.paymentNote || '');
    setDiscountType(snapshot.discountType === 'percent' ? 'percent' : 'fixed');
    setDiscountValue(snapshot.discountValue || '');
    setShowCustomerDetails(Boolean(snapshot.customerName || snapshot.customerPhone));
    setCashReceived('');
    setReceiptOrder(null);
    setFeedback(null);
  }, []);

  const clearBillFields = useCallback(() => {
    clearCounterBillDraft();
    setLines([]);
    setCustomerName('');
    setCustomerPhone('');
    setShowCustomerDetails(false);
    setPaymentMode('cash');
    setPaymentNote('');
    setDiscountType('fixed');
    setDiscountValue('');
    setCashReceived('');
    setReceiptOrder(null);
  }, []);

  useEffect(() => {
    api.getPosSettings()
      .then((settings) => setPosSettings({ ...DEFAULT_POS_SETTINGS, ...(settings || {}) }))
      .catch(() => setPosSettings(DEFAULT_POS_SETTINGS));
  }, []);

  const loadServerDrafts = useCallback(async () => {
    setDraftLoading(true);
    try {
      const drafts = await api.getCounterDrafts();
      setServerDrafts(Array.isArray(drafts) ? drafts : []);
    } catch {
      setServerDrafts([]);
    } finally {
      setDraftLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServerDrafts();
  }, [loadServerDrafts]);

  useEffect(() => {
    if (!lines.length) return;
    setLines((prev) =>
      prev.map((line) => {
        const latest = products.find((product) => product.id === line.product.id);
        if (!latest) return line;
        const max = Math.max(1, Number(latest.stock) || 1);
        return {
          ...line,
          product: latest,
          qty: Math.min(max, Math.max(1, Number(line.qty) || 1)),
        };
      })
    );
  }, [products]);

  useEffect(() => {
    writeThermalReceiptWidth(thermalWidth);
    onThermalWidthChange?.(thermalWidth);
  }, [thermalWidth, onThermalWidthChange]);

  useEffect(() => {
    if (!cartFlashKey) return undefined;
    const timer = window.setTimeout(() => setCartFlashKey(0), 450);
    return () => window.clearTimeout(timer);
  }, [cartFlashKey]);

  useEffect(() => {
    const hasDraft = lines.length || customerName || customerPhone || paymentMode !== 'cash' || paymentNote || discountValue;
    if (!hasDraft) {
      clearCounterBillDraft();
      return;
    }

    writeCounterBillDraft({
      lines: lines.map((line) => ({
        product: line.product,
        qty: line.qty,
      })),
      customerName,
      customerPhone,
      paymentMode,
      paymentNote,
      discountType,
      discountValue,
      updatedAt: new Date().toISOString(),
    });
  }, [lines, customerName, customerPhone, paymentMode, paymentNote, discountType, discountValue]);

  const addProduct = (product) => {
    setReceiptOrder(null);
    setFeedback(null);
    setCartFlashKey(Date.now());
    setLines((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, qty: Math.min(Number(product.stock) || 1, line.qty + 1) }
            : line
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    setQuery('');
    setSearchFocused(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter' || !query.trim() || !autocompleteProducts[0]) return;
    e.preventDefault();
    addProduct(autocompleteProducts[0]);
  };

  const adjustQty = (productId, delta) => {
    const line = lines.find((item) => item.product.id === productId);
    if (!line) return;
    setQty(productId, line.qty + delta);
  };

  const setQty = (productId, value) => {
    setReceiptOrder(null);
    const raw = Number(value);
    setLines((prev) =>
      prev.map((line) => {
        if (line.product.id !== productId) return line;
        const max = Math.max(1, Number(line.product.stock) || 1);
        const qty = Number.isFinite(raw) ? Math.min(max, Math.max(1, Math.floor(raw))) : 1;
        return { ...line, qty };
      })
    );
  };

  const removeLine = (productId) => {
    setReceiptOrder(null);
    setLines((prev) => prev.filter((line) => line.product.id !== productId));
  };

  const resetBill = () => {
    clearBillFields();
    setFeedback(null);
  };

  const cancelSale = () => {
    if (!hasActiveBill) return;
    const confirmed = window.confirm?.(t('admin.counterBillCancelConfirm')) ?? false;
    if (!confirmed) return;
    clearBillFields();
    setFeedback({ type: 'success', text: t('admin.counterBillCancelled') });
  };

  const holdBill = () => {
    if (!lines.length) {
      setFeedback({ type: 'error', text: t('admin.counterBillEmpty') });
      return;
    }
    const snapshot = {
      id: Date.now(),
      label: `${customerName || t('admin.counterBillWalkIn')} · ${amountText(total)}`,
      createdAt: new Date().toISOString(),
      ...billSnapshot(),
    };
    setHeldBills((prev) => {
      const next = [snapshot, ...prev].slice(0, MAX_HELD_BILLS);
      writeHeldBills(next);
      return next;
    });
    clearBillFields();
    setFeedback({ type: 'success', text: t('admin.counterBillHeld') });
  };

  const restoreHeldBill = (heldBill) => {
    if (hasActiveBill && !(window.confirm?.(t('admin.counterBillReplaceConfirm')) ?? false)) return;
    applyBillSnapshot(heldBill);
    setHeldBills((prev) => {
      const next = prev.filter((entry) => entry.id !== heldBill.id);
      writeHeldBills(next);
      return next;
    });
    setFeedback({ type: 'success', text: t('admin.counterBillRestored') });
  };

  const removeHeldBill = (id) => {
    setHeldBills((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      writeHeldBills(next);
      return next;
    });
  };

  const saveServerDraft = async () => {
    if (!lines.length) {
      setFeedback({ type: 'error', text: t('admin.counterBillEmpty') });
      return;
    }
    setDraftSubmitting(true);
    setFeedback(null);
    try {
      await api.saveCounterDraft({
        customer_name: customerName,
        phone: customerPhone,
        payment_mode: paymentMode,
        payment_note: paymentNote,
        discount_type: discountType,
        discount_amount: discountAmount,
        discount_percent: discountType === 'percent' ? Number(discountValue) || 0 : null,
        items: lines.map((line) => ({
          product_id: line.product.id,
          qty: line.qty,
          price: salePrice(line.product),
        })),
      });
      clearBillFields();
      await loadServerDrafts();
      setFeedback({ type: 'success', text: t('admin.counterBillDraftSaved') });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || t('admin.counterBillDraftFailed') });
    } finally {
      setDraftSubmitting(false);
    }
  };

  const draftSnapshot = (draft) => ({
    lines: (draft.items || []).map((item) => {
      const latestProduct = products.find((product) => Number(product.id) === Number(item.product_id));
      return latestProduct ? { product: latestProduct, qty: Number(item.qty) || 1 } : null;
    }).filter(Boolean),
    customerName: draft.customer_name === 'Walk-in Customer' ? '' : draft.customer_name || '',
    customerPhone: draft.phone || '',
    paymentMode: draft.payment_mode || 'cash',
    paymentNote: draft.payment_note || '',
    discountType: draft.discount_type || 'fixed',
    discountValue: draft.discount_type === 'percent'
      ? String(draft.discount_percent || '')
      : String(draft.discount_amount || ''),
  });

  const restoreServerDraft = (draft) => {
    if (hasActiveBill && !(window.confirm?.(t('admin.counterBillReplaceConfirm')) ?? false)) return;
    applyBillSnapshot(draftSnapshot(draft));
    setFeedback({ type: 'success', text: t('admin.counterBillDraftLoaded') });
  };

  const confirmServerDraft = async (draft) => {
    if (hasActiveBill && !(window.confirm?.(t('admin.counterBillReplaceConfirm')) ?? false)) return;
    setDraftSubmitting(true);
    setFeedback(null);
    try {
      let managerApproval = {};
      const draftDiscount = Number(draft.discount_amount) || 0;
      const draftSubtotal = Number(draft.subtotal) || 0;
      const draftDiscountPercent = draftSubtotal > 0 ? Number(((draftDiscount / draftSubtotal) * 100).toFixed(2)) : 0;
      const draftNeedsOverride = draftDiscount > Number(posSettings.posDiscountMaxAmountWithoutPin || 0)
        || draftDiscountPercent > Number(posSettings.posDiscountMaxPercentWithoutPin || 0);
      if (draftNeedsOverride && !['super_admin', 'admin'].includes(user?.role)) {
        const managerLogin = window.prompt?.('Manager approval required. Enter admin username/email:') || '';
        const managerPassword = managerLogin ? window.prompt?.('Enter manager password/PIN:') || '' : '';
        if (!managerLogin.trim() || !managerPassword) {
          setFeedback({ type: 'error', text: 'Manager approval is required for this discount.' });
          setDraftSubmitting(false);
          return;
        }
        managerApproval = {
          manager_login: managerLogin,
          manager_password: managerPassword,
        };
      }
      const result = await api.confirmCounterDraft(draft.id, managerApproval);
      clearBillFields();
      setReceiptOrder(result.order);
      await loadServerDrafts();
      setFeedback({ type: 'success', text: t('admin.counterBillDraftConfirmed') });
      onBillCreated?.(result.order);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || t('admin.counterBillFailed') });
    } finally {
      setDraftSubmitting(false);
    }
  };

  const deleteServerDraft = async (draft) => {
    try {
      await api.deleteCounterDraft(draft.id);
      await loadServerDrafts();
      setFeedback({ type: 'success', text: t('admin.counterBillDraftDeleted') });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || t('admin.counterBillDraftFailed') });
    }
  };

  const printReceipt = useCallback(async (order = receiptOrder) => {
    if (!order) return;
    if (onPrintOrder) {
      onPrintOrder(order);
      return;
    }
    await printActiveCounterReceipt({
      thermalWidth,
      inFlightRef: printInFlightRef,
      order,
    });
  }, [onPrintOrder, receiptOrder, thermalWidth]);

  /* No auto-print — confirm + Print was firing multiple thermal jobs (3–4 slips). */
  const confirmBill = async () => {
    if (!lines.length) {
      setFeedback({ type: 'error', text: t('admin.counterBillEmpty') });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      let managerApproval = {};
      if (discountNeedsOverride && !['super_admin', 'admin'].includes(user?.role)) {
        const managerLogin = window.prompt?.('Manager approval required. Enter admin username/email:') || '';
        if (!managerLogin.trim()) {
          setFeedback({ type: 'error', text: 'Manager approval is required for this discount.' });
          setSubmitting(false);
          return;
        }
        const managerPassword = window.prompt?.('Enter manager password/PIN:') || '';
        if (!managerPassword) {
          setFeedback({ type: 'error', text: 'Manager password/PIN is required.' });
          setSubmitting(false);
          return;
        }
        managerApproval = {
          manager_login: managerLogin,
          manager_password: managerPassword,
        };
      }
      const result = await api.createCounterSale({
        customer_name: customerName,
        phone: customerPhone,
        payment_mode: paymentMode,
        payment_note: paymentNote,
        discount_type: discountType,
        discount_amount: discountAmount,
        discount_percent: discountType === 'percent' ? Number(discountValue) || 0 : null,
        ...managerApproval,
        items: lines.map((line) => ({
          product_id: line.product.id,
          qty: line.qty,
        })),
      });
      setReceiptOrder(result.order);
      setFeedback({ type: 'success', text: t('admin.counterBillCreated') });
      clearCounterBillDraft();
      setLines([]);
      setCustomerName('');
      setCustomerPhone('');
      setShowCustomerDetails(false);
      setPaymentMode('cash');
      setPaymentNote('');
      setDiscountType('fixed');
      setDiscountValue('');
      setCashReceived('');
      onBillCreated?.(result.order);
      /* Print only when staff taps Print — auto-print caused 3–4 duplicate slips */
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || t('admin.counterBillFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadInvoice = (order = receiptOrder) => {
    if (!order) return;
    downloadCounterInvoicePdf(order, thermalWidth);
  };

  const shareInvoice = async (order = receiptOrder) => {
    if (!order) return;
    try {
      const shared = await shareCounterInvoicePdf(order, thermalWidth);
      if (!shared) {
        setFeedback({ type: 'success', text: t('admin.counterBillPdfDownloaded') });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setFeedback({ type: 'error', text: err.message || t('admin.counterBillPdfFailed') });
      }
    }
  };

  return (
    <div className="counter-bill">
      <div className="counter-bill__head">
        <div>
          <h3>{t('admin.counterBillTitle')}</h3>
          <p>{t('admin.counterBillSub')}</p>
        </div>
        <div className="counter-bill__shop">
          <strong>{SHOP.name}</strong>
          <span>{SHOP.fullAddress}</span>
          <span>{SHOP.phone}</span>
        </div>
      </div>

      {feedback ? (
        <div className={`counter-bill__feedback counter-bill__feedback--${feedback.type}`} role="status">
          {feedback.text}
        </div>
      ) : null}

      <div className={`counter-bill__grid${productPanelCollapsed ? ' counter-bill__grid--products-collapsed' : ''}`}>
        <section className="counter-bill__panel counter-bill__panel--products">
          <div className="counter-bill__panel-head">
            <div>
              <h4>{t('admin.counterBillProducts')}</h4>
              <span>{filteredProducts.length} / {availableProducts.length}</span>
            </div>
            <button
              type="button"
              className="counter-bill__browse-toggle"
              onClick={() => setProductPanelCollapsed((value) => !value)}
              aria-expanded={!productPanelCollapsed}
            >
              {productPanelCollapsed ? '☰ Browse Products' : 'Collapse ▲'}
            </button>
          </div>

          {!productPanelCollapsed ? (
            <div className="counter-bill__categories" role="tablist" aria-label="Product categories">
              <button
                type="button"
                className={`counter-bill__category${selectedCategory === ALL_CATEGORIES ? ' counter-bill__category--active' : ''}`}
                onClick={() => setSelectedCategory(ALL_CATEGORIES)}
              >
                {t('admin.counterBillAllCategories')}
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`counter-bill__category${selectedCategory === category ? ' counter-bill__category--active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          ) : null}

          <div className="counter-bill__search-wrap">
            <label className="counter-bill__search">
              <span>{t('admin.counterBillSearch')}</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('admin.counterBillSearchPh')}
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={showSearchDropdown}
                aria-controls="counter-bill-search-results"
              />
              <small>{t('admin.counterBillSearchHint')}</small>
            </label>
            {showSearchDropdown ? (
              <div className="counter-bill__search-results" id="counter-bill-search-results" role="listbox">
                {autocompleteProducts.length === 0 ? (
                  <p className="counter-bill__search-empty">{t('admin.counterBillNoProductsFound')}</p>
                ) : (
                  autocompleteProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="counter-bill__search-option"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        addProduct(product);
                      }}
                      role="option"
                    >
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.category || product.brand || `#${product.id}`}</small>
                      </span>
                      <b>{formatPrice(salePrice(product))}</b>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {!productPanelCollapsed ? (
            <div className="counter-bill__products">
              {filteredProducts.length === 0 ? (
                <p className="counter-bill__empty">{t('admin.counterBillNoMatch')}</p>
              ) : null}
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="counter-bill__product-tile"
                  onClick={() => addProduct(product)}
                >
                  <span className="counter-bill__product-media">
                    {product.image ? (
                      <img src={product.image} alt="" loading="lazy" />
                    ) : (
                      <img src={getDefaultImage(product.category)} alt="" loading="lazy" />
                    )}
                  </span>
                  <span className="counter-bill__product-info">
                    <strong>{product.name}</strong>
                    <small>{product.category || product.brand || `#${product.id}`}</small>
                  </span>
                  <span className="counter-bill__product-price">
                    <strong>{formatPrice(salePrice(product))}</strong>
                    <small>{t('admin.stockLabel', { count: Number(product.stock) || 0 })}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className={`counter-bill__panel counter-bill__panel--cart${cartFlashKey ? ' counter-bill__panel--flash' : ''}`}>
          <div className="counter-bill__panel-head">
            <h4>{t('admin.counterBillCart')}</h4>
            <span>{lines.length} {t('admin.counterBillCartItems')}</span>
          </div>

          <div className="counter-bill__thermal-setting">
            <span>{t('admin.counterBillThermalWidth')}</span>
            <div role="group" aria-label={t('admin.counterBillThermalWidth')}>
              {THERMAL_WIDTH_OPTIONS.map((width) => (
                <button
                  key={width}
                  type="button"
                  className={thermalWidth === width ? 'counter-bill__thermal-active' : ''}
                  onClick={() => setThermalWidth(width)}
                >
                  {width}
                </button>
              ))}
            </div>
          </div>

          <div className="counter-bill__quick-actions" aria-label={t('admin.counterBillQuickActions')}>
            <button type="button" onClick={() => document.getElementById('counter-bill-discount')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
              <span aria-hidden="true">%</span>
              {t('admin.counterBillToolbarDiscount')}
            </button>
            <button type="button" onClick={() => setShowCustomerDetails(true)}>
              <span aria-hidden="true">+</span>
              {t('admin.counterBillToolbarCustomer')}
            </button>
            <button type="button" onClick={onOpenReturnFlow}>
              <span aria-hidden="true">R</span>
              {t('admin.counterBillToolbarRefund')}
            </button>
            <button type="button" onClick={onJumpToSales}>
              <span aria-hidden="true">#</span>
              {t('admin.counterBillToolbarHistory')}
            </button>
            <button type="button" onClick={() => noteRef.current?.focus()}>
              <span aria-hidden="true">N</span>
              {t('admin.counterBillToolbarNotes')}
            </button>
          </div>

          <div className="counter-bill__cart-lines">
            {lines.length === 0 ? (
              <p className="counter-bill__empty counter-bill__empty--cart">{t('admin.counterBillEmptyState')}</p>
            ) : (
              lines.map((line, index) => {
                const unit = salePrice(line.product);
                const stock = Number(line.product.stock) || 1;
                return (
                  <article className="counter-bill__cart-row" key={line.product.id}>
                    <span className="counter-bill__cart-index">{index + 1}</span>
                    <div className="counter-bill__cart-item">
                      <strong>{line.product.name}</strong>
                      <small>{formatPrice(unit)} each · {t('admin.stockLabel', { count: stock })}</small>
                    </div>
                    <div className="counter-bill__qty-stepper">
                      <button type="button" onClick={() => adjustQty(line.product.id, -1)} disabled={line.qty <= 1}>
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={stock}
                        step="1"
                        value={line.qty}
                        onChange={(e) => setQty(line.product.id, e.target.value)}
                        aria-label={`${line.product.name} quantity`}
                      />
                      <button type="button" onClick={() => adjustQty(line.product.id, 1)} disabled={line.qty >= stock}>
                        +
                      </button>
                    </div>
                    <strong className="counter-bill__cart-line-total">{formatPrice(unit * line.qty)}</strong>
                    <button type="button" className="counter-bill__remove" onClick={() => removeLine(line.product.id)}>
                      {t('admin.counterBillRemove')}
                    </button>
                  </article>
                );
              })
            )}
          </div>

          <div className="counter-bill__discount-box" id="counter-bill-discount">
            <div className="counter-bill__discount-head">
              <span>Discount</span>
              <div className="counter-bill__discount-toggle" role="group" aria-label="Discount type">
                <button
                  type="button"
                  className={discountType === 'fixed' ? 'counter-bill__discount-active' : ''}
                  onClick={() => setDiscountType('fixed')}
                >
                  Fixed Rs
                </button>
                <button
                  type="button"
                  className={discountType === 'percent' ? 'counter-bill__discount-active' : ''}
                  onClick={() => setDiscountType('percent')}
                >
                  %
                </button>
              </div>
            </div>
            <label className="counter-bill__discount-input">
              <span>{discountType === 'percent' ? 'Discount percent' : 'Discount amount'}</span>
              <input
                type="number"
                min="0"
                max={discountType === 'percent' ? 100 : subtotal}
                step={discountType === 'percent' ? '0.01' : '1'}
                inputMode="decimal"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="0"
              />
            </label>
            {discountNeedsOverride ? (
              <p className="counter-bill__discount-warning">
                Manager approval required above {posSettings.posDiscountMaxPercentWithoutPin}% or Rs. {posSettings.posDiscountMaxAmountWithoutPin}.
              </p>
            ) : null}
          </div>

          <div className="counter-bill__customer-toggle">
            <button type="button" onClick={() => setShowCustomerDetails((value) => !value)}>
              {showCustomerDetails ? t('admin.counterBillHideCustomer') : t('admin.counterBillAddCustomer')}
            </button>
          </div>

          {showCustomerDetails ? (
            <div className="counter-bill__customer">
              <label>
                <span>{t('admin.counterBillCustomer')}</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('admin.counterBillCustomerPh')}
                  maxLength={120}
                />
              </label>
              <label>
                <span>{t('admin.counterBillPhone')}</span>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t('admin.counterBillPhonePh')}
                  maxLength={30}
                />
              </label>
            </div>
          ) : null}

          <div className="counter-bill__payment">
            <span>{t('admin.counterBillPayment')}</span>
            <div className="counter-bill__payment-grid">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`counter-bill__pay counter-bill__pay--${option.id}${paymentMode === option.id ? ' counter-bill__pay--active' : ''}`}
                  onClick={() => setPaymentMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMode === 'cash' ? (
            <div className="counter-bill__cash-box">
              <label>
                <span>{t('admin.counterBillAmountReceived')}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0"
                />
              </label>
              <div className="counter-bill__change">
                <span>{t('admin.counterBillChangeReturn')}</span>
                <strong>{formatPrice(changeDue)}</strong>
              </div>
            </div>
          ) : null}

          <label className="counter-bill__note">
            <span>{t('admin.counterBillPaymentNote')}</span>
            <input
              ref={noteRef}
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder={t('admin.counterBillPaymentNotePh')}
              maxLength={500}
            />
          </label>

          {(heldBills.length || serverDrafts.length || draftLoading) ? (
            <div className="counter-bill__saved-bills">
              {heldBills.length ? (
                <section>
                  <h5>{t('admin.counterBillHeldBills')}</h5>
                  {heldBills.map((heldBill) => (
                    <div className="counter-bill__saved-row" key={heldBill.id}>
                      <button type="button" onClick={() => restoreHeldBill(heldBill)}>
                        <strong>{heldBill.label}</strong>
                        <small>{new Date(heldBill.createdAt).toLocaleTimeString()}</small>
                      </button>
                      <button type="button" aria-label={t('admin.counterBillRemove')} onClick={() => removeHeldBill(heldBill.id)}>
                        x
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}
              <section>
                <h5>{t('admin.counterBillSavedDrafts')}</h5>
                {draftLoading ? <p>{t('common.loading')}</p> : null}
                {!draftLoading && serverDrafts.length === 0 ? <p>{t('admin.counterBillNoDrafts')}</p> : null}
                {serverDrafts.map((draft) => (
                  <div className="counter-bill__saved-row" key={draft.id}>
                    <button type="button" onClick={() => restoreServerDraft(draft)}>
                      <strong>{draft.draft_id || `#${draft.id}`} · {formatPrice(draft.total_amount)}</strong>
                      <small>{draft.customer_name || t('admin.counterBillWalkIn')}</small>
                    </button>
                    <button type="button" onClick={() => confirmServerDraft(draft)} disabled={draftSubmitting}>
                      {t('admin.counterBillDraftConfirm')}
                    </button>
                    <button type="button" aria-label={t('admin.counterBillRemove')} onClick={() => deleteServerDraft(draft)}>
                      x
                    </button>
                  </div>
                ))}
              </section>
            </div>
          ) : null}

          <div className="counter-bill__footer">
            <div className="counter-bill__summary-card" aria-label={t('admin.counterBillSummary')}>
              <div>
                <span>{t('admin.counterBillSubtotal')}</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div>
                <span>{t('admin.counterBillDiscount')}</span>
                {discountAmount > 0 ? (
                  <button type="button" className="counter-bill__discount-chip" onClick={() => setDiscountValue('')}>
                    {t('admin.counterBillDiscountApplied')} x
                  </button>
                ) : (
                  <strong>{formatPrice(0)}</strong>
                )}
              </div>
              <div className="counter-bill__summary-total">
                <span>{t('admin.counterBillGrandTotal')}</span>
                <strong>{formatPrice(total)}</strong>
              </div>
            </div>

            <div className="counter-bill__actions">
              <button type="button" className="counter-bill__button counter-bill__button--secondary" onClick={resetBill}>
                {t('admin.counterBillReset')}
              </button>
              <button type="button" className="counter-bill__button counter-bill__button--secondary" onClick={holdBill} disabled={!lines.length}>
                {t('admin.counterBillHold')}
              </button>
              <button type="button" className="counter-bill__button counter-bill__button--secondary" onClick={saveServerDraft} disabled={draftSubmitting || !lines.length}>
                {draftSubmitting ? t('common.saving') : t('admin.counterBillSaveDraft')}
              </button>
              <button type="button" className="counter-bill__button counter-bill__button--danger" onClick={cancelSale} disabled={!hasActiveBill}>
                {t('admin.counterBillCancelSale')}
              </button>
              <button type="button" className="counter-bill__button counter-bill__button--primary" onClick={confirmBill} disabled={submitting || !lines.length}>
                {submitting ? t('common.saving') : t('admin.counterBillConfirm')}
              </button>
              {receiptOrder ? (
                <>
                  <button type="button" className="wp-button counter-bill__print-cta" onClick={() => printReceipt()}>
                    {showMateThermalLink ? t('admin.counterBillPrintMate') : t('admin.counterBillPrintNow')}
                  </button>
                  <button type="button" className="wp-button counter-bill__pdf-cta" onClick={() => downloadInvoice()}>
                    {t('admin.counterBillDownloadPdf')}
                  </button>
                  <button type="button" className="wp-button counter-bill__share-cta" onClick={() => shareInvoice()}>
                    {t('admin.counterBillSharePdf')}
                  </button>
              </>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {receiptOrder ? (
        <section className="counter-bill__receipt">
          <div className="counter-bill__receipt-head">
            <strong>{t('admin.counterBillSavedReady')}</strong>
            <div className="counter-bill__receipt-actions">
              <button type="button" className="wp-button counter-bill__print-cta" onClick={() => printReceipt()}>
                {showMateThermalLink ? t('admin.counterBillPrintMate') : t('admin.counterBillPrintNow')}
              </button>
              <button type="button" className="wp-button counter-bill__pdf-cta" onClick={() => downloadInvoice()}>
                {t('admin.counterBillDownloadPdf')}
              </button>
              <button type="button" className="wp-button counter-bill__share-cta" onClick={() => shareInvoice()}>
                {t('admin.counterBillSharePdf')}
              </button>
              {showMateThermalLink ? (
                <a className="wp-button counter-bill__mate-cta" href={mateThermalTextHref(receiptOrder)}>
                  {t('admin.counterBillOpenMate')}
                </a>
              ) : null}
            </div>
          </div>
          <p className="counter-bill__receipt-note">{t('admin.counterBillThermalHint')}</p>
          <CounterBillReceipt order={receiptOrder} printable={!onPrintOrder} thermalWidth={thermalWidth} />
        </section>
      ) : null}
    </div>
  );
}
