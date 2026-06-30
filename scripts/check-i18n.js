/**
 * Verify en / roman / ur translation keys match in translations.js
 * Usage: node scripts/check-i18n.js
 */
import { translations, LANGS } from '../frontend/src/locales/translations.js';

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

const baseLang = LANGS[0];
const baseKeys = new Set(flattenKeys(translations[baseLang]));
let failed = false;

for (const lang of LANGS.slice(1)) {
  const langKeys = new Set(flattenKeys(translations[lang]));
  const missing = [...baseKeys].filter((k) => !langKeys.has(k));
  const extra = [...langKeys].filter((k) => !baseKeys.has(k));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n[i18n] ${lang} vs ${baseLang} mismatch:`);
    if (missing.length) console.error(`  Missing (${missing.length}):`, missing.slice(0, 20).join(', '), missing.length > 20 ? '...' : '');
    if (extra.length) console.error(`  Extra (${extra.length}):`, extra.slice(0, 20).join(', '), extra.length > 20 ? '...' : '');
  }
}

if (failed) {
  console.error('\n[i18n] Fix translations.js — all 3 languages must share the same keys.');
  process.exit(1);
}

console.log(`[i18n] OK — ${baseKeys.size} keys match across ${LANGS.join(', ')}`);
