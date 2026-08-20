/**
 * Laptop one-click thermal helpers for AsFix POS.
 *
 * Order of attempts (desktop Chrome):
 * 1) Local bridge http://127.0.0.1:9100/print when THERMAL_COM is set
 * 2) Web Bluetooth GATT write (BLE printers — no Windows COM/SPP)
 * 3) Caller falls back to iframe print / Thermer
 *
 * Bind bridge to 127.0.0.1 only — see scripts/thermal-print-bridge.mjs
 */

const BRIDGE_URL = 'http://127.0.0.1:9100';
const BRIDGE_TIMEOUT_MS = 800;
const BLE_SKIP_KEY = 'asfix_thermal_ble_skip_v1';

/** Common ESC/POS BLE services seen on BT800S-class / “BlueTooth Printer” devices. */
const BLE_SERVICE_CANDIDATES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

const BLE_WRITE_CANDIDATES = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '49535343-1e4d-4bd9-ba61-23c647249616',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000fff2-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

const ESC = 0x1b;
const GS = 0x1d;

function buildEscPosBytes(text) {
  const body = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const init = new Uint8Array([ESC, 0x40]);
  const align = new Uint8Array([ESC, 0x61, 0x00]);
  const encoder = new TextEncoder();
  const payload = encoder.encode(body.endsWith('\n') ? body : `${body}\n`);
  /* 2 line feeds max before cut — avoid long blank roll */
  const feed = encoder.encode('\n\n');
  const cut = new Uint8Array([GS, 0x56, 0x00]);
  const out = new Uint8Array(init.length + align.length + payload.length + feed.length + cut.length);
  let o = 0;
  out.set(init, o); o += init.length;
  out.set(align, o); o += align.length;
  out.set(payload, o); o += payload.length;
  out.set(feed, o); o += feed.length;
  out.set(cut, o);
  return out;
}

/** Decode ESC/POS payload from base64 (browser-safe). */
function decodeBase64ToBytes(dataBase64) {
  const value = String(dataBase64 || '').trim();
  if (!value || typeof atob !== 'function') return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.length ? bytes : null;
  } catch {
    return null;
  }
}

function isBleSkipped() {
  try {
    return sessionStorage.getItem(BLE_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

function skipBleForSession() {
  try {
    sessionStorage.setItem(BLE_SKIP_KEY, '1');
  } catch {
    /* ignore */
  }
}

export async function probeThermalBridge(timeoutMs = BRIDGE_TIMEOUT_MS) {
  if (typeof fetch === 'undefined') return null;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, {
      method: 'GET',
      signal: ctrl?.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function printViaThermalBridge(text) {
  const health = await probeThermalBridge();
  if (!health?.ok || !health?.ready || !health?.com) return { ok: false, reason: 'bridge_unavailable' };

  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8_000) : null;
  try {
    const res = await fetch(`${BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text || '') }),
      signal: ctrl?.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return { ok: false, reason: data?.error || 'bridge_print_failed', message: data?.message };
    }
    return { ok: true, via: 'bridge', com: data.com };
  } catch {
    return { ok: false, reason: 'bridge_error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function printEscPosViaThermalBridge(dataBase64) {
  const payload = String(dataBase64 || '').trim();
  if (!payload) return { ok: false, reason: 'empty' };

  const health = await probeThermalBridge();
  if (!health?.ok || !health?.ready || !health?.com) {
    return { ok: false, reason: 'bridge_unavailable' };
  }

  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8_000) : null;
  try {
    const res = await fetch(`${BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_base64: payload }),
      signal: ctrl?.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return { ok: false, reason: data?.error || 'bridge_print_failed', message: data?.message };
    }
    return { ok: true, via: 'bridge', com: data.com };
  } catch {
    return { ok: false, reason: 'bridge_error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function canUseWebBluetooth() {
  return typeof navigator !== 'undefined'
    && typeof navigator.bluetooth?.requestDevice === 'function'
    && (typeof window === 'undefined' || window.isSecureContext !== false);
}

function pickWritableCharacteristic(characteristics) {
  const list = Array.from(characteristics || []);
  for (const uuid of BLE_WRITE_CANDIDATES) {
    const hit = list.find((c) => String(c.uuid).toLowerCase() === uuid);
    if (hit && (hit.properties?.write || hit.properties?.writeWithoutResponse)) return hit;
  }
  return list.find((c) => c.properties?.writeWithoutResponse || c.properties?.write) || null;
}

async function writeChunks(characteristic, bytes, chunkSize = 100) {
  const useWithoutResponse = Boolean(characteristic.properties?.writeWithoutResponse);
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.slice(i, i + chunkSize);
    if (useWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(slice);
    } else {
      await characteristic.writeValue(slice);
    }
    await new Promise((r) => setTimeout(r, 12));
  }
}

/**
 * Chrome Web Bluetooth → raw ESC/POS bytes. Requires a user gesture (Print click).
 * Prefer full receipt base64 (32-col + QR) over plain text.
 */
export async function printViaWebBluetoothBytes(bytes) {
  if (!canUseWebBluetooth()) {
    return { ok: false, reason: 'web_bluetooth_unsupported' };
  }
  if (isBleSkipped()) {
    return { ok: false, reason: 'ble_skipped' };
  }
  if (!bytes?.length) {
    return { ok: false, reason: 'empty' };
  }

  let device;
  try {
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_SERVICE_CANDIDATES,
    });
  } catch (err) {
    if (err?.name === 'NotFoundError') return { ok: false, reason: 'user_cancelled' };
    return { ok: false, reason: 'request_failed', message: err?.message };
  }

  try {
    const server = await device.gatt.connect();
    let characteristic = null;
    for (const serviceUuid of BLE_SERVICE_CANDIDATES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        characteristic = pickWritableCharacteristic(chars);
        if (characteristic) break;
      } catch {
        /* try next service */
      }
    }
    if (!characteristic) {
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          characteristic = pickWritableCharacteristic(chars);
          if (characteristic) break;
        }
      } catch {
        /* ignore */
      }
    }
    if (!characteristic) {
      skipBleForSession();
      return { ok: false, reason: 'no_writable_characteristic' };
    }

    await writeChunks(characteristic, bytes);
    return { ok: true, via: 'web_bluetooth', device: device.name || 'BLE printer' };
  } catch (err) {
    return { ok: false, reason: 'ble_write_failed', message: err?.message };
  } finally {
    try {
      device?.gatt?.disconnect();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Chrome Web Bluetooth → ESC/POS from plain text (legacy / last-resort).
 */
export async function printViaWebBluetooth(text) {
  return printViaWebBluetoothBytes(buildEscPosBytes(text));
}

/**
 * Try localhost COM bridge, then Web Bluetooth. Prefer ESC/POS base64 (QR + sizing).
 * @param {string} text
 * @param {{ dataBase64?: string }} [opts]
 * @returns {Promise<{ ok: boolean, via?: string, reason?: string, message?: string }>}
 */
export async function tryLaptopThermalPrint(text, opts = {}) {
  const dataBase64 = String(opts.dataBase64 || '').trim();
  if (dataBase64) {
    const bridgeEsc = await printEscPosViaThermalBridge(dataBase64);
    if (bridgeEsc.ok) return bridgeEsc;

    const escBytes = decodeBase64ToBytes(dataBase64);
    if (escBytes) {
      const bleEsc = await printViaWebBluetoothBytes(escBytes);
      if (bleEsc.ok) return bleEsc;
      /* Prefer reporting ESC/POS attempt failure over narrow text fallback. */
      if (bleEsc.reason !== 'web_bluetooth_unsupported' && bleEsc.reason !== 'ble_skipped') {
        return {
          ok: false,
          reason: bleEsc.reason || bridgeEsc.reason || 'unavailable',
          message: bleEsc.message || bridgeEsc.message,
        };
      }
    }
  }

  const body = String(text || '').trim();
  if (!body) {
    return { ok: false, reason: dataBase64 ? 'unavailable' : 'empty' };
  }

  const bridge = await printViaThermalBridge(body);
  if (bridge.ok) return bridge;

  const ble = await printViaWebBluetooth(body);
  if (ble.ok) return ble;

  return {
    ok: false,
    reason: ble.reason || bridge.reason || 'unavailable',
    message: ble.message || bridge.message,
  };
}
