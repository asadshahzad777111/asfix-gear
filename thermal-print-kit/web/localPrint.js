/**
 * Local (this-device) thermal print entrypoint for the kit.
 *
 * Replaces AsFix's large `printActiveCounterReceipt` with a compact, reusable
 * version that covers the common paths:
 *   1) Native Android POS app  → Bluetooth SPP via the Capacitor plugin (ESC/POS)
 *   2) Desktop Chrome          → localhost COM bridge, then Web Bluetooth (BLE)
 *   3) Fallback (any browser)  → hidden iframe window.print() of the text receipt
 *
 * Returns { ok, via?, reason?, message? } and never throws.
 */
import {
  buildThermalReceiptEscPosBase64,
  buildThermalReceiptText,
} from './receiptEscPos';
import { isNativePosApp, tryNativeThermalPrint } from './nativePosPrint';
import { isDesktopDevice } from './remoteThermalPrint';
import {
  printEscPosViaThermalBridge,
  probeThermalBridge,
  tryLaptopThermalPrint,
} from './thermalLaptopPrint';

function printTextInBrowser(text, thermalWidth = '58mm') {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { ok: false, reason: 'no_dom' };
  }
  const widthMm = thermalWidth === '80mm' ? 80 : 58;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return { ok: false, reason: 'no_iframe' };
  }
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    * { margin: 0; padding: 0; }
    body { width: ${widthMm}mm; }
    pre { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.25;
      white-space: pre-wrap; word-break: break-word; padding: 2mm; }
  </style></head><body><pre>${escaped}</pre></body></html>`);
  doc.close();
  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (err) {
    iframe.remove();
    return { ok: false, reason: 'print_failed', message: err?.message };
  }
  setTimeout(() => iframe.remove(), 1000);
  return { ok: true, via: 'browser_iframe' };
}

/**
 * Print an order on THIS device using the best available local path.
 * @param {{ order: object, thermalWidth?: string }} args
 */
export async function printLocalReceipt({ order, thermalWidth = '58mm' } = {}) {
  if (!order) return { ok: false, reason: 'no_order', message: 'No receipt to print' };
  const text = buildThermalReceiptText(order);
  const dataBase64 = buildThermalReceiptEscPosBase64(order, thermalWidth);

  if (isNativePosApp()) {
    const native = await tryNativeThermalPrint(text, { dataBase64 });
    if (native.ok) return { ok: true, via: 'native_spp' };
    // fall through to browser print if no printer saved / permission denied
    return printTextInBrowser(text, thermalWidth);
  }

  if (isDesktopDevice()) {
    const bridge = await probeThermalBridge();
    if (bridge?.ok && bridge?.ready && bridge?.com && dataBase64) {
      const viaBridge = await printEscPosViaThermalBridge(dataBase64);
      if (viaBridge.ok) return viaBridge;
    }
    const laptop = await tryLaptopThermalPrint(text);
    if (laptop.ok) return laptop;
    return printTextInBrowser(text, thermalWidth);
  }

  return printTextInBrowser(text, thermalWidth);
}
