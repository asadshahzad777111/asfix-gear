#!/usr/bin/env node
/**
 * AsFix POS Laptop — Print Station helper (Windows).
 *
 * Double-click via scripts/asfix-pos-laptop.bat, or:
 *   node scripts/asfix-pos-laptop.mjs
 *
 * 1) Opens https://asfixgear.com/pos in the default browser
 * 2) Starts thermal COM bridge on 127.0.0.1:9100 when THERMAL_COM is set
 *    or a single COMx port can be auto-detected
 * 3) Prints short Direct Print tips for POS-58
 *
 * Does not install Windows drivers. Prefer Chrome Direct Print → POS-58
 * (shortest paper, Scale 100%, Margins None). Bridge is for USB/SPP COM.
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POS_URL = process.env.ASFIX_POS_URL || 'https://asfixgear.com/pos';
const BRIDGE = path.join(ROOT, 'scripts', 'thermal-print-bridge.mjs');

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
    return;
  }
  spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
    detached: true,
    stdio: 'ignore',
  });
}

function detectCom() {
  const envCom = String(process.env.THERMAL_COM || '').trim().toUpperCase();
  if (/^COM\d+$/i.test(envCom)) return envCom;
  if (process.platform !== 'win32') return '';
  try {
    const out = execSync('mode', { encoding: 'utf8', windowsHide: true });
    const ports = [];
    const re = /Status for device COM(\d+):/gi;
    let m;
    while ((m = re.exec(out))) ports.push(`COM${m[1]}`);
    const unique = [...new Set(ports)];
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) {
      log(`Multiple COM ports found: ${unique.join(', ')}`);
      log('Set THERMAL_COM to pick one, e.g. set THERMAL_COM=COM7');
      return '';
    }
  } catch {
    /* no COM */
  }
  return '';
}

function printBanner(com) {
  log('');
  log('========================================');
  log('  AsFix POS Laptop — Print Station');
  log('========================================');
  log(`POS: ${POS_URL}`);
  log('');
  log('Direct Print (preferred with Windows POS-58 driver):');
  log('  1. Login → Counter → Print → Direct Print');
  log('  2. Destination: POS-58 or POS-58 usb');
  log('  3. Paper: shortest (NOT 58×3276) · Scale 100% · Margins None');
  log('');
  if (com) {
    log(`COM bridge: ${com} → http://127.0.0.1:9100`);
    log('  Keep this window open while printing via bridge.');
  } else {
    log('COM bridge: skipped (no THERMAL_COM / no single COM detected).');
    log('  USB/SPP: set THERMAL_COM=COMx then re-run this script.');
    log('  Or use Chrome Direct Print / Web Bluetooth.');
  }
  log('');
  log('Docs: docs/ASFIX-POS-LAPTOP.md');
  log('========================================');
  log('');
}

async function main() {
  if (!fs.existsSync(BRIDGE)) {
    log(`Missing bridge script: ${BRIDGE}`);
    process.exit(1);
  }

  const com = detectCom();
  printBanner(com);
  openBrowser(POS_URL);

  if (!com) {
    log('Browser opened. Press Ctrl+C to exit (no bridge running).');
    setInterval(() => {}, 60_000);
    return;
  }

  process.env.THERMAL_COM = com;
  const child = spawn(process.execPath, [BRIDGE], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  log(String(err?.stack || err));
  process.exit(1);
});
