/**
 * Verify order receipt WhatsApp text has no emoji / broken unicode prefixes.
 * Run: node scripts/test-receipt-encoding.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildNewOrderShopMessage,
  buildPaidOrderShopMessage,
} from '../backend/services/orderNotifications.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
const REPLACEMENT_RE = /\uFFFD/;

const sampleOrder = {
  order_id: 'ASF-1001',
  customer_name: 'Test User',
  phone: '03001234567',
  city: 'Lahore',
  payment_mode: 'jazzcash',
  shipping_status: 'pending',
  total_amount: 1500,
  created_at: new Date().toISOString(),
  items: [{ name: 'USB Cable', qty: 1, price: 1500, cost_price: 900 }],
  shipping_address: {
    name: 'Test User',
    phone: '03001234567',
    text: 'House 12, Test Street, Lahore',
    lat: 31.59375,
    lng: 74.46745,
  },
};

function assertClean(name, text) {
  const hasEmoji = EMOJI_RE.test(text);
  const hasReplacement = REPLACEMENT_RE.test(text);
  const badLinePrefix = text.split('\n').some((line) => line.startsWith('\uFFFD') || line.startsWith('?'));
  if (hasEmoji || hasReplacement || badLinePrefix) {
    console.log(`FAIL  ${name}`);
    return false;
  }
  console.log(`PASS  ${name}`);
  return true;
}

let failed = 0;

if (!assertClean('Shop new order message', buildNewOrderShopMessage(sampleOrder))) failed += 1;
if (!assertClean('Shop paid order message', buildPaidOrderShopMessage({ ...sampleOrder, payment_status: 'paid' }))) failed += 1;

const shopMsg = buildPaidOrderShopMessage({ ...sampleOrder, payment_status: 'paid' });
if (!shopMsg.includes('Map: https://www.google.com/maps?q=31.59375,74.46745')) {
  console.log('FAIL  Shop paid message missing map link');
  failed += 1;
} else {
  console.log('PASS  Shop paid message includes map link');
}

const receiptsSrc = readFileSync(join(__dirname, '../frontend/src/utils/receipts.js'), 'utf8');
if (EMOJI_RE.test(receiptsSrc)) {
  console.log('FAIL  receipts.js still contains emoji characters');
  failed += 1;
} else {
  console.log('PASS  receipts.js has no emoji');
}

if (!receiptsSrc.includes('googleMapsUrl') || !receiptsSrc.includes('Map:')) {
  console.log('FAIL  receipts.js missing map link helper');
  failed += 1;
} else {
  console.log('PASS  receipts.js includes map link support');
}

console.log(`\n${5 - failed}/5 passed`);
process.exit(failed ? 1 : 0);
