#!/usr/bin/env node
/**
 * Localhost thermal print bridge for AsFix POS (Windows).
 *
 * Binds 127.0.0.1 only. POS posts receipt text; bridge writes ESC/POS to a COM
 * port when THERMAL_COM is set (Bluetooth SPP / USB serial).
 *
 * This BLE-only "BlueTooth Printer" (BTHLE, no Standard Serial over Bluetooth)
 * cannot be driven from Node without a COM/SPP channel — use Chrome Web
 * Bluetooth from the POS page, or Android Thermer.
 *
 * Usage:
 *   set THERMAL_COM=COM7
 *   node scripts/thermal-print-bridge.mjs
 *   node scripts/thermal-print-bridge.mjs --port 9100
 *
 * Endpoints:
 *   GET  /health  → { ok, com, listening }
 *   POST /print   → { text: "..." } or { lines: ["..."] }  (JSON)
 *   OPTIONS /print (CORS preflight for localhost origins)
 *
 * Docs: docs/thermal-printer-windows.md
 */
import http from 'node:http';
import fs from 'node:fs';

const ESC = 0x1b;
const GS = 0x1d;
const HOST = '127.0.0.1';
const DEFAULT_PORT = 9100;
const MAX_BODY = 256 * 1024;

function parseArgs(argv) {
  const args = argv.slice(2);
  let port = Number(process.env.THERMAL_BRIDGE_PORT) || DEFAULT_PORT;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = Number(args[portIdx + 1]) || port;
  }
  return { port };
}

function normalizeComPort(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  if (!/^COM\d+$/i.test(s)) {
    throw new Error(`Invalid THERMAL_COM "${raw}". Expected like COM7.`);
  }
  return s;
}

function comDevicePath(com) {
  return `\\\\.\\${com}`;
}

function buildEscPos(text) {
  const body = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const init = Buffer.from([ESC, 0x40]);
  const alignLeft = Buffer.from([ESC, 0x61, 0x00]);
  const payload = Buffer.from(body.endsWith('\n') ? body : `${body}\n`, 'latin1');
  const feed = Buffer.from('\n\n\n');
  const cut = Buffer.from([GS, 0x56, 0x00]);
  return Buffer.concat([init, alignLeft, payload, feed, cut]);
}

function writeCom(com, buf) {
  const device = comDevicePath(com);
  const fd = fs.openSync(device, 'w');
  try {
    fs.writeSync(fd, buf, 0, buf.length);
  } finally {
    fs.closeSync(fd);
  }
  return { device, bytes: buf.length };
}

function corsHeaders(req) {
  const origin = String(req.headers.origin || '');
  const allow =
    !origin
    || origin === 'null'
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (allow) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  }
  return headers;
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function extractPayload(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('JSON object required'), { statusCode: 400 });
  }
  if (typeof parsed.data_base64 === 'string' && parsed.data_base64.trim()) {
    const value = parsed.data_base64.trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > MAX_BODY) {
      throw Object.assign(new Error('Invalid ESC/POS base64'), { statusCode: 400 });
    }
    return Buffer.from(value, 'base64');
  }
  if (typeof parsed.text === 'string') return buildEscPos(parsed.text);
  if (Array.isArray(parsed.lines)) {
    return buildEscPos(parsed.lines.map((line) => String(line ?? '')).join('\n'));
  }
  throw Object.assign(new Error('Provide data_base64, text or lines[]'), { statusCode: 400 });
}

function main() {
  const { port } = parseArgs(process.argv);
  let com = '';
  try {
    com = normalizeComPort(process.env.THERMAL_COM || '');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    const headers = corsHeaders(req);
    const url = new URL(req.url || '/', `http://${HOST}:${port}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'asfix-thermal-print-bridge',
        host: HOST,
        port,
        com: com || null,
        ready: Boolean(com),
        hint: com
          ? `POST /print → ESC/POS on ${com}`
          : 'No THERMAL_COM — BLE printers need Chrome Web Bluetooth or Android Thermer. Set THERMAL_COM when Device Manager shows Standard Serial over Bluetooth link (COMx).',
      }, headers);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/print') {
      try {
        if (!com) {
          sendJson(res, 503, {
            ok: false,
            error: 'no_com',
            message:
              'Bridge has no THERMAL_COM. This PC’s BlueTooth Printer is BLE-only (no SPP COM). Use POS Web Bluetooth or phone Thermer, or set THERMAL_COM when a serial port appears.',
          }, headers);
          return;
        }
        const raw = await readBody(req);
        let parsed;
        try {
          parsed = JSON.parse(raw.toString('utf8') || '{}');
        } catch {
          throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 });
        }
        const buf = extractPayload(parsed);
        if (!buf.length) throw Object.assign(new Error('Empty receipt'), { statusCode: 400 });
        const result = writeCom(com, buf);
        sendJson(res, 200, { ok: true, com, ...result }, headers);
      } catch (err) {
        const status = err.statusCode || 500;
        sendJson(res, status, {
          ok: false,
          error: status === 500 ? 'write_failed' : 'bad_request',
          message: err.message || 'Print failed',
        }, headers);
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: 'not_found' }, headers);
  });

  server.listen(port, HOST, () => {
    console.log(`AsFix thermal bridge http://${HOST}:${port}`);
    console.log(com ? `COM target: ${com}` : 'COM target: (none — set THERMAL_COM=COMx for serial print)');
    console.log('Health: GET /health   Print: POST /print { "text": "..." }');
  });

  server.on('error', (err) => {
    console.error(`Bridge failed to listen on ${HOST}:${port}: ${err.message}`);
    process.exit(1);
  });
}

main();
