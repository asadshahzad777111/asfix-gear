#!/usr/bin/env node
/**
 * Print honest install / print-path help for AsFix 58mm thermal.
 * No binaries — points at docs and local vendor ZIP (never committed).
 */
const lines = [
  'AsFix & Gear — 58mm thermal print help',
  '',
  'Docs: docs/thermal-printer-windows.md',
  'POS app: mobile/asfix-pos/README.md',
  '',
  'Vendor ZIP (local only — do NOT git add):',
  '  Downloads/58MM Thermal Printer Driver & Tools -50.zip',
  '  Extract → _ci_local/thermal-58mm-tools/ (gitignored)',
  '  Windows: Printer Driver/Windows Driver/PrinterDriver.exe',
  '  Android test APK: Android APP/BT-POSPrinter.apk (not AsFix POS)',
  '  Skip: Mac Driver',
  '',
  'What AsFix integrates in code:',
  '  • Website ESC/POS (32-col 58mm + ESC Z QR) via AsFix POS / bridge / BLE',
  '  • Thermer Intent / PNG share from Android Chrome',
  '  • iPhone → remote print queue to Android or laptop station',
  '',
  'What you install locally (cannot ship in git):',
  '  • Windows PrinterDriver.exe (optional USB/COM queue)',
  '  • AsFix POS debug APK or Thermer from Play Store',
  '  • Pair printer in OS Bluetooth settings',
  '',
  'Laptop COM bridge:',
  '  set THERMAL_COM=COMx',
  '  npm run thermal:bridge',
  '',
  'COM smoke (needs real COMx, not BLE-only):',
  '  npm run thermal:com-demo -- COMx',
  '  (or) node scripts/send-thermal-com.mjs COMx --demo',
  '',
  'Reprint: Counter → 58mm → Print → ticket bottom should show Scan + QR.',
];

console.log(lines.join('\n'));
