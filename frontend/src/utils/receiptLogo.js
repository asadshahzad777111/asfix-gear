/**
 * Website brand mark for thermal receipts (/logo.png — same as Navbar/Logo).
 * Color → 1-bit for ESC/POS GS v 0 / PNG Direct Print / Mate IMAGE.
 */

export const RECEIPT_LOGO_PATH = '/logo.png';

let logoImagePromise = null;

export function loadReceiptLogoImage() {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  if (!logoImagePromise) {
    logoImagePromise = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = RECEIPT_LOGO_PATH;
    });
  }
  return logoImagePromise;
}

/** Target logo width in printer dots (~76% of roll, 8-dot aligned). */
export function receiptLogoTargetDots(thermalWidth = '58mm') {
  const printable = thermalWidth === '80mm' ? 576 : 384;
  return Math.max(96, Math.floor((printable * 0.76) / 8) * 8);
}

/**
 * Draw logo to mono canvas: dark background → white paper; orange/white → black ink.
 */
export function renderReceiptLogoMonoCanvas(img, targetWidthDots) {
  if (!img?.naturalWidth) return null;
  const tw = Math.max(8, Math.floor(Number(targetWidthDots) / 8) * 8);
  const th = Math.max(8, Math.round((img.naturalHeight / img.naturalWidth) * tw));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, tw, th);
  const imageData = ctx.getImageData(0, 0, tw, th);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    /* Ink for bright / brand-orange pixels; leave near-black background as white */
    const isInk = a > 24 && lum > 42;
    const v = isInk ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function canvasToEscPosRasterBytes(canvas) {
  if (!canvas?.width || !canvas?.height) return new Uint8Array(0);
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8Array(0);
  const { data } = ctx.getImageData(0, 0, w, h);
  const bytesPerRow = Math.ceil(w / 8);
  const bitmap = new Uint8Array(bytesPerRow * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i] >= 128) continue; /* white → no ink */
      bitmap[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = h & 0xff;
  const yH = (h >> 8) & 0xff;
  const header = Uint8Array.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  const out = new Uint8Array(header.length + bitmap.length);
  out.set(header, 0);
  out.set(bitmap, header.length);
  return out;
}

export async function buildReceiptLogoEscPosRaster(thermalWidth = '58mm') {
  const img = await loadReceiptLogoImage();
  if (!img) return new Uint8Array(0);
  const canvas = renderReceiptLogoMonoCanvas(img, receiptLogoTargetDots(thermalWidth));
  return canvasToEscPosRasterBytes(canvas);
}

export async function getReceiptLogoMonoDataUrl(thermalWidth = '58mm') {
  const img = await loadReceiptLogoImage();
  if (!img) return '';
  const canvas = renderReceiptLogoMonoCanvas(img, receiptLogoTargetDots(thermalWidth));
  if (!canvas) return '';
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/** Draw centered mono logo onto an existing receipt canvas context. Returns height used. */
export async function drawReceiptLogoOnCanvas(ctx, {
  canvasWidth,
  padX,
  y,
  thermalWidth = '58mm',
} = {}) {
  const img = await loadReceiptLogoImage();
  if (!img || !ctx) return 0;
  const usable = Math.max(8, (canvasWidth || 0) - (padX || 0) * 2);
  const target = Math.min(receiptLogoTargetDots(thermalWidth), Math.floor(usable / 8) * 8);
  const mono = renderReceiptLogoMonoCanvas(img, target);
  if (!mono) return 0;
  const x = Math.round(((canvasWidth || mono.width) - mono.width) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mono, x, Math.round(y));
  return mono.height + 6;
}

/** Load any image URL / data-URL (custom shop logo or QR pic). */
export function loadImageFromSrc(src) {
  if (!src || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Mono for photos / dark-on-white logos / QR pics (dark = ink).
 * Different from brand mark (bright orange = ink).
 */
export function renderPhotoMonoCanvas(img, targetWidthDots) {
  if (!img?.naturalWidth) return null;
  const tw = Math.max(8, Math.floor(Number(targetWidthDots) / 8) * 8);
  const th = Math.max(8, Math.round((img.naturalHeight / img.naturalWidth) * tw));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, tw, th);
  const imageData = ctx.getImageData(0, 0, tw, th);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const isInk = a > 24 && lum < 168;
    const v = isInk ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export async function buildCustomImageEscPosRaster(src, thermalWidth = '58mm', widthRatio = 0.76) {
  const img = await loadImageFromSrc(src);
  if (!img) return new Uint8Array(0);
  const printable = thermalWidth === '80mm' ? 576 : 384;
  const target = Math.max(64, Math.floor((printable * widthRatio) / 8) * 8);
  const canvas = renderPhotoMonoCanvas(img, target);
  return canvasToEscPosRasterBytes(canvas);
}

export async function getCustomImageMonoDataUrl(src, thermalWidth = '58mm', widthRatio = 0.76) {
  const img = await loadImageFromSrc(src);
  if (!img) return '';
  const printable = thermalWidth === '80mm' ? 576 : 384;
  const target = Math.max(64, Math.floor((printable * widthRatio) / 8) * 8);
  const canvas = renderPhotoMonoCanvas(img, target);
  if (!canvas) return '';
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/** Draw custom mono image centered. Returns height used. */
export async function drawCustomImageOnCanvas(ctx, {
  src,
  canvasWidth,
  padX,
  y,
  thermalWidth = '58mm',
  widthRatio = 0.76,
} = {}) {
  const img = await loadImageFromSrc(src);
  if (!img || !ctx) return 0;
  const usable = Math.max(8, (canvasWidth || 0) - (padX || 0) * 2);
  const printable = thermalWidth === '80mm' ? 576 : 384;
  const target = Math.min(
    Math.max(64, Math.floor((printable * widthRatio) / 8) * 8),
    Math.floor(usable / 8) * 8,
  );
  const mono = renderPhotoMonoCanvas(img, target);
  if (!mono) return 0;
  const x = Math.round(((canvasWidth || mono.width) - mono.width) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mono, x, Math.round(y));
  return mono.height + 6;
}
