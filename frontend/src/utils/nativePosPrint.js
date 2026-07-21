/**
 * Native AsFix POS (Capacitor) Bluetooth thermal helpers.
 *
 * Auto-print runs ONLY when Capacitor reports a native platform
 * (`window.Capacitor.isNativePlatform()`). Desktop Chrome / Thermer paths stay unchanged.
 *
 * Classic Bluetooth SPP — pair the printer in Android system settings first.
 * Plugin: AsfixThermalPrint (mobile/asfix-pos).
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PRINTER_ADDRESS_KEY = 'asfix_pos_bt_printer_address';
const PRINTER_NAME_KEY = 'asfix_pos_bt_printer_name';

/** @typedef {{ name: string, address: string, bonded?: boolean }} ThermalPrinterDevice */
/** @typedef {{ ok: boolean, reason?: string, message?: string }} NativePrintResult */

const AsfixThermalPrint = registerPlugin('AsfixThermalPrint');

export function isNativePosApp() {
  try {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

function toErrorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.message || err.errorMessage || String(err) || fallback;
}

export async function getSavedPrinter() {
  try {
    const [{ value: address }, { value: name }] = await Promise.all([
      Preferences.get({ key: PRINTER_ADDRESS_KEY }),
      Preferences.get({ key: PRINTER_NAME_KEY }),
    ]);
    if (!address) return null;
    return { address, name: name || address };
  } catch {
    return null;
  }
}

export async function savePrinter(printer) {
  if (!printer?.address) {
    await Preferences.remove({ key: PRINTER_ADDRESS_KEY });
    await Preferences.remove({ key: PRINTER_NAME_KEY });
    return;
  }
  await Preferences.set({ key: PRINTER_ADDRESS_KEY, value: String(printer.address) });
  await Preferences.set({ key: PRINTER_NAME_KEY, value: String(printer.name || printer.address) });
}

export async function clearSavedPrinter() {
  await savePrinter(null);
}

/**
 * Request Bluetooth / nearby-devices permissions. Throws with a clear message on failure.
 */
export async function requestThermalPrintPermissions() {
  if (!isNativePosApp()) {
    const err = new Error('Not running inside AsFix POS app');
    err.reason = 'not_native';
    throw err;
  }
  try {
    await AsfixThermalPrint.requestPermissions();
  } catch (err) {
    const e = new Error(
      toErrorMessage(err, 'Bluetooth permission denied — allow Nearby devices / Bluetooth for AsFix POS')
    );
    e.reason = 'permission_denied';
    throw e;
  }
}

/**
 * @returns {Promise<ThermalPrinterDevice[]>}
 */
export async function listBondedPrinters() {
  if (!isNativePosApp()) return [];
  await requestThermalPrintPermissions();
  try {
    const result = await AsfixThermalPrint.listPrinters();
    return Array.isArray(result?.printers) ? result.printers : [];
  } catch (err) {
    const e = new Error(toErrorMessage(err, 'Could not list Bluetooth printers'));
    e.reason = 'list_failed';
    throw e;
  }
}

/**
 * Connect + send ESC/POS text (init + body + feed + cut) via Bluetooth SPP.
 * @param {string} text
 * @param {{ address?: string }} [opts]
 * @returns {Promise<NativePrintResult>}
 */
export async function nativePrintText(text, opts = {}) {
  if (!isNativePosApp()) return { ok: false, reason: 'not_native' };
  const saved = await getSavedPrinter();
  const address = opts.address || saved?.address;
  if (!address) return { ok: false, reason: 'no_printer' };

  try {
    await requestThermalPrintPermissions();
  } catch (err) {
    return {
      ok: false,
      reason: err?.reason || 'permission_denied',
      message: toErrorMessage(err, 'Bluetooth permission denied'),
    };
  }

  try {
    await AsfixThermalPrint.connect({ address });
    await AsfixThermalPrint.printText({ text: String(text || ''), address });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: 'print_failed',
      message: toErrorMessage(err, 'Bluetooth print failed'),
    };
  }
}

/**
 * Prefer native SPP print when running inside AsFix POS app.
 * @param {string} receiptText
 * @returns {Promise<NativePrintResult>}
 */
export async function tryNativeThermalPrint(receiptText) {
  if (!isNativePosApp()) return { ok: false, reason: 'not_native' };
  return nativePrintText(receiptText);
}

/**
 * One-shot auto-print after a successful counter sale (native app only).
 * Uses last-selected bonded printer from Preferences.
 * @returns {Promise<NativePrintResult>}
 */
export async function autoPrintCounterReceiptIfNative(receiptText) {
  if (!isNativePosApp()) return { ok: false, reason: 'not_native' };
  const saved = await getSavedPrinter();
  if (!saved?.address) return { ok: false, reason: 'no_printer' };
  return nativePrintText(receiptText, { address: saved.address });
}
