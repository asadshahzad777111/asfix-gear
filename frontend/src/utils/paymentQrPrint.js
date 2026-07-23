import QRCode from 'qrcode';
import { formatPaymentDisplayNumber } from '../config/posPaymentQr';
import { nativePrintEscPos } from './nativePosPrint';
import { canPrintLocallyNative } from './remoteThermalPrint';

function normalizeThermalWidth(width) {
  return String(width || '58mm') === '80mm' ? '80mm' : '58mm';
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Large payment QR — ~78% of roll (bigger than receipt site QR). */
function buildEscPosQrRasterBytes(payload, thermalWidth = '58mm') {
  const width = normalizeThermalWidth(thermalWidth);
  const printableDots = width === '80mm' ? 576 : 384;
  const targetDots = Math.max(160, Math.floor(printableDots * 0.78));
  let model;
  try {
    model = QRCode.create(String(payload || ''), { errorCorrectionLevel: 'M' });
  } catch {
    return new Uint8Array(0);
  }
  const modules = model?.modules;
  const moduleCount = modules?.size || 0;
  if (!moduleCount) return new Uint8Array(0);

  const quiet = 2;
  const scale = Math.max(4, Math.min(10, Math.floor(targetDots / (moduleCount + quiet * 2))));
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

function centerLine(text, maxChars) {
  const s = String(text || '').slice(0, maxChars);
  const pad = Math.max(0, Math.floor((maxChars - s.length) / 2));
  return `${' '.repeat(pad)}${s}`;
}

/**
 * ESC/POS slip: staff name above tear line; customer body has method + big QR + number only.
 */
export async function buildPaymentQrEscPosBase64(card, thermalWidth = '58mm') {
  if (!card?.payload || typeof TextEncoder === 'undefined' || typeof btoa !== 'function') return '';
  const width = normalizeThermalWidth(thermalWidth);
  const maxChars = width === '80mm' ? 48 : 32;
  const encoder = new TextEncoder();
  const parts = [];
  const push = (...values) => parts.push(Uint8Array.from(values));
  const text = (value) => parts.push(encoder.encode(String(value ?? '')));
  const line = (value) => {
    text(`${value}\n`);
  };

  const display = formatPaymentDisplayNumber(card.number || card.iban || card.payload);
  const method = String(card.label || card.method || 'Pay').toUpperCase();
  const staffName = String(card.accountName || '').trim();

  push(0x1b, 0x40);
  push(0x1b, 0x4d, 0x00);
  push(0x1b, 0x33, 28);
  push(0x1b, 0x4a, 24);
  push(0x1b, 0x61, 0x01); // center

  /* Staff-only strip — tear / tape this top part */
  push(0x1b, 0x45, 0x01);
  line(centerLine('STAFF ONLY — TEAR HERE', maxChars).trim());
  push(0x1b, 0x45, 0x00);
  if (staffName) {
    line(centerLine(staffName, maxChars).trim());
  }
  line(centerLine('- - - cut / fold - - -', maxChars).trim());
  line('');

  push(0x1d, 0x21, 0x11); // double width+height for method
  line(method);
  push(0x1d, 0x21, 0x00);
  line('');

  const qr = buildEscPosQrRasterBytes(card.payload, width);
  if (qr.length) parts.push(qr);
  line('');

  push(0x1b, 0x45, 0x01);
  push(0x1d, 0x21, 0x01);
  line(display);
  push(0x1d, 0x21, 0x00);
  push(0x1b, 0x45, 0x00);
  if (card.accountNumber && card.iban) {
    line(centerLine(`A/C ${card.accountNumber}`, maxChars).trim());
  }
  line('');
  line(centerLine('Ask cashier to confirm', maxChars).trim());
  line(centerLine('account name before pay', maxChars).trim());
  line('');
  line(centerLine('AsFix & Gear', maxChars).trim());
  line(centerLine('Thank you', maxChars).trim());
  push(0x1b, 0x64, 0x04);
  push(0x1d, 0x56, 0x00);

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return bytesToBase64(out);
}

export async function buildPaymentQrDataUrl(card, size = 280) {
  if (!card?.payload) return '';
  return QRCode.toDataURL(String(card.payload), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: size,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

function openPaymentQrHtmlPrint(card, qrDataUrl, thermalWidth = '58mm') {
  const width = normalizeThermalWidth(thermalWidth);
  const pageW = width === '80mm' ? '80mm' : '58mm';
  const display = formatPaymentDisplayNumber(card.number || card.iban || card.payload);
  const method = String(card.label || card.method || 'Pay');
  const staffName = String(card.accountName || '').trim();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${method} QR</title>
<style>
  @page { size: ${pageW} auto; margin: 2mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; width: ${pageW}; color: #000; }
  .staff { font-size: 9px; text-align: center; border-bottom: 1px dashed #000; padding: 4px 2px 8px; margin-bottom: 8px; }
  .staff strong { display: block; font-size: 11px; margin-top: 2px; }
  .cut { font-size: 8px; letter-spacing: 0.04em; opacity: 0.85; margin-top: 4px; }
  .method { text-align: center; font-size: 18px; font-weight: 800; letter-spacing: 0.06em; margin: 6px 0 10px; }
  .qr { display: block; width: 78%; max-width: 78%; margin: 0 auto 8px; height: auto; }
  .num { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; margin: 6px 0; }
  .hint { text-align: center; font-size: 9px; line-height: 1.35; margin-top: 8px; }
  .shop { text-align: center; font-size: 10px; margin-top: 10px; font-weight: 600; }
</style></head><body>
  <div class="staff">STAFF ONLY — TEAR HERE${staffName ? `<strong>${staffName}</strong>` : ''}<div class="cut">- - - cut / fold - - -</div></div>
  <div class="method">${method}</div>
  <img class="qr" src="${qrDataUrl}" alt="QR"/>
  <div class="num">${display}</div>
  ${card.accountNumber ? `<div class="hint">A/C ${card.accountNumber}</div>` : ''}
  <div class="hint">Ask cashier to confirm<br/>account name before pay</div>
  <div class="shop">AsFix &amp; Gear · Thank you</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
</body></html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=720');
  if (!w) return { ok: false, reason: 'popup_blocked', message: 'Allow pop-ups to print' };
  w.document.open();
  w.document.write(html);
  w.document.close();
  return { ok: true };
}

/**
 * Print one payment QR slip — native ESC/POS when available, else Direct Print HTML.
 */
export async function printPaymentQrSlip(card, { thermalWidth = '58mm' } = {}) {
  if (!card?.payload) {
    return { ok: false, reason: 'no_card', message: 'No payment QR' };
  }
  const width = normalizeThermalWidth(thermalWidth);

  if (await canPrintLocallyNative()) {
    const dataBase64 = await buildPaymentQrEscPosBase64(card, width);
    if (!dataBase64) {
      return { ok: false, reason: 'build_failed', message: 'Could not build QR slip' };
    }
    return nativePrintEscPos(dataBase64);
  }

  const qrDataUrl = await buildPaymentQrDataUrl(card, 360);
  return openPaymentQrHtmlPrint(card, qrDataUrl, width);
}
