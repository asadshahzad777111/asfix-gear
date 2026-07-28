import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import {
  buildCustomImageEscPosRaster,
  buildReceiptLogoEscPosRaster,
  drawCustomImageOnCanvas,
  drawReceiptLogoOnCanvas,
  getCustomImageMonoDataUrl,
  getReceiptLogoMonoDataUrl,
  receiptLogoTargetDots,
  RECEIPT_LOGO_PATH,
} from '../../utils/receiptLogo';
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

async function buildWebsiteQrDataUrl(size = 280, payload = RECEIPT_SITE_URL) {
  return QRCode.toDataURL(String(payload || RECEIPT_SITE_URL), {
    width: size,
    margin: 1,
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

/** Cart line unit — staff sell-rate override, else catalog sale price. */
function lineUnitPrice(line) {
  const override = Number(line?.unitPrice);
  if (Number.isFinite(override) && override >= 0) return Math.round(override);
  return salePrice(line?.product);
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

/** Compact amount for 58mm thermal — comma groups + space after Rs so digits aren’t glued. */
function thermalAmountText(amount) {
  const n = Math.round(Number(amount || 0));
  const abs = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `Rs. ${n < 0 ? `-${abs}` : abs}`;
}

/**
 * ESC Z / Mate / PNG QR module size — must fit printable dots.
 * Mag 10–12 @ 58mm overflowed some rolls (printers skip the QR).
 * Mag 7/9: a bit larger for scanners, still within 58mm printable band.
 */
function thermalQrModuleSize(thermalWidth = '58mm') {
  return normalizeThermalWidth(thermalWidth) === '80mm' ? 9 : 7;
}

/**
 * Universal ESC/POS QR via GS v 0 raster (works on clones that ignore Epson GS (k).
 * Sized ~72% of printable dots — scannable without overflowing the roll.
 */
function buildEscPosQrRasterBytes(payload, thermalWidth = '58mm') {
  const width = normalizeThermalWidth(thermalWidth);
  const printableDots = width === '80mm' ? 576 : 384;
  const targetDots = Math.max(120, Math.floor(printableDots * 0.72));
  let model;
  try {
    model = QRCode.create(String(payload || RECEIPT_SITE_URL), { errorCorrectionLevel: 'M' });
  } catch {
    return new Uint8Array(0);
  }
  const modules = model?.modules;
  const moduleCount = modules?.size || 0;
  if (!moduleCount) return new Uint8Array(0);

  const quiet = 2;
  const scale = Math.max(3, Math.min(thermalQrModuleSize(width), Math.floor(targetDots / (moduleCount + quiet * 2))));
  const dim = (moduleCount + quiet * 2) * scale;
  const bytesPerRow = Math.ceil(dim / 8);
  const bitmap = new Uint8Array(bytesPerRow * dim);

  for (let y = 0; y < dim; y += 1) {
    const my = Math.floor(y / scale) - quiet;
    for (let x = 0; x < dim; x += 1) {
      const mx = Math.floor(x / scale) - quiet;
      const dark = my >= 0 && mx >= 0 && my < moduleCount && mx < moduleCount && modules.get(mx, my);
      if (!dark) continue;
      const byteIndex = y * bytesPerRow + (x >> 3);
      bitmap[byteIndex] |= 0x80 >> (x & 7);
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = dim & 0xff;
  const yH = (dim >> 8) & 0xff;
  const header = Uint8Array.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  const out = new Uint8Array(header.length + bitmap.length);
  out.set(header, 0);
  out.set(bitmap, header.length);
  return out;
}

export function buildThermalReceiptText(order, thermalWidth = '58mm') {
  if (!order) return '';
  /* Match ESC/POS 58mm (~32) / 80mm (~48) so plain-text fallbacks fill the roll */
  const maxChars = normalizeThermalWidth(thermalWidth) === '80mm' ? 48 : 32;
  return `${buildReceiptLines(order, maxChars)
    .filter((line) => !line.logo && !line.qr && !line.qrImage)
    .map((line) => line.value)
    .join('\n')}\n`;
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
 * Header: mono logo raster (GS v 0). QR uses GS v 0 (~72% width).
 * Mag 7/9 for Mate <QR> — slightly larger scan target, still fits 58mm.
 */
export async function buildThermalReceiptEscPosBase64(order, thermalWidth = '58mm') {
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
  /* Classic readable leading (~pre-Subtotal rhythm), not ultra-compressed */
  push(0x1b, 0x33, 32);
  /* Top feed so logo sits slightly lower (not top-cramped without name text) */
  push(0x1b, 0x4a, 52);

  const logoRaster = (() => {
    if (!isCustomReceipt(order)) return buildReceiptLogoEscPosRaster(width);
    const mode = customLogoMode(order);
    if (mode === 'own') return buildReceiptLogoEscPosRaster(width);
    if (mode === 'custom' && order.custom_logo_data_url) {
      return buildCustomImageEscPosRaster(order.custom_logo_data_url, width, 0.72);
    }
    return Promise.resolve(new Uint8Array());
  })();
  const logoBytes = await logoRaster;
  if (logoBytes.length) {
    push(0x1b, 0x61, 0x01); // center
    parts.push(logoBytes);
    /* Small gap before address / phone */
    push(0x1b, 0x4a, 10);
  }

  for (const line of lines) {
    if (line.logo) continue;
    if (line.qrImage && line.value) {
      push(0x1b, 0x61, 0x01);
      const raster = await buildCustomImageEscPosRaster(line.value, width, 0.62);
      if (raster.length) {
        parts.push(raster);
        push(0x0a);
      }
      continue;
    }
    if (line.qr) {
      const qrPayload = line.value || RECEIPT_SITE_URL;
      push(0x1b, 0x61, 0x01); // center
      const raster = buildEscPosQrRasterBytes(qrPayload, width);
      if (raster.length) {
        parts.push(raster);
        push(0x0a);
      } else {
        /* Fallback: Zijiang ESC Z at medium mag if raster build failed */
        const qr = encoder.encode(qrPayload);
        const mag = thermalQrModuleSize(width);
        push(0x1b, 0x5a, 0x00, 0x03, mag, qr.length & 0xff, (qr.length >> 8) & 0xff);
        parts.push(qr);
        push(0x0a);
      }
      continue;
    }

    if (line.spacer) {
      /* Item gap vs footer breath — slight only, not a full blank band */
      push(0x1b, 0x4a, line.itemGap ? 6 : 12);
      continue;
    }
    push(0x1b, 0x61, line.align === 'center' ? 0x01 : line.align === 'right' ? 0x02 : 0x00);
    const useBold = Boolean(line.title || line.grand);
    push(0x1b, 0x45, useBold ? 0x01 : 0x00);
    push(0x1b, 0x4d, 0x00);
    /* Grand: bold only (no double-H) — tight vs old huge TOTAL band, not glued */
    const size = line.title ? 0x01 : 0x00;
    if (line.grand) push(0x1b, 0x33, 28);
    push(0x1d, 0x21, size);
    text(line.value);
    push(0x0a);
    push(0x1d, 0x21, 0x00);
    push(0x1b, 0x45, 0x00);
    if (line.grand) push(0x1b, 0x33, 32);
  }
  push(0x1b, 0x61, 0x00, 0x1b, 0x45, 0x00, 0x1b, 0x4d, 0x00);
  /* Extra feed so cutter does not eat Scan/QR */
  push(0x0a, 0x0a, 0x0a);
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

/** Build Thermer Intent EXTRA_TEXT with Mate <BAF> markup + logo IMAGE + QR. */
async function buildMateThermalMarkup(order, thermalWidth = '58mm') {
  if (!order) return '';
  /* ~32 cols so Thermer fills 58mm like ESC/POS Font A */
  const maxChars = 32;
  const lines = buildReceiptLines(order, maxChars).filter((line) => !line.qr && !line.logo && !line.qrImage);
  const parts = [];
  if (isCustomReceipt(order)) {
    const logoMode = customLogoMode(order);
    if (logoMode === 'own') {
      const logoDataUrl = await getReceiptLogoMonoDataUrl(thermalWidth);
      if (logoDataUrl) {
        const raw = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
        if (raw) parts.push(`<IMAGE>1#${raw}`);
      }
    } else if (logoMode === 'custom' && order.custom_logo_data_url) {
      const logoDataUrl = await getCustomImageMonoDataUrl(order.custom_logo_data_url, thermalWidth, 0.72);
      if (logoDataUrl) {
        const raw = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
        if (raw) parts.push(`<IMAGE>1#${raw}`);
      }
    }
  } else {
    const logoDataUrl = await getReceiptLogoMonoDataUrl(thermalWidth);
    if (logoDataUrl) {
      const raw = logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
      if (raw) parts.push(`<IMAGE>1#${raw}`);
    }
  }
  lines.forEach((line) => {
    const text = sanitizeMatePlain(line.value);
    if (line.rule) {
      parts.push(`<010>${'-'.repeat(maxChars)}`);
      return;
    }
    if (line.spacer) {
      /* Tiny blank for item/footer rhythm (Thermer has no partial feed) */
      parts.push('<010> ');
      return;
    }
    if (!text) return;
    const bold = line.weight === 'bold' || line.title || line.grand || line.totalLabel ? '1' : '0';
    const align = line.align === 'center' ? '1' : line.align === 'right' ? '2' : '0';
    /* Grand: bold only — skip dH/dW so TOTAL stays tight and fits 32 cols */
    const format = line.title ? '3' : '0';
    parts.push(`<${bold}${align}${format}>${text}`);
  });
  /* Scan + QR already in buildReceiptLines; keep Mate QR sizing in sync */
  if (isCustomReceipt(order)) {
    const qrMode = customQrMode(order);
    if (qrMode === 'own') {
      parts.push(`<QR>1#${thermalQrModuleSize('58mm')}#${RECEIPT_SITE_URL}`);
    } else if (qrMode === 'custom' && order.custom_qr_image_data_url) {
      const qrImg = await getCustomImageMonoDataUrl(order.custom_qr_image_data_url, thermalWidth, 0.62);
      if (qrImg) {
        const raw = qrImg.replace(/^data:image\/\w+;base64,/, '');
        if (raw) parts.push(`<IMAGE>1#${raw}`);
      }
    } else if (qrMode === 'custom' && order.custom_qr_payload) {
      parts.push(`<QR>1#${thermalQrModuleSize('58mm')}#${sanitizeMatePlain(order.custom_qr_payload)}`);
    }
  } else {
    parts.push(`<QR>1#${thermalQrModuleSize('58mm')}#${RECEIPT_SITE_URL}`);
  }
  return parts.join('');
}

function mateThermalTextHrefFromMarkup(markup) {
  return (
    `intent:#Intent;action=android.intent.action.SEND;type=text/plain;`
    + `package=${MATE_THERMAL_PACKAGE};`
    + `S.android.intent.extra.TEXT=${encodeURIComponent(markup)};end`
  );
}

async function openMateThermalText(order, thermalWidth = '58mm') {
  if (!order || typeof window === 'undefined' || typeof document === 'undefined') return false;
  let markup = '';
  try {
    markup = (await buildMateThermalMarkup(order, thermalWidth))
      || buildThermalReceiptText(order, thermalWidth);
  } catch {
    markup = buildThermalReceiptText(order, thermalWidth);
  }
  const anchor = document.createElement('a');
  anchor.href = mateThermalTextHrefFromMarkup(markup);
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

const RECEIPT_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Shared receipt lines — tall glyphs, fewer cols so letters stay large. */
function isCustomReceipt(order) {
  return Boolean(order?.custom_receipt);
}

function customLogoMode(order) {
  if (!isCustomReceipt(order)) return 'none';
  if (order.use_own_logo || order.logo_source === 'own') return 'own';
  if (order.custom_logo_data_url) return 'custom';
  return 'none';
}

function customQrMode(order) {
  if (!isCustomReceipt(order)) return 'none';
  if (order.use_own_qr || order.scanner_source === 'own') return 'own';
  if (order.include_qr && (order.custom_qr_image_data_url || order.custom_qr_payload)) return 'custom';
  if (order.include_qr && order.scanner_source === 'custom') return 'custom';
  return 'none';
}

function shortReceiptDateParts(order) {
  if (order?.receipt_date || order?.receipt_time) {
    return {
      date: order.receipt_date || '-',
      time: order.receipt_time || '-',
    };
  }
  if (!order?.created_at) return { date: '-', time: '-' };
  const d = new Date(order.created_at);
  if (Number.isNaN(d.getTime())) return { date: '-', time: '-' };
  const day = String(d.getDate()).padStart(2, '0');
  const mon = RECEIPT_MONTHS[d.getMonth()] || 'JAN';
  const year = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return {
    /* Unique POS style: 26 JUL 2026 (not 23/07/26) */
    date: `${day} ${mon} ${year}`,
    time: `${hh}:${mi}`,
  };
}

function shortReceiptDate(order) {
  const { date, time } = shortReceiptDateParts(order);
  if (date === '-') return '-';
  return `${date} ${time}`;
}

function buildReceiptLines(order, maxChars = 18) {
  const { discount, grandTotal } = receiptTotals(order);
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
    /* Grand total: extra right inset so amounts (e.g. 2000) are not flush to the edge */
    const budget = Math.max(8, maxChars - (options.grand ? 4 : 1));
    if (left.length + 1 + right.length > budget) {
      right = thermalAmountText(value).replace(/^Rs\.\s*/, 'Rs.');
    }
    if (left.length + 1 + right.length > budget) {
      const n = Math.round(Number(value || 0));
      right = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    const gap = Math.max(1, budget - left.length - right.length);
    const padRight = Math.max(0, maxChars - budget);
    push(`${left}${' '.repeat(gap)}${right}${' '.repeat(padRight)}`, {
      ...options,
      columns: { left, right },
    });
  };

  const { date: billDate, time: billTime } = shortReceiptDateParts(order);
  const custom = isCustomReceipt(order);

  if (custom) {
    /* Freeform / trade bill — optional AsFix or custom logo, then text shop header */
    if (customLogoMode(order) !== 'none') {
      push('', { logo: true, align: 'center' });
    }
    wrap(order.shop_name || 'Shop', { align: 'center', weight: 'bold', title: true });
    if (order.shop_place) wrap(order.shop_place, { align: 'center', small: true });
    if (order.shop_phone) wrap(order.shop_phone, { align: 'center', small: true });
  } else {
    /* Logo → city → phone (no text shop name — graphic logo already has brand) */
    push('', { logo: true, align: 'center' });
    wrap(SHOP.addressLine2, { align: 'center', small: true });
    wrap(SHOP.phone, { align: 'center', small: true });
  }
  rule();
  kv('Bill', receiptNumber(order));
  /* Separate Date / Time so HH:mm never truncates (was showing 10:5) */
  kv('Date', billDate);
  kv('Time', billTime);
  /* No Staff line — Bill / Date / Time / Pay / Customer only */
  if (!custom) kv('Pay', paymentLabel(order?.payment_mode));
  if (order?.device_name) kv('Mobile', String(order.device_name));
  kv('Customer', order?.customer_name || 'Walk-in');
  if (order?.phone) kv('Phone', String(order.phone));
  rule();

  if (!rows.length) {
    push('No items');
  } else {
    rows.forEach((item, idx) => {
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
      /* Tiny gap between items so names are not glued (classic rhythm, not a blank band) */
      if (idx < rows.length - 1) push('', { spacer: true, itemGap: true });
    });
  }

  /* Items → rule → [Discount] → TOTAL → rule (no Subtotal; TOTAL stays compact) */
  rule();
  if (discount) money('Discount', discount);
  money('TOTAL AMOUNT', grandTotal, { weight: 'bold', grand: true });
  const note = counterPaymentNote(order);
  if (note) wrap(`Note: ${note}`, { small: true });
  if (custom && order?.notes) wrap(`Note: ${order.notes}`, { small: true });
  rule();
  /* Footer: Thank You → dashed line → Visit again → site → Scan → QR */
  push('Thank You', { align: 'center', weight: 'bold' });
  rule();
  push('Visit again', { align: 'center', small: true });
  if (!custom) {
    push(RECEIPT_SITE, { align: 'center', small: true });
    push('Scan', { align: 'center', small: true });
    push(RECEIPT_SITE_URL, { align: 'center', qr: true });
  } else {
    const qrMode = customQrMode(order);
    if (qrMode === 'own') {
      push(RECEIPT_SITE, { align: 'center', small: true });
      push('Scan', { align: 'center', small: true });
      push(RECEIPT_SITE_URL, { align: 'center', qr: true });
    } else if (qrMode === 'custom') {
      push('Scan', { align: 'center', small: true });
      if (order.custom_qr_image_data_url) {
        push(order.custom_qr_image_data_url, { align: 'center', qrImage: true });
      } else if (order.custom_qr_payload) {
        push(String(order.custom_qr_payload), { align: 'center', qr: true });
      }
    }
  }
  return lines;
}

/**
 * Thermal PNG for Direct Print / share (384 dots @ 58mm, 576 @ 80mm).
 * Fill-only glyphs, safe side margins, QR sized like ESC Z (fits roll).
 */
export async function createCounterReceiptPngBlob(order, thermalWidth = '58mm') {
  const pageWidth = normalizeThermalWidth(thermalWidth);
  /* 1px = 1 printer dot — avoids Chrome→POS-58 downscale mush */
  const printerDots = pageWidth === '80mm' ? 576 : 384;
  const widthPx = printerDots;
  /* Extra side pad so Windows POS-58 driver margins do not crop Bill#/prices */
  const padX = pageWidth === '80mm' ? 30 : 26;
  /* Top pad for logo — slightly more so header isn’t cramped without name text */
  const padTop = 40;
  const padBottom = 28;
  const maxChars = pageWidth === '80mm' ? 42 : 28;
  const lines = buildReceiptLines(order, maxChars);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas unavailable');

  const usable = widthPx - padX * 2;
  /* Bold only title + grand — lighter body (“pixels less dense”) */
  const isHeavy = (line) => Boolean(line?.title || line?.grand);

  const setFont = (size, heavy = false) => {
    /* Regular Arial only — no Arial Black / no stroke (those become thermal blobs) */
    ctx.font = heavy
      ? `600 ${size}px Arial, Helvetica, sans-serif`
      : `400 ${size}px Arial, Helvetica, sans-serif`;
  };

  const measureText = (text, size, heavy = false) => {
    setFont(size, heavy);
    return ctx.measureText(String(text ?? '')).width;
  };

  /* Body ~ Font A feel on 58mm; fit maxChars inside usable with room to spare */
  let fontSize = pageWidth === '80mm' ? 18 : 16;
  while (measureText('M'.repeat(maxChars), fontSize, false) > usable && fontSize > 11) {
    fontSize -= 1;
  }
  while (measureText('M'.repeat(maxChars), fontSize + 1, false) <= usable * 0.98 && fontSize < 20) {
    fontSize += 1;
  }

  const lineSize = (line) => {
    /* Grand TOTAL slightly larger — keep leading tight to dashed rules */
    if (line.grand) return Math.round(fontSize * 1.12);
    if (line.shopHeader) return Math.round(fontSize * 1.34);
    if (line.title) return Math.round(fontSize * 1.15);
    if (line.small) return Math.max(11, Math.round(fontSize * 0.88));
    return fontSize;
  };

  const fitText = (text, size, heavy) => {
    let value = String(text ?? '');
    if (!value) return '';
    while (value.length > 1 && measureText(value, size, heavy) > usable) {
      value = value.slice(0, -1);
    }
    return value;
  };

  const chunkAtSize = (text, size, heavy) => {
    const raw = String(text ?? '');
    if (!raw) return [''];
    const words = raw.split(/\s+/).filter(Boolean);
    const chunks = [];
    let current = '';
    const pushWord = (word) => {
      const next = current ? `${current} ${word}` : word;
      if (current && measureText(next, size, heavy) > usable) {
        chunks.push(fitText(current, size, heavy));
        if (measureText(word, size, heavy) > usable) {
          let piece = '';
          Array.from(word).forEach((ch) => {
            const tryNext = piece + ch;
            if (piece && measureText(tryNext, size, heavy) > usable) {
              chunks.push(piece);
              piece = ch;
            } else {
              piece = tryNext;
            }
          });
          current = piece;
        } else {
          current = word;
        }
      } else {
        current = next;
      }
    };
    if (words.length) words.forEach(pushWord);
    else {
      Array.from(raw).forEach((ch) => {
        const next = current + ch;
        if (current && measureText(next, size, heavy) > usable) {
          chunks.push(current);
          current = ch;
        } else {
          current = next;
        }
      });
    }
    if (current) chunks.push(fitText(current, size, heavy));
    return chunks.length ? chunks : [''];
  };

  /* Classic readable leading (~1.18) + ~1% — not ultra-compressed 1.02 */
  const lineHFor = (size) => Math.ceil(size * 1.19);
  const ruleH = Math.ceil(fontSize * 0.48);
  /*
   * QR: slightly larger (~74% of printable band) for easier scanning.
   * Mag 7–9 dots/module; never exceed roll width or printers drop the block.
   */
  const qrMag = thermalQrModuleSize(pageWidth);
  const qrMarginModules = 2;
  let qrModules = 29;
  try {
    const qrModel = QRCode.create(RECEIPT_SITE_URL, { errorCorrectionLevel: 'M' });
    qrModules = qrModel?.modules?.size || qrModules;
  } catch {
    /* keep default */
  }
  const qrSize = (qrModules + qrMarginModules * 2) * qrMag;
  const qrDrawSize = Math.min(qrSize, Math.floor(usable * 0.74));

  /* Estimate logo height (~square mark at ~76% width) */
  const logoEstimate = lines.some((line) => line.logo)
    ? Math.min(receiptLogoTargetDots(pageWidth), Math.floor(usable / 8) * 8) + 10
    : (isCustomReceipt(order) && customLogoMode(order) !== 'none'
      ? Math.floor(usable * 0.55) + 10
      : 0);

  let heightPx = padTop + padBottom + 4 + logoEstimate;
  lines.forEach((line, idx) => {
    if (line.logo) return;
    if (line.rule) {
      const nearGrand = Boolean(lines[idx - 1]?.grand || lines[idx + 1]?.grand);
      /* Slight rule breath; TOTAL stays compact (not old blank-band TOTAL) */
      heightPx += ruleH + (nearGrand ? 1 : 2);
      return;
    }
    if (line.qrImage) {
      heightPx += Math.floor(usable * 0.62) + 14;
      return;
    }
    if (line.qr) {
      heightPx += qrDrawSize + 14;
      return;
    }
    if (line.spacer) {
      heightPx += Math.max(line.itemGap ? 3 : 5, Math.round(fontSize * (line.itemGap ? 0.28 : 0.5)));
      return;
    }
    const size = lineSize(line);
    const lh = line.grand ? Math.ceil(size * 1.08) : lineHFor(size);
    if (line.columns) {
      heightPx += lh;
    } else {
      heightPx += chunkAtSize(line.value, size, isHeavy(line)).length * lh;
      if (line.shopHeader) heightPx += 3;
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
  ctx.imageSmoothingEnabled = false;

  const drawRuleLine = (y) => {
    const mid = Math.round(y + ruleH / 2) + 0.5;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padX, mid);
    ctx.lineTo(widthPx - padX, mid);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  /** Fill-only text — never stroke / never vertical stretch (those pixelate on POS-58). */
  const drawText = (text, anchorX, y, size, align = 'left', heavy = false) => {
    const value = fitText(text, size, heavy);
    if (!value) return;
    setFont(size, heavy);
    const totalW = measureText(value, size, heavy);
    let x = anchorX;
    if (align === 'center') x = anchorX - totalW / 2;
    if (align === 'right') x = anchorX - totalW;
    if (x < padX) x = padX;
    /* Extra right inset so TOTAL digits aren’t flush to the paper edge */
    const rightInset = padX + 6;
    if (x + totalW > widthPx - rightInset) x = Math.max(padX, widthPx - rightInset - totalW);
    ctx.fillText(value, Math.round(x), Math.round(y));
  };

  const drawCrispQr = async (payload, destX, destY, destSize) => {
    const qrCanvas = document.createElement('canvas');
    /* Render at exact module grid, then nearest-neighbor scale into receipt */
    await QRCode.toCanvas(qrCanvas, payload || RECEIPT_SITE_URL, {
      width: destSize,
      margin: qrMarginModules,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrCanvas, destX, destY, destSize, destSize);
    ctx.restore();
  };

  let y = padTop;
  if (isCustomReceipt(order)) {
    const logoMode = customLogoMode(order);
    if (logoMode === 'own') {
      const logoH = await drawReceiptLogoOnCanvas(ctx, {
        canvasWidth: widthPx,
        padX,
        y,
        thermalWidth: pageWidth,
      });
      if (logoH) y += logoH;
      else y += 4;
    } else if (logoMode === 'custom' && order.custom_logo_data_url) {
      const logoH = await drawCustomImageOnCanvas(ctx, {
        src: order.custom_logo_data_url,
        canvasWidth: widthPx,
        padX,
        y,
        thermalWidth: pageWidth,
        widthRatio: 0.72,
      });
      if (logoH) y += logoH;
      else y += 4;
    } else {
      y += 4;
    }
  } else {
    const logoH = await drawReceiptLogoOnCanvas(ctx, {
      canvasWidth: widthPx,
      padX,
      y,
      thermalWidth: pageWidth,
    });
    if (logoH) y += logoH;
    else y += 4;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.logo) continue;
    if (line.rule) {
      drawRuleLine(y);
      const nearGrand = Boolean(lines[i - 1]?.grand || lines[i + 1]?.grand);
      y += ruleH + (nearGrand ? 1 : 2);
      continue;
    }

    if (line.qrImage && line.value) {
      const imgH = await drawCustomImageOnCanvas(ctx, {
        src: line.value,
        canvasWidth: widthPx,
        padX,
        y,
        thermalWidth: pageWidth,
        widthRatio: 0.62,
      });
      y += (imgH || Math.round(qrDrawSize * 0.8)) + 8;
      continue;
    }

    if (line.qr) {
      const qrX = Math.round((widthPx - qrDrawSize) / 2);
      await drawCrispQr(line.value || RECEIPT_SITE_URL, qrX, y, qrDrawSize);
      y += qrDrawSize + 10;
      continue;
    }

    if (line.spacer) {
      y += Math.max(line.itemGap ? 3 : 5, Math.round(fontSize * (line.itemGap ? 0.28 : 0.5)));
      continue;
    }

    const heavy = isHeavy(line);
    const size = lineSize(line);
    /* Grand slightly airier than glyph — readable vs rules, not old huge TOTAL band */
    const lh = line.grand ? Math.ceil(size * 1.08) : lineHFor(size);

    if (line.columns) {
      let left = String(line.columns.left ?? '');
      let right = String(line.columns.right ?? '');
      const gapMin = line.grand ? 12 : 8;
      const rightEdge = widthPx - padX - (line.grand ? 14 : 4);
      const colUsable = rightEdge - padX;
      while (
        measureText(left, size, heavy) + gapMin + measureText(right, size, heavy) > colUsable
        && right.length > 1
      ) {
        right = right.slice(0, -1);
      }
      while (
        measureText(left, size, heavy) + gapMin + measureText(right, size, heavy) > colUsable
        && left.length > 1
      ) {
        left = left.slice(0, -1);
      }
      drawText(left, padX, y, size, 'left', heavy);
      drawText(right, rightEdge, y, size, 'right', heavy);
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
        drawText(chunk, anchor, y, size, align, heavy);
        y += lh;
      });
      if (line.shopHeader) y += 3;
    }
  }

  /* Trim unused bottom if logo estimate was high */
  const usedH = Math.min(heightPx, Math.ceil(y + padBottom));
  if (usedH < heightPx) {
    const trimmed = document.createElement('canvas');
    trimmed.width = widthPx;
    trimmed.height = usedH;
    const tctx = trimmed.getContext('2d', { alpha: false });
    if (tctx) {
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, widthPx, usedH);
      tctx.drawImage(canvas, 0, 0);
      return new Promise((resolve, reject) => {
        trimmed.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))),
          'image/png',
          1
        );
      });
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
  const marginTop = pdfPointsFromMillimeters(2.5);
  const marginBottom = pdfPointsFromMillimeters(1.2);
  const maxChars = pageWidth === '80mm' ? 26 : 18;
  const bodySize = pageWidth === '80mm' ? 13 : 12;
  const bodyLeading = pageWidth === '80mm' ? 18 : 17;
  const receiptLines = buildReceiptLines(order, maxChars)
    .filter((line) => !line.qr && !line.logo)
    .map((line) => ({
      value: line.value,
      size: line.grand
        ? bodySize + 2
        : line.title
          ? bodySize + 3
          : line.small
            ? bodySize - 0.5
            : bodySize,
      /* Classic body leading; TOTAL compact; spacer = footer/item breath only */
      leading: line.spacer
        ? Math.max(line.itemGap ? 3 : 5, bodyLeading * (line.itemGap ? 0.28 : 0.5))
        : line.grand
          ? bodySize + 4
          : line.title
            ? bodyLeading + 2
            : line.rule
              ? Math.max(9, bodyLeading - 3)
              : bodyLeading,
      align: line.align || 'left',
      font: line.weight === 'bold' || line.title || line.grand ? 'F2' : 'F1',
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
function buildThermalReceiptHtml(order, thermalWidth = '58mm', qrDataUrl = '', logoDataUrl = '') {
  const widthMm = thermalWidth === '80mm' ? 80 : 58;
  const custom = isCustomReceipt(order);
  const { discount, grandTotal } = receiptTotals(order);
  const paymentNote = counterPaymentNote(order);
  const dateParts = shortReceiptDateParts(order);
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
  padding: 6.5mm 2.5mm 2mm !important;
  font-family: "Courier New", Courier, monospace !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  line-height: 1.29 !important;
  letter-spacing: 0.04em !important;
  page-break-after: avoid !important;
  page-break-inside: avoid !important;
}
.r-shop { text-align: center; margin-bottom: 5px; }
.r-shop .r-logo { display: block; width: 76%; max-width: 76%; height: auto; margin: 2px auto 4px; }
.r-shop .r-shop-name { display: block; margin: 2px 0 4px; font-size: 16px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.r-shop p { margin: 2px 0; font-size: 12px; font-weight: 400; letter-spacing: 0.04em; }
.r-meta { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; margin: 4px 0; font-size: 13px; font-weight: 400; }
.r-meta span:last-child { text-align: right; }
.r-rule { border: 0; border-top: 1px dashed #000; margin: 3px 0; padding: 0; }
.r-item { margin: 0 0 3px; }
.r-item strong { display: block; font-size: 13px; font-weight: 400; letter-spacing: 0.04em; }
.r-row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 400; }
.r-totals { display: grid; grid-template-columns: 1fr auto; gap: 0 8px; font-size: 13px; font-weight: 400; margin: 0; padding: 0; line-height: 1.15; }
.r-totals > * { min-width: 0; }
.r-totals strong { text-align: right; white-space: nowrap; font-weight: 400; }
.r-grand-row { display: grid; grid-template-columns: 1fr auto; gap: 0 10px; align-items: baseline; margin: 1px 0; padding: 0 2mm 0 0; line-height: 1.12; }
.r-grand-label { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; line-height: 1.12; }
.r-grand { font-size: 15px; font-weight: 700; letter-spacing: 0.06em; text-align: right; white-space: nowrap; padding-right: 1mm; line-height: 1.12; }
.r-thanks { text-align: center; margin: 3px 0 2px; font-size: 12px; font-weight: 700; }
.r-visit { text-align: center; margin: 3px 0 0; font-size: 11px; font-weight: 400; }
.r-site { text-align: center; margin: 2px 0 0; font-size: 12px; font-weight: 400; }
.r-scan { text-align: center; margin: 4px 0 2px; font-size: 12px; font-weight: 400; letter-spacing: 0.04em; }
.r-qr { display: block; width: 74%; max-width: 74%; height: auto; margin: 2px auto 4px; }
`.trim();

  const qrMode = custom ? customQrMode(order) : 'sale';
  const qrBlock = custom
    ? (qrMode === 'own'
      ? (qrDataUrl
        ? `<p class="r-scan">Scan</p>
  <img class="r-qr" src="${qrDataUrl}" alt="asfixgear.com QR" width="260" height="260" />`
        : '')
      : (qrMode === 'custom'
        ? (order.custom_qr_image_data_url
          ? `<p class="r-scan">Scan</p><img class="r-qr" src="${order.custom_qr_image_data_url}" alt="QR" width="260" height="260" />`
          : (order.custom_qr_payload && qrDataUrl
            ? `<p class="r-scan">Scan</p><img class="r-qr" src="${qrDataUrl}" alt="QR" width="260" height="260" />`
            : ''))
        : ''))
    : (qrDataUrl
      ? `<p class="r-scan">Scan</p>
  <img class="r-qr" src="${qrDataUrl}" alt="asfixgear.com QR" width="260" height="260" />`
      : '');

  const logoMode = custom ? customLogoMode(order) : 'sale';
  const logoBlock = custom
    ? `${logoMode === 'own'
      ? `<img class="r-logo" src="${logoDataUrl || RECEIPT_LOGO_PATH}" alt="" width="280" height="280" />`
      : (logoMode === 'custom' && order.custom_logo_data_url
        ? `<img class="r-logo" src="${order.custom_logo_data_url}" alt="" width="280" height="280" />`
        : '')}
    <strong class="r-shop-name">${escapeHtml(order.shop_name || 'Shop')}</strong>
    ${order.shop_place ? `<p>${escapeHtml(order.shop_place)}</p>` : ''}
    ${order.shop_phone ? `<p>${escapeHtml(order.shop_phone)}</p>` : ''}`
    : (logoDataUrl
      ? `<img class="r-logo" src="${logoDataUrl}" alt="" width="280" height="280" />`
      : `<img class="r-logo" src="${RECEIPT_LOGO_PATH}" alt="" width="280" height="280" />`)
      + `<p>${escapeHtml(SHOP.addressLine2)}</p><p>${escapeHtml(SHOP.phone)}</p>`;

  const noteBlock = custom && order?.notes
    ? `<p class="r-visit">Note: ${escapeHtml(order.notes)}</p>`
    : paymentNote
      ? `<p class="r-visit">Note: ${escapeHtml(paymentNote)}</p>`
      : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=${widthMm}, initial-scale=1" />
<title>${escapeHtml(custom ? (order.shop_name || 'Bill') : 'AsFix')} ${escapeHtml(receiptNumber(order))}</title>
<style>${css}</style></head><body>
<main class="receipt">
  <div class="r-shop">
    ${logoBlock}
  </div>
  <hr class="r-rule" />
  <div class="r-meta">
    <span>Bill</span><span>${escapeHtml(receiptNumber(order))}</span>
    <span>Date</span><span>${escapeHtml(dateParts.date)}</span>
    <span>Time</span><span>${escapeHtml(dateParts.time)}</span>
    ${custom ? '' : `<span>Pay</span><span>${escapeHtml(paymentLabel(order?.payment_mode))}${paymentNote ? ` (${escapeHtml(paymentNote)})` : ''}</span>`}
    ${order?.device_name ? `<span>Mobile</span><span>${escapeHtml(String(order.device_name))}</span>` : ''}
    <span>Customer</span><span>${escapeHtml(order?.customer_name || 'Walk-in')}</span>
    ${order?.phone ? `<span>Phone</span><span>${escapeHtml(String(order.phone))}</span>` : ''}
  </div>
  <hr class="r-rule" />
  ${items || '<div class="r-item">No items</div>'}
  <hr class="r-rule" />
  ${discount ? `<div class="r-totals"><span>Discount</span><strong>${escapeHtml(thermalAmountText(discount))}</strong></div>` : ''}
  <div class="r-grand-row">
    <span class="r-grand-label">TOTAL AMOUNT</span>
    <strong class="r-grand">${escapeHtml(thermalAmountText(grandTotal))}</strong>
  </div>
  ${noteBlock}
  <hr class="r-rule" />
  <p class="r-thanks">Thank You</p>
  <hr class="r-rule" />
  <p class="r-visit">Visit again</p>
  ${custom ? '' : `<p class="r-site">${escapeHtml(RECEIPT_SITE)}</p>`}
  ${qrBlock}
</main>
</body></html>`;
}

/** Content-height PNG sheet for Direct Print — never a tall PDF / never driver 3276mm. */
function buildThermalPngPrintHtml(dataUrl, widthMm, heightMm) {
  const paperW = Number(widthMm) || 58;
  /*
   * Full paper width (58/80mm). Side crop lives inside the PNG (padX), not as a
   * narrower centered strip — Chrome "fit to page" was shrinking a 56mm image on
   * a 58mm sheet, and forced img height caused progressive scale-down on reprints.
   * Image uses width + height:auto so aspect stays 1:1 with printer dots (203dpi).
   */
  const contentH = Math.max(40, Math.min(280, Number(heightMm) || 120));
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=${paperW}, initial-scale=1, maximum-scale=1" />
<title>AsFix receipt</title>
<style>
@page { size: ${paperW}mm ${contentH}mm; margin: 0; }
html {
  margin: 0 !important;
  padding: 0 !important;
  width: ${paperW}mm !important;
  max-width: ${paperW}mm !important;
  min-width: ${paperW}mm !important;
  height: ${contentH}mm !important;
  zoom: 1 !important;
  transform: none !important;
  background: #fff !important;
}
body {
  margin: 0 !important;
  padding: 0 !important;
  width: ${paperW}mm !important;
  max-width: ${paperW}mm !important;
  min-width: ${paperW}mm !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible !important;
  zoom: 1 !important;
  transform: none !important;
  background: #fff !important;
  box-sizing: border-box !important;
}
img {
  display: block !important;
  width: ${paperW}mm !important;
  max-width: none !important;
  min-width: ${paperW}mm !important;
  height: auto !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  zoom: 1 !important;
  transform: none !important;
  image-rendering: pixelated !important;
  image-rendering: crisp-edges !important;
  -ms-interpolation-mode: nearest-neighbor !important;
}
@media print {
  html, body, img {
    zoom: 1 !important;
    transform: none !important;
  }
}
</style></head><body>
<img src="${dataUrl}" alt="AsFix receipt" width="${paperW === 80 ? 576 : 384}" />
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
    heightMm = Math.max(40, Math.min(280, Math.ceil(Number(forcedHeightMm))));
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
    heightMm = Math.max(40, Math.min(heightMm, 280));
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
  min-width: ${w}mm !important;
  height: ${heightMm}mm !important;
  min-height: 0 !important;
  max-height: ${heightMm}mm !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  zoom: 1 !important;
  transform: none !important;
}
img {
  width: ${w}mm !important;
  max-width: none !important;
  height: auto !important;
  zoom: 1 !important;
  transform: none !important;
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
      const dataBase64 = await buildThermalReceiptEscPosBase64(order, thermalWidth);
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
     * Exact @page 58mm×Nmm from printer-dot aspect (384px = 58mm @ 203dpi) so POS-58
     * cannot spool 3276mm and Chrome cannot "fit" a narrower strip into a smaller scale.
     */
    const width = normalizeThermalWidth(thermalWidth);
    const widthMm = width === '80mm' ? 80 : 58;
    const printerDots = widthMm === 80 ? 576 : 384;
    const blob = await createCounterReceiptPngBlob(order, width);
    const dataUrl = await blobToDataUrl(blob);
    const dims = await loadImageNaturalSize(dataUrl);
    /* 1px = 1 printer dot — same visual scale as Android BT / share / download PNG */
    const heightMm = Math.max(
      40,
      Math.min(280, Math.ceil((Math.max(1, dims.height) / printerDots) * widthMm) + 4),
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
      const dataBase64 = await buildThermalReceiptEscPosBase64(order, thermalWidth);
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
        await openMateThermalText(order, thermalWidth);
        finishPrintJob(inFlightRef);
        return { ok: true };
      }
      await openMateThermalText(order, thermalWidth);
      finishPrintJob(inFlightRef);
      return { ok: true };
    }

    /* Laptop: full ESC/POS (32-col + QR + logo) via COM bridge or Web Bluetooth */
    try {
      const dataBase64 = await buildThermalReceiptEscPosBase64(order, thermalWidth);
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
    const widthMm = width === '80mm' ? 80 : 58;
    const printerDots = widthMm === 80 ? 576 : 384;
    /* Same PNG Direct Print path as laptop — consistent 58mm scale (no HTML text shrink) */
    try {
      const blob = await createCounterReceiptPngBlob(order, width);
      const dataUrl = await blobToDataUrl(blob);
      const dims = await loadImageNaturalSize(dataUrl);
      const heightMm = Math.max(
        40,
        Math.min(280, Math.ceil((Math.max(1, dims.height) / printerDots) * widthMm) + 4),
      );
      const html = buildThermalPngPrintHtml(dataUrl, widthMm, heightMm);
      const printed = await printViaIframe(html, inFlightRef, widthMm, heightMm);
      return printed ? { ok: true } : { ok: false, reason: 'print_failed', message: 'Browser print failed' };
    } catch {
      let qrDataUrl = '';
      let logoDataUrl = '';
      try {
        if (isCustomReceipt(order)) {
          const qrMode = customQrMode(order);
          if (qrMode === 'own') {
            qrDataUrl = await buildWebsiteQrDataUrl(280);
          } else if (qrMode === 'custom' && order.custom_qr_image_data_url) {
            qrDataUrl = order.custom_qr_image_data_url;
          } else if (qrMode === 'custom' && order.custom_qr_payload) {
            qrDataUrl = await buildWebsiteQrDataUrl(280, order.custom_qr_payload);
          }
        } else {
          qrDataUrl = await buildWebsiteQrDataUrl(280);
        }
      } catch {
        qrDataUrl = '';
      }
      try {
        if (isCustomReceipt(order)) {
          const logoMode = customLogoMode(order);
          if (logoMode === 'own') {
            logoDataUrl = await getReceiptLogoMonoDataUrl(width);
          } else if (logoMode === 'custom' && order.custom_logo_data_url) {
            logoDataUrl = await getCustomImageMonoDataUrl(order.custom_logo_data_url, width, 0.72);
          } else {
            logoDataUrl = '';
          }
        } else {
          logoDataUrl = await getReceiptLogoMonoDataUrl(width);
        }
      } catch {
        logoDataUrl = '';
      }
      const html = buildThermalReceiptHtml(order, width, qrDataUrl, logoDataUrl);
      const printed = await printViaIframe(html, inFlightRef, widthMm);
      return printed ? { ok: true } : { ok: false, reason: 'print_failed', message: 'Browser print failed' };
    }
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
export async function openMateThermalReceipt(order, thermalWidth = readThermalReceiptWidth()) {
  if (!order || typeof window === 'undefined') return false;
  if (!claimPrintSlot(order)) return false;
  return openMateThermalText(order, thermalWidth);
}

function mateThermalTextHref(order) {
  /* Sync fallback for rare <a href> — logo-less text; prefer openMateThermalText */
  const text = buildThermalReceiptText(order);
  return mateThermalTextHrefFromMarkup(text);
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
    if (isAndroidDevice() && !isNativePosApp()) void openMateThermalText(order);
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
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!order) {
      setQrDataUrl('');
      return undefined;
    }
    let cancelled = false;
    buildWebsiteQrDataUrl(280)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [order]);

  if (!order) return null;

  const paymentNote = counterPaymentNote(order);
  const { discount, grandTotal } = receiptTotals(order);

  return (
    <div
      className={`counter-bill-print${printable ? ' counter-bill-print--active' : ''}`}
      style={{ '--thermal-receipt-width': thermalWidth }}
      aria-label={t('admin.counterBillReceipt')}
    >
      <div className="counter-bill-print__shop">
        <img
          className="counter-bill-print__logo"
          src={RECEIPT_LOGO_PATH}
          alt=""
          width="120"
          height="120"
          decoding="async"
        />
        <p>{SHOP.addressLine2}</p>
        <p>{SHOP.phone}</p>
      </div>
      <div className="counter-bill-print__meta">
        <span>{t('admin.counterBillNo')}: {order.order_id || order.id}</span>
        <span>{t('admin.counterBillDate')}: {order.created_at ? shortReceiptDate(order) : '-'}</span>
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
      <div className="counter-bill-print__rule" />
      <p className="counter-bill-print__visit">Visit again</p>
      <p className="counter-bill-print__site">{RECEIPT_SITE}</p>
      <p className="counter-bill-print__scan">Scan</p>
      {qrDataUrl ? (
        <img className="counter-bill-print__qr" src={qrDataUrl} alt="asfixgear.com QR" width="184" height="184" />
      ) : (
        <p className="counter-bill-print__site">{RECEIPT_SITE_URL}</p>
      )}
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
  onOpenPrinterSetup,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const searchRef = useRef(null);
  const noteRef = useRef(null);
  const stickyDockRef = useRef(null);
  const printInFlightRef = useRef(false);
  const autoPrintedOrderRef = useRef(null);
  const [draftSeed] = useState(() => readCounterBillDraft());
  const [thermalWidth, setThermalWidth] = useState(() => readThermalReceiptWidth());
  const nativePos = isNativePosApp();
  const [nativePrinter, setNativePrinter] = useState(null);
  const { printSmart, openPrintSetup, chooser: printChooser } = useSmartThermalPrint({
    thermalWidth,
    agentReady: !nativePos || Boolean(nativePrinter?.address),
  });
  const [nativePrinters, setNativePrinters] = useState([]);
  const [nativePrinterBusy, setNativePrinterBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  /** Spacer height while search is fixed-lifted (keeps layout from collapsing). */
  const [searchSlotH, setSearchSlotH] = useState(0);
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
  const [highlightProductId, setHighlightProductId] = useState(null);
  const [focusedLineId, setFocusedLineId] = useState(null);
  /** While typing sell rate: allow empty string (not clamped to list/1). */
  const [rateDrafts, setRateDrafts] = useState({});
  const sellRateRefs = useRef({});
  const cashReceivedRef = useRef(null);
  const [dockFocus, setDockFocus] = useState(null); /* search | discount | customer | null */
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

  /* Lift POS dock above Android/iOS keyboard so Search/Discount/Customer stay usable */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const vv = window.visualViewport;
      let inset = 0;
      let top = 0;
      if (vv) {
        inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        top = Math.max(0, Math.round(vv.offsetTop || 0));
      }
      root.style.setProperty('--pos-vv-bottom', `${inset}px`);
      root.style.setProperty('--pos-vv-top', `${top}px`);
      root.classList.toggle('pos-keyboard-open', inset > 72);
    };
    /* Coalesce visualViewport churn to one paint per frame (120Hz-friendly). */
    const sync = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(apply);
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', sync);
      root.style.removeProperty('--pos-vv-bottom');
      root.style.removeProperty('--pos-vv-top');
      root.classList.remove('pos-keyboard-open');
    };
  }, []);

  /* Keep document-flow height while search is fixed to the top (keyboard-safe lift). */
  useLayoutEffect(() => {
    if (!searchFocused) {
      setSearchSlotH(0);
      return;
    }
    const el = document.getElementById('counter-bill-search');
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    if (h > 0) setSearchSlotH((prev) => (prev > 0 ? prev : h));
  }, [searchFocused]);

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

  const openPrinterSetup = useCallback(() => {
    if (typeof onOpenPrinterSetup === 'function') {
      onOpenPrinterSetup();
      return;
    }
    if (nativePos) {
      void refreshNativePrinters();
      return;
    }
    openPrintSetup();
  }, [nativePos, onOpenPrinterSetup, openPrintSetup, refreshNativePrinters]);

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
    const dataBase64 = await buildThermalReceiptEscPosBase64(order, thermalWidth);
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
      openPrinterSetup();
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
  }, [nativePos, t, openPrinterSetup]);

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

  const subtotal = lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.qty, 0);
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
  const selectedItemCount = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);

  const billSnapshot = useCallback(() => ({
    lines: lines.map((line) => ({
      product: line.product,
      qty: line.qty,
      unitPrice: lineUnitPrice(line),
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
    setRateDrafts({});
    setFocusedLineId(null);
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
        unitPrice: lineUnitPrice(line),
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

  /** Item name/row → scroll + highlight product tile in the grid (not the rate field). */
  const jumpToCartProduct = useCallback((productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id)) return;
    setProductPanelCollapsed(false);
    setQuery('');
    setSelectedCategory(ALL_CATEGORIES);
    setFocusedLineId(id);
    setHighlightProductId(id);
    window.setTimeout(() => {
      document.getElementById(`counter-product-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 60);
    window.setTimeout(() => {
      setHighlightProductId((current) => (current === id ? null : current));
    }, 2200);
  }, []);

  /** Rate control → land on that line’s sell-rate input (do not scroll product grid away). */
  const focusSellRate = useCallback((productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id)) return;
    setFocusedLineId(id);
    setHighlightProductId(id);
    window.setTimeout(() => {
      const input = sellRateRefs.current[id];
      const row = document.getElementById(`counter-cart-row-${id}`);
      (row || input)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      if (!input) return;
      window.setTimeout(() => {
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus?.();
        }
        try {
          input.select?.();
        } catch {
          /* select unsupported on some number inputs */
        }
      }, 120);
    }, 40);
    window.setTimeout(() => {
      setHighlightProductId((current) => (current === id ? null : current));
    }, 2200);
  }, []);

  /** Pin section near the top of the screen — never center (that overshoots Discount → Customer). */
  const softScrollToSection = useCallback((sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const topPad = 12;
    const dockReserve = 100;
    let vvBottom = 0;
    try {
      vvBottom = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--pos-vv-bottom') || '0',
        10,
      ) || 0;
    } catch {
      vvBottom = 0;
    }
    const viewH = window.visualViewport?.height || window.innerHeight || 0;
    const rect = section.getBoundingClientRect();
    /* Already usable above the sticky dock — do not jump the page. */
    if (rect.top >= topPad && rect.top <= Math.max(topPad + 8, viewH - dockReserve - vvBottom - 48)) {
      return;
    }
    const nextTop = Math.max(0, window.scrollY + rect.top - topPad);
    window.scrollTo({ top: nextTop, behavior: 'smooth' });
  }, []);

  const focusWithoutScroll = useCallback((el) => {
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      try {
        el.focus();
      } catch {
        /* ignore */
      }
    }
  }, []);

  /** Dock “N items” → scroll to cart / bill items panel. */
  const jumpToCartPanel = useCallback(() => {
    setProductPanelCollapsed(false);
    window.setTimeout(() => {
      softScrollToSection('counter-bill-cart');
    }, 30);
  }, [softScrollToSection]);

  /** Grand total / amount → Amount Received (cash) so cashier can tender + print. */
  const jumpToAmountReceived = useCallback(() => {
    setPaymentMode('cash');
    window.setTimeout(() => {
      softScrollToSection('counter-bill-cash');
      const input = cashReceivedRef.current;
      if (!input) return;
      window.setTimeout(() => {
        focusWithoutScroll(input);
        try {
          input.select?.();
        } catch {
          /* ignore */
        }
      }, 180);
    }, 40);
  }, [focusWithoutScroll, softScrollToSection]);

  const jumpToSearch = useCallback(() => {
    const input = searchRef.current;
    /*
     * Focus FIRST in this same pointer gesture — mobile only opens the keyboard then.
     * Never scrollTo/scrollIntoView here (scroll dismisses an opening keyboard).
     * Visibility: CSS fixed-lifts #counter-bill-search while searchFocused.
     */
    const wrap = document.getElementById('counter-bill-search');
    if (wrap && !wrap.classList.contains('counter-bill__search-wrap--lifted')) {
      const h = Math.ceil(wrap.getBoundingClientRect().height);
      if (h > 0) setSearchSlotH(h);
    }
    if (input) {
      try {
        input.focus({ preventScroll: true });
      } catch {
        try {
          input.focus();
        } catch {
          /* ignore */
        }
      }
    }
    setProductPanelCollapsed(false);
    setDockFocus('search');
    setSearchFocused(true);
  }, []);

  /** Dock Search: open keyboard on pointerdown (same gesture); click is backup for keyboard activation. */
  const onSearchDockPointerDown = useCallback((e) => {
    if (typeof e.button === 'number' && e.button !== 0) return;
    /* Keep focus on the search input — dock button must not steal it. */
    e.preventDefault();
    jumpToSearch();
  }, [jumpToSearch]);

  const onSearchDockClick = useCallback((e) => {
    /* detail === 0 → activated via keyboard (Enter/Space), not a pointer tap. */
    if (e.detail === 0) jumpToSearch();
  }, [jumpToSearch]);

  const jumpToDiscount = useCallback(() => {
    setDockFocus('discount');
    window.setTimeout(() => {
      softScrollToSection('counter-bill-discount');
      window.setTimeout(() => {
        focusWithoutScroll(document.querySelector('#counter-bill-discount input'));
        /* One soft re-pin after keyboard — no center scroll, no tight loop. */
        window.setTimeout(() => softScrollToSection('counter-bill-discount'), 280);
      }, 160);
    }, 40);
  }, [focusWithoutScroll, softScrollToSection]);

  const jumpToCustomer = useCallback(() => {
    setShowCustomerDetails(true);
    setDockFocus('customer');
    window.setTimeout(() => {
      softScrollToSection('counter-bill-customer');
      window.setTimeout(() => {
        focusWithoutScroll(document.querySelector('#counter-bill-customer input'));
        window.setTimeout(() => softScrollToSection('counter-bill-customer'), 280);
      }, 160);
    }, 80);
  }, [focusWithoutScroll, softScrollToSection]);

  const blurSearchKeyboard = useCallback(() => {
    setSearchFocused(false);
    try {
      searchRef.current?.blur();
    } catch {
      /* ignore */
    }
    try {
      if (typeof document !== 'undefined' && document.activeElement?.blur) {
        document.activeElement.blur();
      }
    } catch {
      /* ignore */
    }
  }, []);

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
      return [...prev, { product, qty: 1, unitPrice: salePrice(product) }];
    });
    setQuery('');
    /* Never re-focus search after add — that opens the mobile keyboard on every tap */
    blurSearchKeyboard();
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
    setCartFlashKey(Date.now());
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
    setFocusedLineId((current) => (current === productId ? null : current));
    setRateDrafts((prev) => {
      if (prev[productId] === undefined) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  /**
   * Sell-rate path only — never Math.max(1, …) (that is qty).
   * Empty / invalid while editing → treat as 0 (not catalog list price).
   */
  const setUnitPrice = (productId, value) => {
    setReceiptOrder(null);
    setCartFlashKey(Date.now());
    const trimmed = String(value ?? '').trim();
    let next = 0;
    if (trimmed !== '' && trimmed !== '-' && trimmed !== '.') {
      const raw = Number(trimmed);
      if (Number.isFinite(raw) && raw >= 0) next = Math.round(raw);
    }
    setLines((prev) =>
      prev.map((line) => (line.product.id !== productId ? line : { ...line, unitPrice: next }))
    );
  };

  const commitSellRateDraft = (productId) => {
    const draft = rateDrafts[productId];
    if (draft === undefined) return;
    setUnitPrice(productId, draft);
    setRateDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  /** OK on sell rate: dismiss keyboard unless below cost (keep focus + warning). */
  const confirmSellRate = useCallback((productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id)) return;
    const line = lines.find((item) => item.product.id === id);
    if (!line) return;
    const draft = rateDrafts[id];
    let unit = lineUnitPrice(line);
    if (draft !== undefined) {
      const trimmed = String(draft).trim();
      if (trimmed === '' || trimmed === '-' || trimmed === '.') unit = 0;
      else {
        const raw = Number(trimmed);
        unit = Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 0;
      }
    }
    commitSellRateDraft(id);
    const cost = Math.max(0, Number(line.product.cost_price) || 0);
    if (cost > 0 && unit < cost) {
      setFocusedLineId(id);
      window.setTimeout(() => {
        const input = sellRateRefs.current[id];
        if (!input) return;
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus?.();
        }
        try {
          input.select?.();
        } catch {
          /* ignore */
        }
      }, 30);
      return;
    }
    setFocusedLineId(null);
    window.setTimeout(() => {
      try {
        sellRateRefs.current[id]?.blur();
      } catch {
        /* ignore */
      }
      try {
        if (typeof document !== 'undefined' && document.activeElement?.blur) {
          document.activeElement.blur();
        }
      } catch {
        /* ignore */
      }
    }, 0);
  }, [lines, rateDrafts]);

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
          price: lineUnitPrice(line),
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
      if (!latestProduct) return null;
      const savedPrice = Number(item.price);
      return {
        product: latestProduct,
        qty: Number(item.qty) || 1,
        unitPrice: Number.isFinite(savedPrice) && savedPrice >= 0
          ? Math.round(savedPrice)
          : salePrice(latestProduct),
      };
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
          price: lineUnitPrice(line),
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

          <div
            className="counter-bill__search-slot"
            style={searchFocused && searchSlotH > 0 ? { minHeight: searchSlotH } : undefined}
          >
            <div
              className={`counter-bill__search-wrap${searchFocused ? ' counter-bill__search-wrap--lifted' : ''}`}
              id="counter-bill-search"
            >
              <label className="counter-bill__search">
                <span>{t('admin.counterBillSearch')}</span>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => {
                    const wrap = document.getElementById('counter-bill-search');
                    if (wrap && !wrap.classList.contains('counter-bill__search-wrap--lifted')) {
                      const h = Math.ceil(wrap.getBoundingClientRect().height);
                      if (h > 0) setSearchSlotH(h);
                    }
                    setSearchFocused(true);
                    setDockFocus('search');
                  }}
                  onBlur={() => {
                    setSearchFocused(false);
                    setDockFocus((cur) => (cur === 'search' ? null : cur));
                  }}
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
          </div>

          {!productPanelCollapsed ? (
            <div className="counter-bill__products">
              {filteredProducts.length === 0 ? (
                <p className="counter-bill__empty">{t('admin.counterBillNoMatch')}</p>
              ) : null}
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  id={`counter-product-${product.id}`}
                  type="button"
                  className={`counter-bill__product-tile${
                    highlightProductId === product.id ? ' counter-bill__product-tile--jump' : ''
                  }`}
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

        <section
          id="counter-bill-cart"
          className={`counter-bill__panel counter-bill__panel--cart${cartFlashKey ? ' counter-bill__panel--flash' : ''}`}
        >
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
            <button type="button" onClick={jumpToDiscount}>
              <span aria-hidden="true">%</span>
              {t('admin.counterBillToolbarDiscount')}
            </button>
            <button type="button" onClick={jumpToCustomer}>
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
                const actual = salePrice(line.product);
                const unit = lineUnitPrice(line);
                const stock = Number(line.product.stock) || 1;
                const cost = Math.max(0, Number(line.product.cost_price) || 0);
                const rateWarnBelowList = actual > 0 && unit < actual;
                const rateWarnBelowCost = cost > 0 && unit < cost;
                const rateWarnHigh = actual > 0 && unit > actual;
                const isFocused = focusedLineId === line.product.id;
                const rateDraft = rateDrafts[line.product.id];
                const rateInputValue = rateDraft !== undefined ? rateDraft : String(unit);
                return (
                  <article
                    id={`counter-cart-row-${line.product.id}`}
                    className={`counter-bill__cart-row${isFocused ? ' counter-bill__cart-row--focus' : ''}`}
                    key={line.product.id}
                  >
                    <span className="counter-bill__cart-index">{index + 1}</span>
                    <button
                      type="button"
                      className="counter-bill__cart-item"
                      onClick={() => jumpToCartProduct(line.product.id)}
                      title={t('admin.counterBillGoToItem')}
                    >
                      <strong>{line.product.name}</strong>
                      <small>{t('admin.stockLabel', { count: stock })}</small>
                    </button>
                    <div
                      className="counter-bill__cart-rate"
                      onPointerDown={(e) => {
                        if (e.target.closest('input, button')) return;
                        e.preventDefault();
                        focusSellRate(line.product.id);
                      }}
                    >
                      <div className="counter-bill__cart-rate-row">
                        <label className="counter-bill__cart-rate-label">
                          <span>{t('admin.counterBillSellRate')}</span>
                          <input
                            ref={(el) => {
                              if (el) sellRateRefs.current[line.product.id] = el;
                              else delete sellRateRefs.current[line.product.id];
                            }}
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={rateInputValue}
                            onFocus={() => {
                              setFocusedLineId(line.product.id);
                              setRateDrafts((prev) => (
                                prev[line.product.id] !== undefined
                                  ? prev
                                  : { ...prev, [line.product.id]: String(unit) }
                              ));
                            }}
                            onChange={(e) => {
                              const next = e.target.value;
                              setRateDrafts((prev) => ({ ...prev, [line.product.id]: next }));
                              setUnitPrice(line.product.id, next);
                            }}
                            onBlur={() => commitSellRateDraft(line.product.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                confirmSellRate(line.product.id);
                              }
                            }}
                            aria-label={`${line.product.name} ${t('admin.counterBillSellRate')}`}
                          />
                        </label>
                        <button
                          type="button"
                          className={`counter-bill__cart-rate-ok${rateWarnBelowCost ? ' counter-bill__cart-rate-ok--blocked' : ''}`}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={() => confirmSellRate(line.product.id)}
                          aria-label={t('admin.counterBillRateOk')}
                          title={
                            rateWarnBelowCost
                              ? t('admin.counterBillRateBelowCostWarn')
                              : t('admin.counterBillRateOk')
                          }
                        >
                          {t('admin.counterBillRateOk')}
                        </button>
                      </div>
                      <div className="counter-bill__cart-refs">
                        <small className="counter-bill__cart-actual">
                          {t('admin.counterBillActualPrice', { price: formatPrice(actual) })}
                        </small>
                        <small className="counter-bill__cart-cost">
                          {t('admin.counterBillCostPrice', {
                            price: cost > 0 ? formatPrice(cost) : t('admin.counterBillCostUnset'),
                          })}
                        </small>
                      </div>
                      {rateWarnBelowCost ? (
                        <small className="counter-bill__cart-rate-warn counter-bill__cart-rate-warn--cost">
                          {t('admin.counterBillRateBelowCostWarn')}
                        </small>
                      ) : null}
                      {rateWarnBelowList && !rateWarnBelowCost ? (
                        <small className="counter-bill__cart-rate-warn">{t('admin.counterBillRateLowWarn')}</small>
                      ) : null}
                      {rateWarnHigh ? (
                        <small className="counter-bill__cart-rate-warn counter-bill__cart-rate-warn--high">
                          {t('admin.counterBillRateHighWarn')}
                        </small>
                      ) : null}
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
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0"
                autoComplete="off"
                enterKeyHint="done"
              />
            </label>
            {discountNeedsOverride ? (
              <p className="counter-bill__discount-warning">
                Manager approval required above {posSettings.posDiscountMaxPercentWithoutPin}% or Rs. {posSettings.posDiscountMaxAmountWithoutPin}.
              </p>
            ) : null}
          </div>

          <div id="counter-bill-customer" className="counter-bill__customer-anchor">
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
                    autoComplete="off"
                    enterKeyHint="next"
                  />
                </label>
                <label>
                  <span>{t('admin.counterBillPhone')}</span>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={t('admin.counterBillPhonePh')}
                    maxLength={30}
                    inputMode="tel"
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                </label>
              </div>
            ) : null}
          </div>

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

          <div
            className="counter-bill__cash-box"
            id="counter-bill-cash"
            hidden={paymentMode !== 'cash'}
            aria-hidden={paymentMode !== 'cash'}
          >
            <label>
              <span>{t('admin.counterBillAmountReceived')}</span>
              <input
                ref={cashReceivedRef}
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
            <div className={`counter-bill__summary-card${cartFlashKey ? ' counter-bill__summary-card--flash' : ''}`} aria-label={t('admin.counterBillSummary')}>
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
              {paymentMode === 'cash' && Number.isFinite(cashReceivedValue) && cashReceived !== '' ? (
                <div>
                  <span>{t('admin.counterBillAmountReceived')}</span>
                  <strong>{formatPrice(cashReceivedValue)}</strong>
                </div>
              ) : null}
              {paymentMode === 'cash' && Number.isFinite(cashReceivedValue) && cashReceived !== '' ? (
                <div>
                  <span>{t('admin.counterBillChangeReturn')}</span>
                  <strong>{formatPrice(changeDue)}</strong>
                </div>
              ) : null}
              <button
                type="button"
                className="counter-bill__summary-total counter-bill__summary-total--jump"
                onClick={jumpToAmountReceived}
                title={t('admin.counterBillAmountReceived')}
              >
                <span>{t('admin.counterBillGrandTotal')}</span>
                <strong key={`total-${total}-${lines.length}`}>{formatPrice(total)}</strong>
              </button>
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

      {typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={stickyDockRef}
            className={`counter-bill__pos-dock${cartFlashKey ? ' counter-bill__pos-dock--flash' : ''}${
              lines.length > 0 ? ' counter-bill__pos-dock--cart' : ' counter-bill__pos-dock--idle'
            }`}
            role="region"
            aria-label={t('admin.counterBillSummary')}
          >
            <div className="counter-bill__pos-dock-total">
              <div className="counter-bill__pos-dock-meta">
                <span className="counter-bill__pos-dock-label">{t('admin.counterBillGrandTotal')}</span>
                {selectedItemCount > 0 ? (
                  <button
                    type="button"
                    className="counter-bill__pos-dock-count"
                    onClick={jumpToCartPanel}
                    title={t('admin.counterBillCart')}
                  >
                    {t('admin.counterBillSelectedCount', { count: selectedItemCount })}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="counter-bill__pos-dock-amount"
                onClick={jumpToAmountReceived}
                title={t('admin.counterBillAmountReceived')}
              >
                <strong key={`dock-total-${total}-${selectedItemCount}`}>{formatPrice(total)}</strong>
              </button>
            </div>

            {lines.length === 0 ? (
              <>
                <button
                  type="button"
                  className="counter-bill__pos-dock-sales"
                  onClick={() => onJumpToSales?.()}
                >
                  {t('counter.mySalesToday')}
                </button>
                <button
                  type="button"
                  className="counter-bill__pos-dock-printer"
                  onClick={() => openPrinterSetup()}
                  aria-label={t('admin.counterBillNativeRefresh')}
                  title={
                    nativePos
                      ? (nativePrinter?.name || t('admin.counterBillNativeRefresh'))
                      : t('admin.counterBillNativeRefresh')
                  }
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                    <path
                      fill="currentColor"
                      d="M17 7V5a3 3 0 0 0-3-3H10a3 3 0 0 0-3 3v2H5a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h1v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2h1a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3h-2zM10 5h4v2h-4V5zm6 14H8v-4h8v4zm3-6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="counter-bill__pos-dock-print"
                  onClick={() => {
                    if (nativePos && !nativePrinter?.address) {
                      openPrinterSetup();
                      return;
                    }
                    void printReceipt();
                  }}
                  disabled={!receiptOrder && !(nativePos && !nativePrinter?.address)}
                  aria-label={t('admin.counterBillPrintNow')}
                  title={t('admin.counterBillPrintNow')}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                    <path
                      fill="currentColor"
                      d="M6 9V3h12v6h2a2 2 0 0 1 2 2v6h-4v4H6v-4H2v-6a2 2 0 0 1 2-2h2zm2-4v4h8V5H8zm-2 12v2h12v-2H6zm-2-2h16v-4H4v4zm2-2.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`counter-bill__pos-dock-jump${dockFocus === 'search' ? ' counter-bill__pos-dock-jump--active' : ''}`}
                  onPointerDown={onSearchDockPointerDown}
                  onClick={onSearchDockClick}
                >
                  {t('admin.counterBillSearch')}
                </button>
                <button
                  type="button"
                  className={`counter-bill__pos-dock-jump${dockFocus === 'discount' ? ' counter-bill__pos-dock-jump--active' : ''}`}
                  onClick={jumpToDiscount}
                >
                  {t('admin.counterBillToolbarDiscount')}
                </button>
                <button
                  type="button"
                  className={`counter-bill__pos-dock-jump${dockFocus === 'customer' ? ' counter-bill__pos-dock-jump--active' : ''}`}
                  onClick={jumpToCustomer}
                >
                  {t('admin.counterBillToolbarCustomer')}
                </button>
              </>
            )}
          </div>,
          document.body,
        )
        : null}

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
                <button
                  type="button"
                  className="wp-button counter-bill__mate-cta"
                  onClick={() => void openMateThermalText(receiptOrder, thermalWidth)}
                >
                  {t('admin.counterBillOpenMate')}
                </button>
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
