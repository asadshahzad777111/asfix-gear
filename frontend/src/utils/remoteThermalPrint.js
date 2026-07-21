/**
 * Cross-device thermal print queue helpers (iPhone → Android/laptop agents).
 */
import { api } from '../api/client';
import { buildThermalReceiptText } from '../components/admin/AdminCounterBill';
import { getSavedPrinter, isNativePosApp } from './nativePosPrint';

export const PRINT_TARGET_KEY = 'asfix_print_target_v1';
export const PRINT_TARGETS = ['local', 'android', 'laptop', 'any'];

export function readPrintTarget() {
  try {
    if (typeof window === 'undefined') return null;
    const value = window.localStorage.getItem(PRINT_TARGET_KEY);
    return PRINT_TARGETS.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function writePrintTarget(target) {
  try {
    if (typeof window === 'undefined') return;
    if (!PRINT_TARGETS.includes(target)) return;
    window.localStorage.setItem(PRINT_TARGET_KEY, target);
  } catch {
    /* ignore */
  }
}

export function isAppleMobileDevice() {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

export function isAndroidDevice() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
}

export function isDesktopDevice() {
  return typeof navigator !== 'undefined' && !isAndroidDevice() && !isAppleMobileDevice();
}

/** Prefer remote station on iOS; local elsewhere when no saved preference. */
export function defaultPrintTarget() {
  const saved = readPrintTarget();
  if (saved) return saved;
  if (isAppleMobileDevice()) return 'any';
  if (isNativePosApp()) return 'local';
  if (isDesktopDevice()) return 'local';
  return 'any';
}

export async function canPrintLocallyNative() {
  if (!isNativePosApp()) return false;
  const saved = await getSavedPrinter();
  return Boolean(saved?.address);
}

export async function fetchPrintStations() {
  try {
    const data = await api.getPrintStations();
    return data?.stations || { android: { online: false }, laptop: { online: false } };
  } catch {
    return { android: { online: false }, laptop: { online: false } };
  }
}

export function stationOnlineForTarget(stations, target) {
  const android = Boolean(stations?.android?.online);
  const laptop = Boolean(stations?.laptop?.online);
  if (target === 'android') return android;
  if (target === 'laptop') return laptop;
  if (target === 'any') return android || laptop;
  return true;
}

/**
 * Enqueue ESC/POS text for a remote print station.
 * @returns {Promise<{ ok: boolean, reason?: string, message?: string, job?: object }>}
 */
export async function enqueueRemotePrintJob({
  order,
  text,
  dataBase64,
  target = 'any',
  thermalWidth = '58mm',
} = {}) {
  const receiptText = text || buildThermalReceiptText(order);
  if (!String(receiptText || '').trim()) {
    return { ok: false, reason: 'no_order', message: 'No receipt to print' };
  }
  if (target === 'local') {
    return { ok: false, reason: 'local', message: 'Local print should not use the queue' };
  }

  const stations = await fetchPrintStations();
  if (!stationOnlineForTarget(stations, target)) {
    return {
      ok: false,
      reason: 'no_station',
      message:
        'No print station online — open AsFix POS on Android with printer, or run laptop bridge',
      stations,
    };
  }

  try {
    const data = await api.createPrintJob({
      text: receiptText,
      data_base64: dataBase64 || null,
      target,
      thermal_width: thermalWidth,
      order_id: order?.id ?? order?.order_id ?? null,
      order_ref: order?.order_id || null,
    });
    return { ok: true, job: data?.job, stations };
  } catch (err) {
    return {
      ok: false,
      reason: 'enqueue_failed',
      message: err?.message || 'Could not send print job',
    };
  }
}
