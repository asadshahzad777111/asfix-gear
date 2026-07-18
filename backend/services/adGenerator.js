import sharp from 'sharp';

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTitle(title, maxChars = 28) {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
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

function buildSquareSvg({ dataUri, title, price, badge }) {
  const lines = wrapTitle(title, 26);
  const titleSvg = lines
    .map(
      (line, i) =>
        `<text x="56" y="${820 + i * 48}" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="800">${escapeXml(line)}</text>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#121218"/>
      <stop offset="55%" stop-color="#0a0a0c"/>
      <stop offset="100%" stop-color="#1a0f0a"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="28%" r="50%">
      <stop offset="0%" stop-color="#ff6a2b" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#ff6a2b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect width="1080" height="1080" fill="url(#glow)"/>
  <text x="56" y="78" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="800">
    <tspan fill="#ff6a2b">AS</tspan> FIX &amp; GEAR
  </text>
  <text x="56" y="112" fill="rgba(255,255,255,0.55)" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">MOBILE REPAIR &amp; ACCESSORIES</text>
  <rect x="820" y="48" width="200" height="52" rx="26" fill="#ff6a2b"/>
  <text x="920" y="82" text-anchor="middle" fill="#111111" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800">${escapeXml(badge || 'SHOP NOW')}</text>
  <circle cx="540" cy="430" r="310" fill="none" stroke="rgba(255,106,43,0.35)" stroke-width="3"/>
  <rect x="220" y="160" width="640" height="540" rx="36" fill="#1a1a22"/>
  <image href="${dataUri}" x="236" y="176" width="608" height="508" preserveAspectRatio="xMidYMid slice"/>
  ${titleSvg}
  <text x="56" y="980" fill="#ff6a2b" font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="900">${escapeXml(price || '')}</text>
  <text x="1024" y="955" text-anchor="end" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">asfixgear.com</text>
  <text x="1024" y="990" text-anchor="end" fill="rgba(255,255,255,0.7)" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600">WhatsApp 0303-9227000</text>
  <rect y="1066" width="1080" height="14" fill="#ff6a2b"/>
</svg>`;
}

function buildStorySvg({ dataUri, title, price }) {
  const lines = wrapTitle(title, 24);
  const titleSvg = lines
    .map(
      (line, i) =>
        `<text x="56" y="${1480 + i * 54}" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800">${escapeXml(line)}</text>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0a0c"/>
      <stop offset="100%" stop-color="#1a100c"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="18%" r="45%">
      <stop offset="0%" stop-color="#ff6a2b" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ff6a2b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect width="1080" height="1920" fill="url(#glow)"/>
  <text x="56" y="100" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="800">
    <tspan fill="#ff6a2b">AS</tspan> FIX &amp; GEAR
  </text>
  <text x="56" y="145" fill="rgba(255,255,255,0.5)" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="3">LAHORE · REPAIR &amp; ACCESSORIES</text>
  <rect x="140" y="280" width="800" height="800" rx="44" fill="#1a1a22"/>
  <image href="${dataUri}" x="160" y="300" width="760" height="760" preserveAspectRatio="xMidYMid slice"/>
  ${titleSvg}
  <text x="56" y="1680" fill="#ff6a2b" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="900">${escapeXml(price || '')}</text>
  <text x="56" y="1760" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">asfixgear.com</text>
  <text x="56" y="1805" fill="rgba(255,255,255,0.7)" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="600">0303-9227000</text>
  <rect y="1904" width="1080" height="16" fill="#ff6a2b"/>
</svg>`;
}

/**
 * @param {{ imageBuffer: Buffer, mimeType?: string, title: string, price?: string, format?: 'square'|'story', badge?: string }} input
 * @returns {Promise<{ png: Buffer, caption: string, width: number, height: number, format: string }>}
 */
export async function generateSocialAd(input) {
  const title = String(input.title || '').trim().slice(0, 120);
  const price = String(input.price || '').trim().slice(0, 40);
  const badge = String(input.badge || 'SHOP NOW').trim().slice(0, 24);
  const format = input.format === 'story' ? 'story' : 'square';
  if (!title) throw new Error('Title is required');
  if (!Buffer.isBuffer(input.imageBuffer) || input.imageBuffer.length === 0) {
    throw new Error('Image is required');
  }

  const mime = String(input.mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
  // Normalize product photo to JPEG for smaller SVG embeds
  const jpeg = await sharp(input.imageBuffer)
    .rotate()
    .resize(900, 900, { fit: 'cover', withoutEnlargement: false })
    .jpeg({ quality: 85 })
    .toBuffer();
  const dataUri = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

  const svg =
    format === 'story'
      ? buildStorySvg({ dataUri, title, price })
      : buildSquareSvg({ dataUri, title, price, badge });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const caption = buildCaption({ title, price });
  return {
    png,
    caption,
    format,
    width: format === 'story' ? 1080 : 1080,
    height: format === 'story' ? 1920 : 1080,
  };
}
