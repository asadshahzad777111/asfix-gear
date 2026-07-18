#!/usr/bin/env node
/**
 * Free AsFix social ad renderer (no Canva / Placid).
 *
 * Usage:
 *   npm run generate:ad -- --image path/to/product.jpg --title "iPhone 15 Cover" --price "Rs 650"
 *   npm run generate:ad -- --image ./pic.png --title "..." --price "Rs 2,499" --format story
 *
 * Output: ads/out/<slug>-<format>.png + matching .txt caption
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const templatesDir = path.join(root, 'ads', 'templates');
const outDir = path.join(root, 'ads', 'out');

const FORMATS = {
  square: { file: 'instagram-square.html', width: 1080, height: 1080 },
  story: { file: 'story-9x16.html', width: 1080, height: 1920 },
};

function parseArgs(argv) {
  const out = { format: 'square', title: '', price: '', image: '', badge: 'SHOP NOW' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--image' && next) { out.image = next; i++; }
    else if (a === '--title' && next) { out.title = next; i++; }
    else if (a === '--price' && next) { out.price = next; i++; }
    else if (a === '--format' && next) { out.format = next; i++; }
    else if (a === '--badge' && next) { out.badge = next; i++; }
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function slugify(text) {
  return String(text || 'ad')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'ad';
}

function buildCaption({ title, price }) {
  const t = title || 'New arrival';
  const p = price || '';
  return [
    `${t}${p ? ` — ${p}` : ''}`,
    '',
    'AsFix & Gear · Lahore',
    'Mobile repair + premium accessories',
    '',
    'Shop: https://asfixgear.com',
    'WhatsApp: 0303-9227000',
    '',
    '#AsFixGear #Lahore #MobileAccessories #PhoneRepair #Pakistan',
  ].join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.image || !args.title) {
    console.log(`Usage:
  npm run generate:ad -- --image <file> --title "Product name" --price "Rs 650" [--format square|story]

Examples:
  npm run generate:ad -- --image ads/inbox/cover.jpg --title "Luxury MagSafe Case" --price "Rs 650"
  npm run generate:ad -- --image ./charger.png --title "65W Fast Charger" --price "Rs 2,499" --format story`);
    process.exit(args.help ? 0 : 1);
  }

  const format = FORMATS[args.format] ? args.format : 'square';
  const spec = FORMATS[format];
  const imagePath = path.resolve(args.image);
  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    process.exit(1);
  }

  const templatePath = path.join(templatesDir, spec.file);
  let html = fs.readFileSync(templatePath, 'utf8');
  const imageUrl = pathToFileURL(imagePath).href;
  html = html
    .replaceAll('{{IMAGE}}', imageUrl)
    .replaceAll('{{TITLE}}', escapeHtml(args.title))
    .replaceAll('{{PRICE}}', escapeHtml(args.price || ''))
    .replaceAll('SHOP NOW', escapeHtml(args.badge || 'SHOP NOW'));

  fs.mkdirSync(outDir, { recursive: true });
  const base = `${slugify(args.title)}-${format}`;
  const pngPath = path.join(outDir, `${base}.png`);
  const txtPath = path.join(outDir, `${base}.txt`);
  const tmpHtml = path.join(outDir, `_${base}.html`);
  fs.writeFileSync(tmpHtml, html, 'utf8');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'networkidle' });
    await page.locator('.frame').screenshot({ path: pngPath, type: 'png' });
  } finally {
    await browser.close();
    try { fs.unlinkSync(tmpHtml); } catch { /* ignore */ }
  }

  const caption = buildCaption({ title: args.title, price: args.price });
  fs.writeFileSync(txtPath, caption, 'utf8');

  console.log('Ad ready (free HTML template — no Canva/Placid):');
  console.log(`  PNG:     ${pngPath}`);
  console.log(`  Caption: ${txtPath}`);
  console.log('Next: post PNG + caption on IG/FB, or drop into Drive for n8n later.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
