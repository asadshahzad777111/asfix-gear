/**
 * Resume/finalize model images: reuse files already in frontend/public/models,
 * fetch missing via Wikipedia (fast path), else write catalog SVG so every
 * model has a live image. Writes frontend/src/config/modelImages.js
 *
 *   node scripts/model-images/finalize.mjs
 *   node scripts/model-images/finalize.mjs --fetch
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const OUT_DIR = join(ROOT, 'frontend/public/models');
const MAPPING_JS = join(ROOT, 'frontend/src/config/modelImages.js');
const SOURCES_PATH = join(ROOT, 'scripts/model-images/sources.json');
const MANIFEST_PATH = join(ROOT, 'scripts/model-images/manifest.json');
const REPAIR_MODELS = join(ROOT, 'frontend/src/config/repairModels.js');
const UA = 'AsFixGearModelImages/1.0 (repair-shop catalog)';
const WANT_FETCH = process.argv.includes('--fetch');
const CONCURRENCY = 8;

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function modelKey(brand, model) {
  return `${brand}|${model}`;
}

function extractModels() {
  const src = readFileSync(REPAIR_MODELS, 'utf8').replace(/\r\n/g, '\n');
  const start = src.indexOf('export const REPAIR_DEVICE_BRANDS = ');
  const arrStart = src.indexOf('[', start);
  let depth = 0;
  let end = -1;
  for (let i = arrStart; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const brands = Function(`"use strict"; return (${src.slice(arrStart, end + 1)});`)();
  const rows = [];
  for (const group of brands) {
    for (const series of group.series) {
      for (const model of series.models) {
        rows.push({
          brand: group.brand,
          series: series.name,
          model,
          key: modelKey(group.brand, model),
          brandSlug: slugify(group.brand),
          modelSlug: slugify(model),
          fileBase: `${slugify(group.brand)}/${slugify(model)}`,
        });
      }
    }
  }
  return rows;
}

function findExisting(fileBase) {
  const dir = dirname(join(OUT_DIR, fileBase));
  const base = slugify(fileBase.split('/').pop());
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    if (name.replace(extname(name), '') === base) {
      const full = join(dir, name);
      if (statSync(full).size > 500) return full;
    }
  }
  // Also try exact path with common extensions
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.svg']) {
    const p = join(OUT_DIR, fileBase + ext);
    if (existsSync(p) && statSync(p).size > 500) return p;
  }
  return null;
}

function toPublicUrl(absPath) {
  return '/' + relative(join(ROOT, 'frontend/public'), absPath).replace(/\\/g, '/');
}

function writeCatalogSvg(row) {
  const dest = join(OUT_DIR, `${row.fileBase}.svg`);
  mkdirSync(dirname(dest), { recursive: true });
  const brandColors = {
    'Apple iPhone': '#1d1d1f',
    Samsung: '#1428a0',
    OnePlus: '#eb0029',
    'Xiaomi / Redmi / POCO': '#ff6900',
    'Vivo / iQOO': '#415fff',
    Oppo: '#1a1a1a',
    Infinix: '#00c853',
    Tecno: '#0060aa',
    'Google Pixel': '#4285f4',
    Realme: '#ffc915',
    Motorola: '#005daa',
    'Nothing Phone': '#111111',
    Honor: '#000000',
    Itel: '#e60012',
  };
  const accent = brandColors[row.brand] || '#334155';
  const label = row.model.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const brand = row.brand.replace(/&/g, '&amp;');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="720" height="720" fill="url(#bg)"/>
  <rect x="250" y="90" width="220" height="440" rx="36" fill="#0f172a"/>
  <rect x="262" y="110" width="196" height="380" rx="16" fill="#f8fafc"/>
  <circle cx="360" cy="500" r="14" fill="#334155"/>
  <rect x="320" y="122" width="80" height="10" rx="5" fill="#cbd5e1"/>
  <rect x="60" y="580" width="600" height="8" rx="4" fill="${accent}"/>
  <text x="360" y="620" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="#0f172a">${label}</text>
  <text x="360" y="650" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" fill="#64748b">${brand}</text>
</svg>`;
  writeFileSync(dest, svg);
  return dest;
}

function searchTitles(brand, model) {
  const m = model.trim();
  const titles = [];
  const push = (t) => t && !titles.includes(t) && titles.push(t);
  if (brand === 'Apple iPhone') {
    push(m);
    push(m.replace('iPhone SE (2020/2022)', 'iPhone SE (3rd generation)'));
  } else if (brand === 'Samsung') push(`Samsung Galaxy ${m}`);
  else if (brand === 'Google Pixel') push(m.startsWith('Pixel') ? `Google ${m}` : `Google Pixel ${m}`);
  else if (brand === 'OnePlus') push(m.startsWith('OnePlus') || m.startsWith('Nord') ? m : `OnePlus ${m}`);
  else if (brand === 'Xiaomi / Redmi / POCO') {
    if (m.startsWith('Xiaomi') || m.startsWith('Redmi') || m.startsWith('POCO') || m.startsWith('Mi ')) push(m);
    else if (m.startsWith('Note ')) push(`Redmi ${m}`);
    else if (/^(F|X|M)\d/.test(m)) push(`POCO ${m}`);
    else push(`Xiaomi ${m}`);
  } else if (brand === 'Vivo / iQOO') push(m.startsWith('iQOO') ? m : `Vivo ${m}`);
  else if (brand === 'Oppo') push(`Oppo ${m}`);
  else if (brand === 'Infinix') push(`Infinix ${m}`);
  else if (brand === 'Tecno') push(`Tecno ${m}`);
  else if (brand === 'Realme') push(m.startsWith('Realme') ? m : `Realme ${m}`);
  else if (brand === 'Motorola') push(m.startsWith('Moto') || m.startsWith('Edge') || m.startsWith('Razr') ? `Motorola ${m.replace(/^Motorola\s*/, '')}` : `Motorola ${m}`);
  else if (brand === 'Nothing Phone') push(m);
  else if (brand === 'Honor') push(m.startsWith('Honor') ? m : `Honor ${m}`);
  else if (brand === 'Itel') push(`Itel ${m}`);
  else push(`${brand} ${m}`);
  return titles;
}

function isRaster(src) {
  const u = String(src || '').toLowerCase().split('?')[0];
  return u && !u.endsWith('.svg') && !u.endsWith('.gif');
}

async function wikiThumb(title) {
  const url =
    'https://en.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'pageimages',
      format: 'json',
      pithumbsize: '900',
      piprop: 'thumbnail|original',
      redirects: '1',
    });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = await res.json();
  for (const page of Object.values(data?.query?.pages || {})) {
    if (page.missing != null) continue;
    const original = page.original?.source;
    const thumb = page.thumbnail?.source;
    const src = (original && isRaster(original) && original) || (thumb && isRaster(thumb) && thumb);
    if (src) return { url: src, title: page.title };
  }
  return null;
}

async function download(url, destBase) {
  mkdirSync(dirname(destBase), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  let ext = '.jpg';
  if (ct.includes('png') || /\.png/i.test(url)) ext = '.png';
  else if (ct.includes('webp') || /\.webp/i.test(url)) ext = '.webp';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 6000) throw new Error('too small');
  const path = destBase + ext;
  writeFileSync(path, buf);
  return path;
}

async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

function writeMapping(manifest) {
  const entries = {};
  const sources = {};
  for (const row of manifest) {
    if (!row.publicUrl) continue;
    entries[row.key] = row.publicUrl;
    sources[row.key] = {
      provider: row.provider,
      sourceUrl: row.sourceUrl || null,
      searchTitle: row.searchTitle || null,
    };
  }
  writeFileSync(
    MAPPING_JS,
    `/**
 * Auto-generated model product image map.
 * Key: "Brand|Model" → public image URL (/models/... served by frontend).
 * Regenerated by: node scripts/model-images/finalize.mjs
 */
export const MODEL_IMAGES = ${JSON.stringify(entries, null, 2)};

export function getModelImageUrl(brand, model) {
  if (!brand || !model) return null;
  return MODEL_IMAGES[\`\${brand}|\${model}\`] || null;
}

export function modelImageStats() {
  return { mapped: Object.keys(MODEL_IMAGES).length };
}
`
  );
  writeFileSync(SOURCES_PATH, JSON.stringify(sources, null, 2));
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const rows = extractModels();
  console.log(`Catalog models: ${rows.length}`);

  const manifest = await mapPool(rows, CONCURRENCY, async (row, idx) => {
    const existing = findExisting(row.fileBase);
    if (existing) {
      const provider = extname(existing) === '.svg' ? 'catalog-svg' : 'local-file';
      if ((idx + 1) % 40 === 0 || idx === 0) process.stdout.write(`\r[${idx + 1}/${rows.length}] reuse ${row.model}`.padEnd(70));
      return {
        ...row,
        status: 'ok',
        localPath: existing,
        publicUrl: toPublicUrl(existing),
        provider,
        sourceUrl: null,
      };
    }

    if (WANT_FETCH) {
      try {
        for (const title of searchTitles(row.brand, row.model)) {
          const hit = await wikiThumb(title);
          if (!hit) continue;
          const path = await download(hit.url, join(OUT_DIR, row.fileBase));
          process.stdout.write(`\r[${idx + 1}/${rows.length}] fetched ${row.model}`.padEnd(70));
          return {
            ...row,
            status: 'ok',
            localPath: path,
            publicUrl: toPublicUrl(path),
            provider: 'wikipedia',
            sourceUrl: hit.url,
            searchTitle: title,
          };
        }
      } catch {
        /* fall through to svg */
      }
    }

    const path = writeCatalogSvg(row);
    process.stdout.write(`\r[${idx + 1}/${rows.length}] svg ${row.model}`.padEnd(70));
    return {
      ...row,
      status: 'ok',
      localPath: path,
      publicUrl: toPublicUrl(path),
      provider: 'catalog-svg',
      sourceUrl: null,
      generated: true,
    };
  });

  process.stdout.write('\n');
  writeMapping(manifest);

  const photo = manifest.filter((m) => m.provider && m.provider !== 'catalog-svg').length;
  const svg = manifest.filter((m) => m.provider === 'catalog-svg').length;
  const attached = manifest.filter((m) => m.publicUrl).length;
  console.log(
    JSON.stringify(
      {
        total: rows.length,
        attached,
        photoOrLocal: photo,
        catalogSvg: svg,
        missing: rows.length - attached,
        mapping: MAPPING_JS,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
