import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api, formatPrice } from '../../api/client';
import { SHOP } from '../../config/shop';
import { useAuth } from '../../context/AuthContext';
import { getDefaultImage } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import { tryLaptopThermalPrint } from '../../utils/thermalLaptopPrint';
import {
  autoPrintCounterReceiptIfNative,
  getSavedPrinter,
  isNativePosApp,
  listBondedPrinters,
  savePrinter,
  tryNativeThermalPrint,
} from '../../utils/nativePosPrint';
import { useSmartThermalPrint } from '../../hooks/useSmartThermalPrint';
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
const RECEIPT_SITE_URL = `https://${RECEIPT_SITE}`;
const THERMAL_PAGE_STYLE_ID = 'thermal-page-size';
const PRINT_ROOT_ID = 'counter-receipt-print-root';

async function buildWebsiteQrDataUrl(size = 320) {
  return QRCode.toDataURL(RECEIPT_SITE_URL, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
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

export function buildThermalReceiptText(order, thermalWidth = '58mm') {
  if (!order) return '';
  /* Match ESC/POS 58mm (~32) / 80mm (~48) so plain-text fallbacks fill the roll */
  const maxChars = normalizeThermalWidth(thermalWidth) === '80mm' ? 48 : 32;
  return `${buildReceiptLines(order, maxChars).map((line) => line.value).join('\n')}\n`;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Full-width ESC/POS receipt for laptop, native AsFix app, and remote stations.
 * QR uses Zijiang/vendor ESC Z (from 58mm kit SDK) — Epson GS (k is ignored on these clones.
 * Mag 6 @ 58mm / 8 @ 80mm matches PrinterCommand.getBarCommand demo sizing.
 */
export function buildThermalReceiptEscPosBase64(order, thermalWidth = '58mm') {
  if (!order || typeof TextEncoder === 'undefined' || typeof btoa !== 'function') return '';
  const width = normalizeThermalWidth(thermalWidth);
  const maxChars = width === '80mm' ? 48 : 32;
  const lines = buildReceiptLines(order, maxChars);
  const encoder = new TextEncoder();
  const parts = [];
  const push = (...values) => parts.push(Uint8Array.from(values));
  const text = (value) => parts.push(encoder.encode(String(value ?? '')));

  push(0x1b, 0x40); // ESC @
  push(0x1b, 0x4d, 0x00); // Font A (readable body on 58mm / ~32 cols @ 384 dots)
  for (const line of lines) {
    if (line.qr) {
      const qr = encoder.encode(line.value || RECEIPT_SITE_URL);
      const version = 0;
      const ecc = 3; /* vendor max 0–3 */
      const mag = width === '80mm' ? 8 : 6;
      push(0x1b, 0x61, 0x01); // center
      /* ESC Z nVersion nEcc nMag nL nH data — Zijiang BT-POS / 58mm kit */
      push(0x1b, 0x5a, version, ecc, mag, qr.length & 0xff, (qr.length >> 8) & 0xff);
      parts.push(qr);
      push(0x0a);
      continue;
    }

    push(0x1b, 0x61, line.align === 'center' ? 0x01 : line.align === 'right' ? 0x02 : 0x00);
    push(0x1b, 0x45, line.weight === 'bold' || line.title || line.grand || line.totalLabel ? 0x01 : 0x00);
    /* Always Font A — Font B looks tiny and leaves empty right margin feel */
    push(0x1b, 0x4d, 0x00);
    /* Title: double W+H; TOTAL: double H; grand amount: double W+H */
    const size = line.title || line.grand
      ? 0x11
      : line.totalLabel
        ? 0x01
        : 0x00;
    push(0x1d, 0x21, size);
    text(line.value);
    push(0x0a);
    push(0x1d, 0x21, 0x00);
    push(0x1b, 0x45, 0x00);
  }
  push(0x1b, 0x61, 0x00, 0x1b, 0x45, 0x00, 0x1b, 0x4d, 0x00);
  /* 2 line feeds only — never ESC J 48+ / long feed (meters of blank on POS-58 clones) */
  push(0x0a, 0x0a);
  push(0x1d, 0x56, 0x42, 0x00); // GS V B 0 — partial cut, no extra feed

  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const payload = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.length;
  }
  return bytesToBase64(payload);
}

/**
 * Mate Technologies Thermer (Play: mate.bluetoothprint).
 * APK docs (assets/intent_printing.txt): ACTION_SEND text/plain with markup tags
 *   <BAF>text  B=bold 0|1, A=align 0L|1C|2R, F=0 normal|1 dH|2 dH+W|3 dW
 *   <QR>A#S#value  <IMAGE>A#base64  <BARCODE>…
 * Browser scheme my.bluetoothprint.scheme://https://… needs a fetchable JSON URL
 * (not usable from a pure SPA blob). Share image/* also works (FileReceiver).
 * Printer link: Bluetooth SPP RFCOMM UUID 00001101-… + ESC/POS (GS v 0 raster).
 */
const MATE_THERMAL_PACKAGE = 'mate.bluetoothprint';
const MATE_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${MATE_THERMAL_PACKAGE}`;

function sanitizeMatePlain(value) {
  return String(value ?? '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Build Thermer Intent EXTRA_TEXT with Mate <BAF> markup + QR (better than raw lines). */
function buildMateThermalMarkup(order) {
  if (!order) return '';
  /* ~32 cols so Thermer fills 58mm like ESC/POS Font A */
  const maxChars = 32;
  const lines = buildReceiptLines(order, maxChars).filter((line) => !line.qr);
  const parts = lines.map((line) => {
    const text = sanitizeMatePlain(line.value);
    if (line.rule) return `<010>${'-'.repeat(maxChars)}`;
    if (!text) return '<010> ';
    const bold = line.weight === 'bold' || line.title || line.grand || line.totalLabel ? '1' : '0';
    const align = line.align === 'center' ? '1' : line.align === 'right' ? '2' : '0';
    const format = line.grand ? '1' : line.title ? '3' : '0';
    return `<${bold}${align}${format}>${text}`;
  });
  parts.push('<010> ');
  parts.push('<110>Scan');
  /* Mate QR: align#moduleSize#payload — size ~ body text, not full-roll giant */
  parts.push(`<QR>1#6#${RECEIPT_SITE_URL}`);
  parts.push(`<110>${RECEIPT_SITE}`);
  parts.push('<010> ');
  return parts.join('');
}

function mateThermalTextHref(order) {
  const text = buildMateThermalMarkup(order) || buildThermalReceiptText(order);
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
  anchor.rel = 'noopener';
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

/** Shared receipt lines — tall glyphs, fewer cols so letters stay large. */
function shortReceiptDateParts(order) {
  if (!order?.created_at) return { date: '-', time: '-' };
  const d = new Date(order.created_at);
  if (Number.isNaN(d.getTime())) return { date: '-', time: '-' };
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return {
    date: `${dd}/${mm}/${yy}`,
    time: `${hh}:${mi}`,
  };
}

function shortReceiptDate(order) {
  const { date, time } = shortReceiptDateParts(order);
  if (date === '-') return '-';
  return `${date} ${time}`;
}

function buildReceiptLines(order, maxChars = 18) {
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

  const { date: billDate, time: billTime } = shortReceiptDateParts(order);

  push('AS FIX & GEAR', { align: 'center', weight: 'bold', title: true });
  push('BILL', { align: 'center', weight: 'bold', title: true });
  wrap('Mobile Repair', { align: 'center', small: true });
  wrap(SHOP.addressLine2, { align: 'center', small: true });
  wrap(SHOP.phone, { align: 'center', small: true });
  rule();
  kv('Bill', receiptNumber(order));
  /* Separate Date / Time so HH:mm never truncates (was showing 10:5) */
  kv('Date', billDate);
  kv('Time', billTime);
  /* Let kv() fit to maxChars — do not hard-slice (32-col ESC/POS needs full "Walk-in Customer") */
  kv('Staff', order?.created_by_staff_name || 'Counter');
  kv('Pay', paymentLabel(order?.payment_mode));
  kv('Customer', order?.customer_name || 'Walk-in');
  if (order?.phone) kv('Phone', String(order.phone));
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
  rule();
  push('Scan', { align: 'center', weight: 'bold', small: true });
  push(RECEIPT_SITE_URL, { align: 'center', qr: true });
  return lines;
}

/**
 * Thermal PNG: keep AS FIX & GEAR heading bold;
 * body text cleaner (fill-only, less blocky pixels) with real dashed linings.
 */
export async function createCounterReceiptPngBlob(order, thermalWidth = '58mm') {
  const pageWidth = normalizeThermalWidth(thermalWidth);
  const printerDots = pageWidth === '80mm' ? 576 : 384;
  const scale = 2;
  const widthPx = printerDots * scale;
  const maxChars = pageWidth === '80mm' ? 26 : 18;
  const padX = Math.round(widthPx * 0.07);
  const padY = 16 * scale;
  const titleStretch = 1.35;
  const bodyStretch = 1.28;
  const lines = buildReceiptLines(order, maxChars);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const usable = widthPx - padX * 2;

  const isHeavy = (line) => Boolean(line?.title || line?.grand || line?.totalLabel);

  const setFont = (size, heavy = false) => {
    /* Heading stays bold display; body uses open sans — unique + fewer blocky pixels */
    ctx.font = heavy
      ? `bold ${size}px "Arial Black", Arial, Helvetica, sans-serif`
      : `600 ${size}px Arial, Helvetica, sans-serif`;
  };

  const letterGapFor = (size, heavy) => (
    heavy
      ? Math.max(2 * scale, Math.round(size * 0.1))
      : Math.max(3 * scale, Math.round(size * 0.16))
  );

  const stretchFor = (heavy) => (heavy ? titleStretch : bodyStretch);

  const measureSpaced = (text, size, heavy = false) => {
    setFont(size, heavy);
    const letterGap = letterGapFor(size, heavy);
    const chars = Array.from(String(text ?? ''));
    if (!chars.length) return 0;
    let width = 0;
    chars.forEach((ch, index) => {
      width += ctx.measureText(ch).width;
      if (index < chars.length - 1) width += letterGap;
    });
    return width;
  };

  let fontSize = Math.floor(usable / (maxChars * 0.55));
  while (measureSpaced('M'.repeat(maxChars), fontSize, false) > usable && fontSize > 20 * scale) {
    fontSize -= 1;
  }
  while (measureSpaced('M'.repeat(maxChars), fontSize + 1, false) <= usable) {
    fontSize += 1;
  }
  fontSize = Math.max(fontSize, pageWidth === '80mm' ? 28 : 24);

  const lineSize = (line) => {
    if (line.grand) return Math.round(fontSize * 1.7);
    if (line.totalLabel) return Math.round(fontSize * 1.12);
    if (line.title) return Math.round(fontSize * 1.2);
    if (line.small) return Math.max(18, Math.round(fontSize * 0.88));
    if (line.rule) return fontSize;
    return fontSize;
  };

  const chunkAtSize = (text, size, heavy) => {
    const chars = Array.from(String(text ?? ''));
    if (!chars.length) return [''];
    const chunks = [];
    let current = '';
    chars.forEach((ch) => {
      const next = current + ch;
      if (current && measureSpaced(next, size, heavy) > usable) {
        chunks.push(current);
        current = ch;
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks;
  };

  const lineHFor = (size, heavy) => Math.ceil(size * stretchFor(heavy) * (heavy ? 1.18 : 1.28));
  const ruleH = Math.ceil(fontSize * bodyStretch * 0.85);
  /* QR ~ body-text scale on 58mm (vendor mag 6 ≈ half-roll), not full-bleed giant */
  const qrSize = Math.round(usable * (pageWidth === '80mm' ? 0.42 : 0.48));

  let heightPx = padY * 2 + 16 * scale;
  lines.forEach((line) => {
    if (line.rule) {
      heightPx += ruleH + 6 * scale;
      return;
    }
    if (line.qr) {
      heightPx += qrSize + 18 * scale;
      return;
    }
    const heavy = isHeavy(line);
    const size = lineSize(line);
    const lh = lineHFor(size, heavy);
    if (line.columns) {
      heightPx += lh;
    } else {
      heightPx += chunkAtSize(line.value, size, heavy).length * lh;
      if (heavy) heightPx += 6 * scale;
    }
  });

  canvas.width = widthPx;
  canvas.height = heightPx;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.imageSmoothingEnabled = true;

  const drawRuleLine = (y) => {
    const mid = y + ruleH / 2;
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1.5, scale);
    ctx.setLineDash([5 * scale, 4 * scale]);
    ctx.beginPath();
    ctx.moveTo(padX, mid);
    ctx.lineTo(widthPx - padX, mid);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  const drawSpacedText = (text, anchorX, y, size, align = 'left', heavy = false) => {
    setFont(size, heavy);
    const letterGap = letterGapFor(size, heavy);
    const stretch = stretchFor(heavy);
    const chars = Array.from(String(text ?? ''));
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const totalW = widths.reduce((sum, w, i) => sum + w + (i < widths.length - 1 ? letterGap : 0), 0);

    let x = anchorX;
    if (align === 'center') x = anchorX - totalW / 2;
    if (align === 'right') x = anchorX - totalW;
    if (x < padX) x = padX;
    if (x + totalW > widthPx - padX) x = Math.max(padX, widthPx - padX - totalW);

    ctx.save();
    ctx.translate(0, y);
    ctx.scale(1, stretch);
    let cursor = x;
    chars.forEach((ch, index) => {
      if (heavy) {
        ctx.lineWidth = Math.max(1.2, size * 0.035);
        ctx.lineJoin = 'round';
        ctx.strokeText(ch, cursor, 0);
      }
      ctx.fillText(ch, cursor, 0);
      cursor += widths[index] + letterGap;
    });
    ctx.restore();
  };

  let y = padY;
  for (const line of lines) {
    if (line.rule) {
      y += 3 * scale;
      drawRuleLine(y);
      y += ruleH + 3 * scale;
      continue;
    }

    if (line.qr) {
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, line.value || RECEIPT_SITE_URL, {
        width: qrSize,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      const qrX = Math.round((widthPx - qrSize) / 2);
      y += 6 * scale;
      ctx.drawImage(qrCanvas, qrX, y, qrSize, qrSize);
      y += qrSize + 12 * scale;
      continue;
    }

    const heavy = isHeavy(line);
    const size = lineSize(line);
    const lh = lineHFor(size, heavy);

    if (line.columns) {
      let right = line.columns.right;
      while (
        measureSpaced(line.columns.left, size, heavy) + 12 * scale + measureSpaced(right, size, heavy) > usable
        && right.length > 2
      ) {
        right = right.slice(0, -1);
      }
      drawSpacedText(line.columns.left, padX, y, size, 'left', heavy);
      drawSpacedText(right, widthPx - padX, y, size, 'right', heavy);
      y += lh;
    } else {
      const align = line.align === 'center' ? 'center' : line.align === 'right' ? 'right' : 'left';
      const anchor = align === 'center'
        ? widthPx / 2
        : align === 'right'
          ? widthPx - padX
          : padX;
      const chunks = chunkAtSize(line.value, size, heavy);
      chunks.forEach((chunk) => {
        drawSpacedText(chunk, anchor, y, size, align, heavy);
        y += lh;
      });
      if (heavy) y += 4 * scale;
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))),
      'image/png',
      1
    );
  });
}

/**
 * Compact 58/80mm PDF — MediaBox height = content only (never A4 / 3276mm continuous).
 * Prefer PNG for thermal printing; PDF is archival/share fallback only.
 * Printing any PDF via Windows POS-58 with paper "58×3276mm" still feeds meters of blank —
 * use Direct Print (content-height HTML @page 58mm×Nmm) or ESC/POS instead.
 */
export function createCounterInvoicePdfBlob(order, thermalWidth = '58mm') {
  const pageWidth = normalizeThermalWidth(thermalWidth);
  const widthMm = pageWidth === '80mm' ? 80 : 58;
  const width = pdfPointsFromMillimeters(widthMm);
  /* Near-zero margins — content must span the full MediaBox */
  const marginX = pdfPointsFromMillimeters(0.8);
  const marginTop = pdfPointsFromMillimeters(1.2);
  const marginBottom = pdfPointsFromMillimeters(1.2);
  const maxChars = pageWidth === '80mm' ? 26 : 18;
  const bodySize = pageWidth === '80mm' ? 13 : 12;
  const bodyLeading = pageWidth === '80mm' ? 18 : 17;
  const receiptLines = buildReceiptLines(order, maxChars)
    .filter((line) => !line.qr)
    .map((line) => ({
      value: line.value,
      size: line.grand
        ? bodySize + 8
        : line.totalLabel
          ? bodySize + 2
          : line.title
            ? bodySize + 3
            : line.small
              ? bodySize - 0.5
              : bodySize,
      leading: line.grand
        ? bodyLeading + 10
        : line.totalLabel || line.title
          ? bodyLeading + 3
          : bodyLeading,
      align: line.align || 'left',
      font: line.weight === 'bold' || line.title || line.grand || line.totalLabel ? 'F2' : 'F1',
    }));

  /* Content-fit only — never pad to roll length / fixed tall page */
  const contentPts = receiptLines.reduce((sum, line) => sum + line.leading, 0);
  const height = Math.max(
    Math.ceil(marginTop + marginBottom + contentPts),
    Math.ceil(pdfPointsFromMillimeters(40)), /* floor ~40mm so empty orders stay short */
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
  const box = `[0 0 ${width.toFixed(2)} ${height.toFixed(2)}]`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox ${box} /CropBox ${box} /TrimBox ${box} /BleedBox ${box} /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
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
  return { ok: true, method: 'download' };
}

/**
 * WebView often blocks `<a download>`; prefer Web Share, then open blob URL.
 * @returns {Promise<{ ok: boolean, method?: string, message?: string }>}
 */
async function shareOrOpenBlob(blob, filename, { title = '', text = '' } = {}) {
  const type = blob?.type || 'application/octet-stream';
  const file = new File([blob], filename, { type });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: title || filename,
        text: text || title || filename,
        files: [file],
      });
      return { ok: true, method: 'share' };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { ok: false, method: 'share', message: 'cancelled' };
      }
      /* fall through to open / download */
    }
  }

  const url = URL.createObjectURL(blob);
  const opened = typeof window !== 'undefined' ? window.open(url, '_blank') : null;
  if (opened) {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { ok: true, method: 'open' };
  }

  downloadBlob(blob, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, method: 'download' };
}

/** Normalize printActiveCounterReceipt / onPrintOrder return values. */
export function normalizePrintResult(result) {
  if (result == null) return { ok: false, reason: 'print_failed', message: 'Print did not run' };
  if (typeof result === 'boolean') {
    return result ? { ok: true } : { ok: false, reason: 'print_failed' };
  }
  if (typeof result === 'object' && 'ok' in result) return result;
  return { ok: true };
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

function isAppleMobileDevice() {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function prefersThermalPngShare() {
  return isAndroidDevice() || isAppleMobileDevice();
}

/**
 * True 58/80mm receipt HTML.
 * NEVER use @page height:auto — Chrome replaces it with the Windows thermal
 * driver's max roll (often 58×3276mm) → meters of blank paper.
 * printViaIframe measures content and locks an exact short @page size.
 */
function buildThermalReceiptHtml(order, thermalWidth = '58mm', qrDataUrl = '') {
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
/* Placeholder — overwritten with measured content height before print */
@page { size: ${widthMm}mm 120mm; margin: 0; }
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: ${widthMm}mm !important;
  max-width: ${widthMm}mm !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  background: #fff !important;
  color: #000 !important;
  overflow: hidden !important;
}
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.receipt {
  width: ${widthMm}mm !important;
  max-width: ${widthMm}mm !important;
  height: auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 2.5mm 2.5mm 1.5mm !important;
  font-family: "Courier New", Courier, monospace !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  line-height: 1.45 !important;
  letter-spacing: 0.06em !important;
  page-break-after: avoid !important;
  page-break-inside: avoid !important;
}
.r-shop { text-align: center; margin-bottom: 5px; }
.r-shop h1 { margin: 0 0 2px; font-size: 18px; font-weight: 900; letter-spacing: 0.1em; }
.r-shop .r-bill { margin: 0 0 4px; font-size: 16px; font-weight: 900; letter-spacing: 0.12em; }
.r-shop p { margin: 1px 0; font-size: 12px; letter-spacing: 0.06em; }
.r-meta { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; margin: 5px 0; font-size: 14px; }
.r-meta span:last-child { text-align: right; }
.r-rule { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
.r-item { margin: 0 0 5px; }
.r-item strong { display: block; font-size: 14px; letter-spacing: 0.07em; }
.r-row { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.r-totals { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; font-size: 14px; }
.r-totals > * { min-width: 0; }
.r-totals strong { text-align: right; white-space: nowrap; }
.r-grand-wrap { text-align: center; margin: 6px 0 4px; }
.r-grand-label { display: block; font-size: 15px; font-weight: 900; letter-spacing: 0.1em; }
.r-grand { display: block; font-size: 22px; font-weight: 900; letter-spacing: 0.1em; margin-top: 3px; }
.r-thanks, .r-site { text-align: center; margin: 4px 0 0; font-size: 13px; font-weight: 700; }
.r-scan { text-align: center; margin: 5px 0 2px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; }
.r-qr { display: block; width: 42%; max-width: 42%; height: auto; margin: 2px auto 0; }
`.trim();

  const qrBlock = qrDataUrl
    ? `<hr class="r-rule" />
  <p class="r-scan">Scan</p>
  <img class="r-qr" src="${qrDataUrl}" alt="asfixgear.com QR" width="160" height="160" />`
    : '';

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
    <span>Date</span><span>${escapeHtml(order?.created_at ? shortReceiptDateParts(order).date : '-')}</span>
    <span>Time</span><span>${escapeHtml(order?.created_at ? shortReceiptDateParts(order).time : '-')}</span>
    <span>Staff</span><span>${escapeHtml(order?.created_by_staff_name || 'Counter')}</span>
    <span>Pay</span><span>${escapeHtml(paymentLabel(order?.payment_mode))}${paymentNote ? ` (${escapeHtml(paymentNote)})` : ''}</span>
    <span>Customer</span><span>${escapeHtml(order?.customer_name || 'Walk-in')}</span>
    ${order?.phone ? `<span>Phone</span><span>${escapeHtml(String(order.phone))}</span>` : ''}
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
  ${qrBlock}
</main>
</body></html>`;
}

/** Content-height PNG sheet for Direct Print — never a tall PDF / never driver 3276mm. */
function buildThermalPngPrintHtml(dataUrl, widthMm, heightMm) {
  const w = Number(widthMm) || 58;
  const h = Math.max(40, Math.min(220, Number(heightMm) || 120));
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=${w}, initial-scale=1" />
<title>AsFix receipt</title>
<style>
@page { size: ${w}mm ${h}mm; margin: 0; }
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: ${w}mm !important;
  height: ${h}mm !important;
  min-height: 0 !important;
  max-height: ${h}mm !important;
  overflow: hidden !important;
  background: #fff !important;
}
img {
  display: block !important;
  width: ${w}mm !important;
  height: ${h}mm !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}
</style></head><body>
<img src="${dataUrl}" alt="AsFix receipt" />
</body></html>`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read receipt image'));
    reader.readAsDataURL(blob);
  });
}

function loadImageNaturalSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    });
    img.onerror = () => reject(new Error('Could not load receipt image'));
    img.src = src;
  });
}

/**
 * Lock @page to measured (or forced) content height.
 * POS-58 Windows drivers often advertise 58×3276mm — never let Chrome use that.
 */
function lockThermalPageToContent(doc, widthMm = 58, forcedHeightMm = null) {
  const w = widthMm === 80 ? 80 : 58;
  let heightMm;
  if (forcedHeightMm != null && Number.isFinite(Number(forcedHeightMm))) {
    heightMm = Math.max(40, Math.min(220, Math.ceil(Number(forcedHeightMm))));
  } else {
    const node = doc.querySelector('.receipt') || doc.body;
    const px = Math.max(
      node?.scrollHeight || 0,
      node?.offsetHeight || 0,
      Math.ceil(node?.getBoundingClientRect?.().height || 0),
      doc.body?.scrollHeight || 0,
    );
    /* CSS px → mm @ 96dpi; +2mm padding; clamp away from tall-roll / A4 */
    heightMm = Math.ceil((px * 25.4) / 96) + 2;
    heightMm = Math.max(40, Math.min(heightMm, 220));
  }

  let style = doc.getElementById('asfix-thermal-page-lock');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'asfix-thermal-page-lock';
    doc.head.appendChild(style);
  }
  style.textContent = `
@page { size: ${w}mm ${heightMm}mm !important; margin: 0 !important; }
html, body {
  width: ${w}mm !important;
  max-width: ${w}mm !important;
  height: ${heightMm}mm !important;
  min-height: 0 !important;
  max-height: ${heightMm}mm !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
}
`;
  return heightMm;
}

function finishPrintJob(inFlightRef) {
  document.getElementById(THERMAL_PAGE_STYLE_ID)?.remove();
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.body.classList.remove('counter-receipt-printing', 'receipt-thermal-80mm');
  if (inFlightRef) inFlightRef.current = false;
}

/**
 * Same-origin iframe print — locks @page to short 58mm×Nmm.
 * Never A4, never @page auto (maps to 3276mm on POS-58), never tall PDF.
 * @param {string} [forcedHeightMm] exact content height from PNG aspect ratio
 */
function printViaIframe(html, inFlightRef, widthMm = 58, forcedHeightMm = null) {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  const w = widthMm === 80 || widthMm === '80mm' ? 80 : 58;
  const iframe = document.createElement('iframe');
  iframe.id = PRINT_ROOT_ID;
  iframe.title = 'AsFix 58mm receipt';
  iframe.setAttribute('aria-hidden', 'true');
  /* Tall enough to measure full receipt; off-screen */
  iframe.style.cssText = `position:fixed;width:${w}mm;height:900px;border:0;left:-9999px;top:0;opacity:0;overflow:hidden;`;
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
  let printed = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    try { iframe.remove(); } catch { /* ignore */ }
    finishPrintJob(inFlightRef);
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 90_000);

  const triggerPrint = () => {
    if (printed || done) return;
    printed = true;
    try {
      lockThermalPageToContent(doc, w, forcedHeightMm);
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  };

  const images = Array.from(doc.images || []);
  if (!images.length) {
    window.setTimeout(triggerPrint, 80);
    return true;
  }
  let pending = images.length;
  const onReady = () => {
    pending -= 1;
    if (pending <= 0) window.setTimeout(triggerPrint, 40);
  };
  images.forEach((img) => {
    if (img.complete) onReady();
    else {
      img.addEventListener('load', onReady, { once: true });
      img.addEventListener('error', onReady, { once: true });
    }
  });
  window.setTimeout(triggerPrint, 2500);
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
 * Direct Print — content-height HTML for Windows 58mm driver (never tall PDF).
 * Laptop: PNG receipt in iframe with exact @page 58mm×contentMm (POS-58 defaults
 * to 58×3276mm — @page auto would feed meters of blank paper).
 * Phone: Share/Download PNG. Skips bridge / BLE / Thermer / stations.
 */
export async function printDirectSystemReceipt({
  thermalWidth = '58mm',
  inFlightRef,
  order = null,
} = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, reason: 'unavailable', message: 'Print unavailable' };
  }
  if (inFlightRef?.current) {
    return { ok: false, reason: 'busy', message: 'Print already in progress' };
  }
  if (!order) {
    return { ok: false, reason: 'no_order', message: 'No receipt to print' };
  }
  if (!claimPrintSlot(order)) {
    return { ok: false, reason: 'busy', message: 'Print already in progress' };
  }

  if (inFlightRef) inFlightRef.current = true;
  try {
    /* Native POS already has BT printer — use ESC/POS path */
    if (isNativePosApp()) {
      const text = buildThermalReceiptText(order, thermalWidth);
      const dataBase64 = buildThermalReceiptEscPosBase64(order, thermalWidth);
      const native = await tryNativeThermalPrint(text, { dataBase64 });
      finishPrintJob(inFlightRef);
      return native?.ok
        ? { ok: true }
        : {
            ok: false,
            reason: native?.reason || 'print_failed',
            message: native?.message,
          };
    }

    /* Phone: Share / Download only (no system 58mm driver on iOS) */
    if (isAndroidDevice() || isAppleMobileDevice()) {
      try {
        const blob = await createCounterReceiptPngBlob(order, thermalWidth);
        const shared = await shareOrOpenBlob(blob, receiptPngFilename(order), {
          title: `${SHOP.name} ${receiptNumber(order)}`,
          text: `${SHOP.name} receipt — Share or Print`,
        });
        finishPrintJob(inFlightRef);
        if (shared.message === 'cancelled') {
          return { ok: false, reason: 'cancelled' };
        }
        return { ok: true };
      } catch (err) {
        finishPrintJob(inFlightRef);
        if (err?.name === 'AbortError') {
          return { ok: false, reason: 'cancelled' };
        }
        return {
          ok: false,
          reason: 'print_failed',
          message: err?.message || 'Share failed',
        };
      }
    }

    /*
     * Laptop Direct Print: content-height PNG HTML only — NEVER createCounterInvoicePdfBlob.
     * Exact @page 58mm×Nmm from image aspect ratio so POS-58 cannot spool 3276mm.
     */
    const width = normalizeThermalWidth(thermalWidth);
    const widthMm = width === '80mm' ? 80 : 58;
    const blob = await createCounterReceiptPngBlob(order, width);
    const dataUrl = await blobToDataUrl(blob);
    const dims = await loadImageNaturalSize(dataUrl);
    const heightMm = Math.max(
      40,
      Math.min(220, Math.ceil((dims.height / Math.max(1, dims.width)) * widthMm) + 1),
    );
    const html = buildThermalPngPrintHtml(dataUrl, widthMm, heightMm);
    const printed = await printViaIframe(html, inFlightRef, widthMm, heightMm);
    return printed ? { ok: true } : { ok: false, reason: 'print_failed', message: 'Browser print failed' };
  } catch (err) {
    finishPrintJob(inFlightRef);
    return {
      ok: false,
      reason: 'print_failed',
      message: err?.message || String(err) || 'Print failed',
    };
  }
}

/**
 * Print for 58/80mm thermal (BT800S etc.):
 * - AsFix POS Capacitor app → native Bluetooth SPP ESC/POS (no Thermer)
 * - Android browser → PNG Web Share (Thermer accepts image/*) → Mate markup Intent fallback
 * - Desktop → localhost COM bridge (if running) → Web Bluetooth BLE → iframe fallback
 * @returns {Promise<{ ok: boolean, reason?: string, message?: string }>}
 */
export async function printActiveCounterReceipt({
  thermalWidth = '58mm',
  inFlightRef,
  order = null,
} = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, reason: 'unavailable', message: 'Print unavailable' };
  }
  if (inFlightRef?.current) {
    return { ok: false, reason: 'busy', message: 'Print already in progress' };
  }
  if (!order) {
    return { ok: false, reason: 'no_order', message: 'No receipt to print' };
  }
  if (!claimPrintSlot(order)) {
    return { ok: false, reason: 'busy', message: 'Print already in progress' };
  }

  if (inFlightRef) inFlightRef.current = true;
  try {
    /* Native AsFix POS app: Bluetooth SPP ESC/POS — replaces Thermer happy path */
    if (isNativePosApp()) {
      const text = buildThermalReceiptText(order, thermalWidth);
      const dataBase64 = buildThermalReceiptEscPosBase64(order, thermalWidth);
      const native = await tryNativeThermalPrint(text, { dataBase64 });
      finishPrintJob(inFlightRef);
      /* Always return structured result so UI can show Select printer / BT errors */
      return native?.ok
        ? { ok: true }
        : {
            ok: false,
            reason: native?.reason || 'print_failed',
            message: native?.message,
          };
    }

    /* Android browser → Thermer (mate.bluetoothprint): share PNG, else Mate <BAF> Intent */
    if (isAndroidDevice()) {
      try {
        const blob = await createCounterReceiptPngBlob(order, thermalWidth);
        const shared = await shareOrOpenBlob(blob, receiptPngFilename(order), {
          title: `${SHOP.name} ${receiptNumber(order)}`,
          text: `${SHOP.name} receipt — choose Thermer / Bluetooth Thermal Printer`,
        });
        if (shared.ok && shared.method === 'share') {
          finishPrintJob(inFlightRef);
          return { ok: true };
        }
        if (shared.message === 'cancelled') {
          finishPrintJob(inFlightRef);
          return { ok: false, reason: 'cancelled' };
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          finishPrintJob(inFlightRef);
          return { ok: false, reason: 'cancelled' };
        }
        openMateThermalText(order);
        finishPrintJob(inFlightRef);
        return { ok: true };
      }
      openMateThermalText(order);
      finishPrintJob(inFlightRef);
      return { ok: true };
    }

    /* Laptop: full ESC/POS (32-col + QR + bold title) via COM bridge or Web Bluetooth */
    try {
      const dataBase64 = buildThermalReceiptEscPosBase64(order, thermalWidth);
      const text = buildThermalReceiptText(order, thermalWidth);
      const direct = await tryLaptopThermalPrint(text, { dataBase64 });
      if (direct.ok) {
        finishPrintJob(inFlightRef);
        return { ok: true };
      }
    } catch {
      /* fall through to iframe */
    }

    const width = normalizeThermalWidth(thermalWidth);
    let qrDataUrl = '';
    try {
      qrDataUrl = await buildWebsiteQrDataUrl(160);
    } catch {
      qrDataUrl = '';
    }
    const html = buildThermalReceiptHtml(order, width, qrDataUrl);
    const printed = await printViaIframe(html, inFlightRef, width === '80mm' ? 80 : 58);
    return printed ? { ok: true } : { ok: false, reason: 'print_failed', message: 'Browser print failed' };
  } catch (err) {
    finishPrintJob(inFlightRef);
    return {
      ok: false,
      reason: 'print_failed',
      message: err?.message || String(err) || 'Print failed',
    };
  }
}

/** Open Thermer (Mate Bluetooth Print) with Mate markup Intent (Android). */
export function openMateThermalReceipt(order) {
  if (!order || typeof window === 'undefined') return false;
  if (!claimPrintSlot(order)) return false;
  return openMateThermalText(order);
}

export { MATE_THERMAL_PACKAGE, MATE_PLAY_STORE_URL, mateThermalTextHref };

/**
 * Download receipt — PNG first (thermal-safe). PDF only if canvas fails.
 * Never encourage printing tall PDF to POS-58 (driver paper 58×3276mm = meters blank).
 */
export async function downloadCounterInvoicePdf(order, thermalWidth = readThermalReceiptWidth()) {
  if (!order) return { ok: false, reason: 'no_order' };
  try {
    const blob = await createCounterReceiptPngBlob(order, thermalWidth);
    /* Phones / native: share-or-open (WebView often blocks <a download>). */
    if (isNativePosApp() || prefersThermalPngShare()) {
      return shareOrOpenBlob(blob, receiptPngFilename(order), {
        title: `${SHOP.name} ${receiptNumber(order)}`,
        text: `${SHOP.name} receipt — Save or Share PNG (do not print PDF to thermal)`,
      });
    }
    downloadBlob(blob, receiptPngFilename(order));
    return { ok: true, method: 'download' };
  } catch {
    /* Last resort: content-height 58mm PDF (still prefer Direct Print on Windows) */
    const blob = createCounterInvoicePdfBlob(order, thermalWidth);
    if (isNativePosApp() || prefersThermalPngShare()) {
      return shareOrOpenBlob(blob, receiptFilename(order), {
        title: `${SHOP.name} ${receiptNumber(order)}`,
        text: `${SHOP.name} receipt`,
      });
    }
    downloadBlob(blob, receiptFilename(order));
    return { ok: true, method: 'download' };
  }
}

/** Share receipt — PNG first on every device (thermal / WhatsApp). */
export async function shareCounterInvoicePdf(order, thermalWidth = readThermalReceiptWidth()) {
  if (!order) return false;

  try {
    const blob = await createCounterReceiptPngBlob(order, thermalWidth);
    const result = await shareOrOpenBlob(blob, receiptPngFilename(order), {
      title: `${SHOP.name} ${receiptNumber(order)}`,
      text: isAndroidDevice()
        ? `${SHOP.name} receipt — choose Thermer (Bluetooth Thermal Printer)`
        : `${SHOP.name} receipt — Share PNG (avoid printing PDF to POS-58)`,
    });
    if (result.message === 'cancelled') {
      const err = new Error('Share cancelled');
      err.name = 'AbortError';
      throw err;
    }
    if (result.method === 'share') return true;
    if (isAndroidDevice() && !isNativePosApp()) openMateThermalText(order);
    return false;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    const blob = createCounterInvoicePdfBlob(order, thermalWidth);
    const result = await shareOrOpenBlob(blob, receiptFilename(order), {
      title: `${SHOP.name} ${receiptNumber(order)}`,
      text: `${SHOP.name} receipt ${receiptNumber(order)}`,
    });
    if (result.message === 'cancelled') {
      const cancelErr = new Error('Share cancelled');
      cancelErr.name = 'AbortError';
      throw cancelErr;
    }
    return result.method === 'share';
  }
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
  const nativePos = isNativePosApp();
  const [nativePrinter, setNativePrinter] = useState(null);
  const { printSmart, chooser: printChooser } = useSmartThermalPrint({
    thermalWidth,
    agentReady: !nativePos || Boolean(nativePrinter?.address),
  });
  const [nativePrinters, setNativePrinters] = useState([]);
  const [nativePrinterBusy, setNativePrinterBusy] = useState(false);
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
  /* Thermer CTA only in Android browser — native app prints via AsfixThermalPrint */
  const showMateThermalLink = !nativePos && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!nativePos) return undefined;
    let cancelled = false;
    (async () => {
      const saved = await getSavedPrinter();
      if (!cancelled) setNativePrinter(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, [nativePos]);

  const refreshNativePrinters = useCallback(async () => {
    if (!nativePos) return;
    setNativePrinterBusy(true);
    try {
      const list = await listBondedPrinters();
      setNativePrinters(list);
      const saved = await getSavedPrinter();
      setNativePrinter(saved);
    } catch (err) {
      setFeedback({ type: 'error', text: err?.message || 'Could not list Bluetooth printers' });
    } finally {
      setNativePrinterBusy(false);
    }
  }, [nativePos]);

  const selectNativePrinter = useCallback(async (printer) => {
    await savePrinter(printer);
    setNativePrinter(printer);
    setFeedback({
      type: 'success',
      text: printer
        ? `Printer: ${printer.name || printer.address}`
        : 'Bluetooth printer cleared',
    });
  }, []);

  /** Native-only auto-print once per order id after a successful sale. */
  const maybeAutoPrintNative = useCallback(async (order) => {
    if (!nativePos || !order) return;
    const orderKey = String(order.order_id || order.id || '');
    if (!orderKey || autoPrintedOrderRef.current === orderKey) return;
    autoPrintedOrderRef.current = orderKey;
    const text = buildThermalReceiptText(order, thermalWidth);
    const dataBase64 = buildThermalReceiptEscPosBase64(order, thermalWidth);
    const result = await autoPrintCounterReceiptIfNative(text, { dataBase64 });
    if (result.ok) {
      setFeedback({ type: 'success', text: t('admin.counterBillNativePrinted') });
    } else if (result.reason === 'no_printer') {
      setFeedback({ type: 'error', text: t('admin.counterBillNativeNoPrinter') });
      void refreshNativePrinters();
    } else if (result.reason === 'permission_denied') {
      setFeedback({ type: 'error', text: t('admin.counterBillNativeBtPermission') });
    } else if (result.reason === 'print_failed') {
      setFeedback({
        type: 'error',
        text: result.message || t('admin.counterBillNativePrintFailed'),
      });
    }
  }, [nativePos, t, refreshNativePrinters, thermalWidth]);

  const applyPrintFeedback = useCallback((result) => {
    const normalized = normalizePrintResult(result);
    if (normalized.ok) {
      setFeedback({
        type: 'success',
        text: normalized.job
          ? t('admin.printTargetQueued')
          : nativePos
            ? t('admin.counterBillNativePrinted')
            : t('admin.counterBillPrintStarted'),
      });
      return;
    }
    if (normalized.reason === 'cancelled' || normalized.reason === 'busy') {
      if (normalized.reason === 'busy') {
        setFeedback({ type: 'error', text: t('admin.counterBillPrintBusy') });
      }
      return;
    }
    if (normalized.reason === 'no_order') {
      setFeedback({
        type: 'error',
        text: normalized.message || t('admin.counterBillNoReceipt'),
      });
      return;
    }
    if (normalized.reason === 'no_station') {
      setFeedback({ type: 'error', text: t('admin.printTargetNoStation') });
      return;
    }
    if (normalized.reason === 'no_printer') {
      setFeedback({ type: 'error', text: t('admin.counterBillNativeNoPrinter') });
      void refreshNativePrinters();
      return;
    }
    if (normalized.reason === 'permission_denied') {
      setFeedback({ type: 'error', text: t('admin.counterBillNativeBtPermission') });
      return;
    }
    setFeedback({
      type: 'error',
      text: normalized.message || t('admin.counterBillNativePrintFailed'),
    });
  }, [nativePos, t, refreshNativePrinters]);

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
      /* Auto-print only inside AsFix POS Capacitor app (not desktop / Thermer browser). */
      void maybeAutoPrintNative(result.order);
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
    if (!order) {
      setFeedback({ type: 'error', text: t('admin.counterBillNoReceipt') });
      return;
    }
    setFeedback(null);
    try {
      let result;
      if (onPrintOrder) {
        /* Counter page resolves items then prints — must return print result for feedback */
        result = await onPrintOrder(order);
      } else {
        result = await printSmart(order, {
          thermalWidth,
          inFlightRef: printInFlightRef,
        });
      }
      applyPrintFeedback(result);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err?.message || t('admin.counterBillNativePrintFailed'),
      });
    }
  }, [applyPrintFeedback, onPrintOrder, printSmart, receiptOrder, t, thermalWidth]);

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
      /* Native app: auto-print once. Browser/desktop: Print button only (avoids duplicate slips). */
      void maybeAutoPrintNative(result.order);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || t('admin.counterBillFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadInvoice = async (order = receiptOrder) => {
    if (!order) {
      setFeedback({ type: 'error', text: t('admin.counterBillNoReceipt') });
      return;
    }
    setFeedback(null);
    try {
      const result = await downloadCounterInvoicePdf(order, thermalWidth);
      if (result?.message === 'cancelled') return;
      if (!result?.ok) {
        setFeedback({
          type: 'error',
          text: result?.message || t('admin.counterBillPdfFailed'),
        });
        return;
      }
      if (result.method === 'share' || result.method === 'open') {
        setFeedback({ type: 'success', text: t('admin.counterBillShareSheet') });
      } else {
        setFeedback({ type: 'success', text: t('admin.counterBillPdfDownloaded') });
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setFeedback({ type: 'error', text: err?.message || t('admin.counterBillPdfFailed') });
    }
  };

  const shareInvoice = async (order = receiptOrder) => {
    if (!order) {
      setFeedback({ type: 'error', text: t('admin.counterBillNoReceipt') });
      return;
    }
    setFeedback(null);
    try {
      const shared = await shareCounterInvoicePdf(order, thermalWidth);
      if (shared) {
        setFeedback({ type: 'success', text: t('admin.counterBillShareOpened') });
      } else {
        setFeedback({ type: 'success', text: t('admin.counterBillShareSheet') });
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

          {nativePos ? (
            <div className="counter-bill__thermal-setting counter-bill__thermal-setting--native counter-bill__thermal-setting--native-sticky">
              <span>{t('admin.counterBillNativePrinter')}</span>
              <div className="counter-bill__native-printer">
                <p className="counter-bill__native-printer-status">
                  {nativePrinter
                    ? `${nativePrinter.name || 'Printer'} (${nativePrinter.address})`
                    : t('admin.counterBillNativeNoPrinter')}
                </p>
                <div role="group" aria-label={t('admin.counterBillNativePrinter')}>
                  <button
                    type="button"
                    disabled={nativePrinterBusy}
                    onClick={() => void refreshNativePrinters()}
                  >
                    {nativePrinterBusy ? t('common.loading') : t('admin.counterBillNativeRefresh')}
                  </button>
                  {nativePrinter ? (
                    <button type="button" onClick={() => void selectNativePrinter(null)}>
                      {t('admin.counterBillNativeClear')}
                    </button>
                  ) : null}
                </div>
                {nativePrinters.length > 0 ? (
                  <ul className="counter-bill__native-printer-list">
                    {nativePrinters.map((printer) => (
                      <li key={printer.address}>
                        <button
                          type="button"
                          className={
                            nativePrinter?.address === printer.address
                              ? 'counter-bill__thermal-active'
                              : ''
                          }
                          onClick={() => void selectNativePrinter(printer)}
                        >
                          {printer.name || printer.address}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="counter-bill__native-printer-hint">{t('admin.counterBillNativeHint')}</p>
              </div>
            </div>
          ) : null}

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
                    {nativePos
                      ? t('admin.counterBillPrintNative')
                      : showMateThermalLink
                        ? t('admin.counterBillPrintMate')
                        : t('admin.counterBillPrintNow')}
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
                {nativePos
                  ? t('admin.counterBillPrintNative')
                  : showMateThermalLink
                    ? t('admin.counterBillPrintMate')
                    : t('admin.counterBillPrintNow')}
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
      {!onPrintOrder ? printChooser : null}
    </div>
  );
}
