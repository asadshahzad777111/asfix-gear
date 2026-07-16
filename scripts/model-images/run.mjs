/**
 * Bulk pipeline: extract repair catalog models → fetch free product photos
 * (Wikipedia/Wikimedia) → write public/models + modelImages.js mapping.
 * Optionally uploads to Cloudflare R2 when R2_* env vars are set.
 *
 * Usage:
 *   node scripts/model-images/run.mjs
 *   node scripts/model-images/run.mjs --upload-r2
 *   node scripts/model-images/run.mjs --limit=20
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const OUT_DIR = join(ROOT, 'frontend/public/models');
const CACHE_DIR = join(ROOT, 'scripts/model-images/_cache');
const MANIFEST_PATH = join(ROOT, 'scripts/model-images/manifest.json');
const SOURCES_PATH = join(ROOT, 'scripts/model-images/sources.json');
const MAPPING_JS = join(ROOT, 'frontend/src/config/modelImages.js');
const REPAIR_MODELS = join(ROOT, 'frontend/src/config/repairModels.js');

const UA = 'AsFixGearModelImages/1.0 (repair-shop catalog; contact@asfixgear.local)';
const CONCURRENCY = 6;

const args = process.argv.slice(2);
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0) || 0;
const WANT_R2 = args.includes('--upload-r2');
const SKIP_FETCH = args.includes('--skip-fetch');

function loadEnvFile() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

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

/** Expand short catalog names into Wikipedia-friendly search titles. */
function searchTitles(brand, model) {
  const m = model.trim();
  const titles = [];
  const push = (t) => {
    if (t && !titles.includes(t)) titles.push(t);
  };

  if (brand === 'Apple iPhone') {
    push(m);
    push(m.replace('iPhone SE (2020/2022)', 'iPhone SE (3rd generation)'));
    push(m.replace('iPhone SE (2020/2022)', 'iPhone SE (2nd generation)'));
    push(m.replace(' Mini', ' mini'));
  } else if (brand === 'Samsung') {
    push(`Samsung Galaxy ${m}`);
    push(`Galaxy ${m}`);
    if (m.startsWith('Note')) push(`Samsung Galaxy ${m}`);
    if (m.startsWith('Z ')) push(`Samsung Galaxy ${m}`);
  } else if (brand === 'Google Pixel') {
    push(m.startsWith('Pixel') ? `Google ${m}` : `Google Pixel ${m}`);
    push(m);
  } else if (brand === 'OnePlus') {
    push(m.startsWith('OnePlus') || m.startsWith('Nord') ? m : `OnePlus ${m}`);
    if (!m.startsWith('OnePlus') && !m.startsWith('Nord')) push(`OnePlus ${m}`);
  } else if (brand === 'Xiaomi / Redmi / POCO') {
    if (m.startsWith('Xiaomi') || m.startsWith('Redmi') || m.startsWith('POCO') || m.startsWith('Mi ')) {
      push(m);
    } else if (m.startsWith('Note ')) {
      push(`Redmi ${m}`);
      push(`Xiaomi Redmi ${m}`);
    } else if (/^(F|X|M)\d/.test(m)) {
      push(`POCO ${m}`);
    } else {
      push(`Xiaomi ${m}`);
      push(`Redmi ${m}`);
    }
  } else if (brand === 'Vivo / iQOO') {
    if (m.startsWith('iQOO')) push(m);
    else push(`Vivo ${m}`);
  } else if (brand === 'Oppo') {
    push(`Oppo ${m}`);
    if (m.startsWith('Find') || m.startsWith('Reno')) push(`OPPO ${m}`);
  } else if (brand === 'Infinix') {
    push(`Infinix ${m}`);
  } else if (brand === 'Tecno') {
    push(`Tecno ${m}`);
  } else if (brand === 'Realme') {
    push(m.startsWith('Realme') || m.startsWith('GT') || m.startsWith('C') ? (m.startsWith('Realme') ? m : `Realme ${m}`) : `Realme ${m}`);
    if (!m.startsWith('Realme')) push(`Realme ${m}`);
  } else if (brand === 'Motorola') {
    push(m.startsWith('Moto') || m.startsWith('Edge') || m.startsWith('Razr') ? (m.startsWith('Motorola') ? m : `Motorola ${m}`) : `Motorola ${m}`);
    if (m.startsWith('Edge')) push(`Motorola Edge ${m.replace(/^Edge\s*/, '')}`.replace('Motorola Edge ', 'Motorola Edge '));
    push(m.startsWith('Moto') ? m : `Moto ${m}`);
  } else if (brand === 'Nothing Phone') {
    push(m);
    push(m.replace('Nothing Phone ', 'Nothing Phone '));
  } else if (brand === 'Honor') {
    push(m.startsWith('Honor') ? m : `Honor ${m}`);
  } else if (brand === 'Itel') {
    push(`Itel ${m}`);
  } else {
    push(`${brand} ${m}`);
  }

  return titles;
}

function extractModelsFromSource() {
  // repairModels.js imports contactPrefill — extract the array literal instead of importing.
  const src = readFileSync(REPAIR_MODELS, 'utf8').replace(/\r\n/g, '\n');
  const start = src.indexOf('export const REPAIR_DEVICE_BRANDS = ');
  if (start < 0) throw new Error('REPAIR_DEVICE_BRANDS not found');
  const arrStart = src.indexOf('[', start);
  let depth = 0;
  let end = -1;
  for (let i = arrStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error('Could not find end of REPAIR_DEVICE_BRANDS');
  const literal = src.slice(arrStart, end + 1);
  // eslint-disable-next-line no-new-func
  const brands = Function(`"use strict"; return (${literal});`)();
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

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  } catch (err) {
    if (attempt >= 4) throw err;
    await sleep(400 * attempt * attempt);
    return fetchJson(url, attempt + 1);
  }
}

/** First usable raster from a Commons category (sorted by size preference). */
async function commonsCategoryImage(categoryTitle) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: categoryTitle.startsWith('Category:') ? categoryTitle : `Category:${categoryTitle}`,
      cmtype: 'file',
      cmlimit: '20',
      format: 'json',
    });
  const data = await fetchJson(url);
  const files = (data?.query?.categorymembers || []).map((m) => m.title).filter(Boolean);
  for (const title of files) {
    if (/logo|icon|box|screenshot|screen\.|wallpaper/i.test(title)) continue;
    const infoUrl =
      'https://commons.wikimedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        titles: title,
        prop: 'imageinfo',
        iiprop: 'url|size|mime',
        iiurlwidth: '900',
        format: 'json',
      });
    const infoData = await fetchJson(infoUrl);
    const page = Object.values(infoData?.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    if (!info) continue;
    const mime = String(info.mime || '');
    if (!mime.startsWith('image/')) continue;
    const u = preferRaster(info.thumburl, mime.includes('svg') ? null : info.url);
    if (!u) continue;
    const w = info.thumbwidth || info.width || 0;
    const h = info.thumbheight || info.height || 0;
    if (Math.min(w, h) < 280) continue;
    return { url: u, title, source: 'commons-category' };
  }
  return null;
}

function categoryCandidates(brand, model) {
  const m = model.trim();
  const out = [];
  if (brand === 'Apple iPhone') {
    out.push(`Category:${m.replace(/^iPhone/, 'IPhone')}`);
    out.push(`Category:${m}`);
  } else if (brand === 'Samsung') {
    out.push(`Category:Samsung Galaxy ${m}`);
  } else if (brand === 'Google Pixel') {
    out.push(`Category:Google ${m.startsWith('Pixel') ? m : `Pixel ${m}`}`);
    out.push(`Category:${m}`);
  } else if (brand === 'OnePlus') {
    out.push(`Category:${m.startsWith('OnePlus') || m.startsWith('Nord') ? m : `OnePlus ${m}`}`);
  }
  return out;
}

/** Sibling fallbacks when a brand-new SKU has no free photo yet. */
function siblingFallbacks(brand, model) {
  const m = model.trim();
  const map = {
    'Apple iPhone': {
      'iPhone 17 Pro Max': ['iPhone 16 Pro Max', 'iPhone 15 Pro Max'],
      'iPhone 17 Pro': ['iPhone 16 Pro', 'iPhone 15 Pro'],
      'iPhone 17': ['iPhone 16', 'iPhone 15'],
      'iPhone 17e': ['iPhone 16e', 'iPhone 16'],
      'iPhone Air': ['iPhone 16 Plus', 'iPhone 16'],
      'iPhone 16e': ['iPhone 16', 'iPhone SE (3rd generation)'],
      'iPhone 16 Plus': ['iPhone 16'],
      'iPhone 15 Plus': ['iPhone 15'],
      'iPhone 14 Plus': ['iPhone 14'],
    },
    Samsung: {
      'S26 Ultra': ['S25 Ultra', 'S24 Ultra'],
      'S26+': ['S25+', 'S24+'],
      S26: ['S25', 'S24'],
      'S25 Ultra': ['S24 Ultra'],
      'S25+': ['S24+'],
      S25: ['S24'],
    },
    'Google Pixel': {
      'Pixel 10 Pro XL': ['Pixel 9 Pro XL', 'Pixel 8 Pro'],
      'Pixel 10 Pro': ['Pixel 9 Pro', 'Pixel 8 Pro'],
      'Pixel 10': ['Pixel 9', 'Pixel 8'],
      'Pixel 9a': ['Pixel 8a', 'Pixel 7a'],
    },
  };
  return map[brand]?.[m] || [];
}

function writeCatalogSvg(row, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
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
  writeFileSync(destPath, svg);
  return destPath;
}

function isRasterImageUrl(src) {
  const u = String(src || '').toLowerCase().split('?')[0];
  if (!u) return false;
  // Raw SVG vectors only — Wikimedia often serves rasterized `/…svg/960px-….svg.png` thumbs.
  if (u.endsWith('.svg')) return false;
  if (u.endsWith('.gif')) return false;
  return true;
}

function preferRaster(original, thumb) {
  if (original && isRasterImageUrl(original)) return original;
  if (thumb && isRasterImageUrl(thumb)) return thumb;
  return null;
}

async function wikipediaThumb(title) {
  const url =
    'https://en.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'pageimages',
      format: 'json',
      pithumbsize: '1000',
      piprop: 'thumbnail|name|original',
      redirects: '1',
    });
  const data = await fetchJson(url);
  const pages = data?.query?.pages || {};
  for (const page of Object.values(pages)) {
    if (page.missing != null) continue;
    const src = preferRaster(page.original?.source, page.thumbnail?.source);
    if (src) {
      return { url: src, title: page.title, pageid: page.pageid, source: 'wikipedia' };
    }
  }
  return null;
}

/** Opensearch → first matching article title, then pageimages. */
async function wikipediaSearchThumb(query) {
  const searchUrl =
    'https://en.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'opensearch',
      search: query,
      limit: '5',
      namespace: '0',
      format: 'json',
    });
  const data = await fetchJson(searchUrl);
  const titles = data?.[1] || [];
  for (const title of titles) {
    const hit = await wikipediaThumb(title);
    if (hit) return { ...hit, searchTitle: title };
  }
  return null;
}

async function commonsSearch(query) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `${query} smartphone OR phone filetype:bitmap`,
      gsrlimit: '8',
      gsrnamespace: '6',
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
      iiurlwidth: '1000',
      format: 'json',
      origin: '*',
    });
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});
  const scored = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = String(info.mime || '');
    if (!mime.startsWith('image/')) continue;
    // Prefer raster thumbs even when the file itself is SVG.
    const u = preferRaster(info.thumburl, mime.includes('svg') ? null : info.url);
    if (!u) continue;
    const w = info.thumbwidth || info.width || 0;
    const h = info.thumbheight || info.height || 0;
    if (Math.min(w, h) < 280) continue;
    const title = String(page.title || '').toLowerCase();
    const q = query.toLowerCase();
    let score = Math.min(w, h);
    if (title.includes('iphone') || title.includes('galaxy') || title.includes('pixel')) score += 200;
    if (q.split(/\s+/).every((tok) => tok.length < 2 || title.includes(tok))) score += 400;
    if (title.includes('vector') || title.includes('.svg')) score -= 80;
    scored.push({ url: u, title: page.title, source: 'commons', score, w, h });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0] || null;
}

async function resolveImage(row) {
  const titles = searchTitles(row.brand, row.model);
  for (const title of titles) {
    try {
      const hit = await wikipediaThumb(title);
      if (hit) return { ...hit, searchTitle: title };
    } catch {
      /* continue */
    }
  }
  for (const cat of categoryCandidates(row.brand, row.model)) {
    try {
      const hit = await commonsCategoryImage(cat);
      if (hit) return { ...hit, searchTitle: cat };
    } catch {
      /* continue */
    }
  }
  for (const title of titles) {
    try {
      const hit = await wikipediaSearchThumb(title);
      if (hit) return hit;
    } catch {
      /* continue */
    }
  }
  for (const title of titles) {
    try {
      const hit = await commonsSearch(title);
      if (hit) return { ...hit, searchTitle: title };
    } catch {
      /* continue */
    }
  }
  if (!row._noSibling) {
    for (const sibling of siblingFallbacks(row.brand, row.model)) {
      try {
        const hit = await resolveImage({ ...row, model: sibling, _noSibling: true });
        if (hit) return { ...hit, searchTitle: `fallback:${sibling}`, providerNote: 'sibling-fallback' };
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

async function downloadToFile(url, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  let ext = '.jpg';
  if (ct.includes('png') || url.includes('.png')) ext = '.png';
  else if (ct.includes('webp') || url.includes('.webp')) ext = '.webp';
  else if (ct.includes('jpeg') || ct.includes('jpg') || url.match(/\.jpe?g/i)) ext = '.jpg';
  const finalPath = destPath.endsWith(ext) ? destPath : destPath.replace(/\.[a-z]+$/i, '') + ext;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8_000) throw new Error('Image too small');
  writeFileSync(finalPath, buf);
  return { path: finalPath, bytes: buf.length, contentType: ct || 'image/jpeg', buffer: buf, ext };
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function isR2Ready() {
  const keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_BASE_URL'];
  return keys.every((k) => {
    const v = String(process.env[k] || '').trim();
    return v && !v.includes('xxxx') && !v.includes('your_');
  });
}

async function uploadBufferToR2(buffer, key, contentType) {
  const { S3Client, PutObjectCommand } = await import(
    join(ROOT, 'backend/node_modules/@aws-sdk/client-s3/dist-cjs/index.js').replace(/\\/g, '/')
  ).catch(async () => import('@aws-sdk/client-s3'));

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
    },
  });
  const bucket = process.env.R2_BUCKET_NAME.trim();
  const publicBase = process.env.R2_PUBLIC_BASE_URL.trim().replace(/\/$/, '');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return `${publicBase}/${key}`;
}

function writeMappingJs(manifest) {
  const entries = {};
  const sources = {};
  for (const row of manifest) {
    if (!row.publicUrl) continue;
    entries[row.key] = row.publicUrl;
    sources[row.key] = {
      sourceUrl: row.sourceUrl || null,
      provider: row.provider || null,
      searchTitle: row.searchTitle || null,
    };
  }
  const body = `/**
 * Auto-generated model product image map.
 * Key: "Brand|Model" → public image URL (R2 or /models/... local).
 * Regenerated by: node scripts/model-images/run.mjs
 * Do not edit by hand unless fixing a single broken URL.
 */
export const MODEL_IMAGES = ${JSON.stringify(entries, null, 2)};

export function getModelImageUrl(brand, model) {
  if (!brand || !model) return null;
  return MODEL_IMAGES[\`\${brand}|\${model}\`] || null;
}

export function modelImageStats() {
  return { mapped: Object.keys(MODEL_IMAGES).length };
}
`;
  writeFileSync(MAPPING_JS, body);
  writeFileSync(SOURCES_PATH, JSON.stringify(sources, null, 2));
}

async function main() {
  loadEnvFile();
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });

  let rows = extractModelsFromSource();
  console.log(`Models in catalog: ${rows.length}`);
  if (LIMIT > 0) {
    rows = rows.slice(0, LIMIT);
    console.log(`Limited to: ${rows.length}`);
  }

  let manifest = [];
  if (SKIP_FETCH && existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    console.log(`Loaded existing manifest: ${manifest.length}`);
  } else {
    console.log('Resolving Wikipedia/Commons images…');
    const resolved = await mapPool(rows, CONCURRENCY, async (row, idx) => {
      process.stdout.write(`\r[${idx + 1}/${rows.length}] ${row.brand} ${row.model}`.padEnd(80));
      try {
        const hit = await resolveImage(row);
        if (!hit) {
          const svgPath = join(OUT_DIR, `${row.fileBase}.svg`);
          writeCatalogSvg(row, svgPath);
          const rel = '/' + relative(join(ROOT, 'frontend/public'), svgPath).replace(/\\/g, '/');
          return {
            ...row,
            status: 'ok',
            localPath: svgPath,
            publicUrl: rel,
            sourceUrl: null,
            provider: 'catalog-svg',
            searchTitle: null,
            bytes: statSync(svgPath).size,
            contentType: 'image/svg+xml',
            ext: '.svg',
            generated: true,
          };
        }
        const dest = join(OUT_DIR, row.fileBase);
        const dl = await downloadToFile(hit.url, dest);
        const rel = '/' + relative(join(ROOT, 'frontend/public'), dl.path).replace(/\\/g, '/');
        return {
          ...row,
          status: 'ok',
          localPath: dl.path,
          publicUrl: rel,
          sourceUrl: hit.url,
          provider: hit.source,
          searchTitle: hit.searchTitle,
          bytes: dl.bytes,
          contentType: dl.contentType,
          ext: dl.ext,
        };
      } catch (err) {
        return { ...row, status: 'error', error: String(err.message || err) };
      }
    });
    process.stdout.write('\n');
    manifest = resolved;
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  const ok = manifest.filter((m) => m.status === 'ok');
  const missing = manifest.filter((m) => m.status !== 'ok');
  console.log(`Downloaded OK: ${ok.length}  Missing/error: ${missing.length}`);

  let r2Uploaded = 0;
  if (WANT_R2) {
    if (!isR2Ready()) {
      console.log('R2 BLOCKER: R2_* credentials missing or placeholder in .env — keeping /models/ public URLs.');
    } else {
      console.log('Uploading to Cloudflare R2…');
      await mapPool(ok, 4, async (row) => {
        if (!row.localPath || !existsSync(row.localPath)) return;
        const buf = readFileSync(row.localPath);
        const key = `models/${row.fileBase}${row.ext || '.jpg'}`;
        try {
          const url = await uploadBufferToR2(buf, key, row.contentType);
          row.publicUrl = url;
          row.r2Key = key;
          r2Uploaded++;
          process.stdout.write(`\rR2 ${r2Uploaded}/${ok.length}`);
        } catch (err) {
          row.r2Error = String(err.message || err);
        }
      });
      process.stdout.write('\n');
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    }
  }

  writeMappingJs(manifest);
  console.log(`Wrote ${MAPPING_JS}`);
  console.log(`Sources log: ${SOURCES_PATH}`);
  console.log(
    JSON.stringify(
      {
        total: rows.length,
        withImage: ok.length,
        missing: missing.length,
        r2Uploaded,
        r2Configured: isR2Ready(),
        publicUrlPattern: isR2Ready() && WANT_R2
          ? `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/models/{brand}/{model}.ext`
          : '/models/{brand-slug}/{model-slug}.ext (frontend public)',
      },
      null,
      2
    )
  );

  if (missing.length) {
    writeFileSync(
      join(ROOT, 'scripts/model-images/missing.json'),
      JSON.stringify(
        missing.map((m) => ({ key: m.key, error: m.error || m.status })),
        null,
        2
      )
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
