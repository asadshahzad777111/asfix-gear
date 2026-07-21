#!/usr/bin/env node
/**
 * Send plain-text ESC/POS to a Windows Bluetooth serial (COM) port.
 *
 * This is NOT a Windows print driver. Use when Device Manager shows
 * "Standard Serial over Bluetooth link (COMx)" after pairing.
 * For image/PNG receipts, prefer Android Thermer (mate.bluetoothprint).
 *
 * Usage:
 *   node scripts/send-thermal-com.mjs COM5 --demo
 *   node scripts/send-thermal-com.mjs COM5 path\to\receipt.txt
 *   node scripts/send-thermal-com.mjs COM5 --text "Hello AsFix"
 *
 * Docs: docs/thermal-printer-windows.md
 */
import fs from 'node:fs';
import path from 'node:path';

const ESC = 0x1b;
const GS = 0x1d;

function usage() {
  console.log(`Usage:
  node scripts/send-thermal-com.mjs <COMx> --demo
  node scripts/send-thermal-com.mjs <COMx> <file.txt>
  node scripts/send-thermal-com.mjs <COMx> --text "line1\\nline2"

Examples:
  node scripts/send-thermal-com.mjs COM5 --demo
  node scripts/send-thermal-com.mjs COM5 .\\receipt.txt`);
}

function normalizeComPort(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!/^COM\d+$/i.test(s)) {
    throw new Error(`Invalid COM port "${raw}". Expected like COM5.`);
  }
  return s;
}

function comDevicePath(com) {
  /* Windows device namespace — works for many BT SPP virtual COM ports */
  return `\\\\.\\${com}`;
}

function buildEscPos(text) {
  const body = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const init = Buffer.from([ESC, 0x40]); /* ESC @ initialize */
  const alignLeft = Buffer.from([ESC, 0x61, 0x00]);
  const payload = Buffer.from(body.endsWith('\n') ? body : `${body}\n`, 'latin1');
  const feed = Buffer.from('\n\n\n');
  /* GS V 0 — full cut (many 58mm printers ignore or partial-cut) */
  const cut = Buffer.from([GS, 0x56, 0x00]);
  return Buffer.concat([init, alignLeft, payload, feed, cut]);
}

function demoReceipt() {
  const lines = [
    'AS FIX & GEAR',
    'BILL (COM test)',
    '------------------',
    'Item            Rs.',
    'Test item     100',
    '------------------',
    'TOTAL         100',
    '',
    'asfixgear.com',
    '',
  ];
  return lines.join('\n');
}

function resolveText(args) {
  if (args.includes('--demo')) return demoReceipt();
  const textIdx = args.indexOf('--text');
  if (textIdx !== -1) {
    const value = args[textIdx + 1];
    if (!value) throw new Error('--text requires a string argument');
    return value.replace(/\\n/g, '\n');
  }
  const fileArg = args.find((a) => !a.startsWith('--') && !/^COM\d+$/i.test(a));
  if (!fileArg) throw new Error('Provide --demo, --text, or a .txt file path');
  const full = path.resolve(fileArg);
  if (!fs.existsSync(full)) throw new Error(`File not found: ${full}`);
  return fs.readFileSync(full, 'utf8');
}

function main() {
  const args = process.argv.slice(2).filter(Boolean);
  if (!args.length || args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(args.length ? 0 : 1);
  }

  let com;
  try {
    com = normalizeComPort(args[0]);
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }

  let text;
  try {
    text = resolveText(args.slice(1));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(1);
  }

  const device = comDevicePath(com);
  const buf = buildEscPos(text);

  try {
    const fd = fs.openSync(device, 'w');
    try {
      fs.writeSync(fd, buf, 0, buf.length);
    } finally {
      fs.closeSync(fd);
    }
    console.log(`Sent ${buf.length} ESC/POS bytes to ${com} (${device}).`);
    console.log('If nothing printed: check baud/pairing, try printer Windows utility, or use phone Thermer.');
  } catch (err) {
    console.error(`Failed writing to ${device}: ${err.message}`);
    console.error('Tips: close other apps using the port; confirm COM number in Device Manager;');
    console.error('use Android Thermer for PNG receipts — see docs/thermal-printer-windows.md');
    process.exit(1);
  }
}

main();
