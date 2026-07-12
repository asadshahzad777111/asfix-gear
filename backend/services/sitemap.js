import * as store from '../store.js';
import { slugify } from '../utils/slug.js';

const SITE = 'https://asfixgear.com';

const STATIC_URLS = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
  { path: '/repair', changefreq: 'weekly', priority: '0.8' },
  { path: '/gaming', changefreq: 'weekly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/track', changefreq: 'monthly', priority: '0.5' },
  { path: '/faq', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/refund', changefreq: 'yearly', priority: '0.3' },
  { path: '/shipping', changefreq: 'yearly', priority: '0.3' },
];

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function productLoc(product) {
  const slug = slugify(product.slug || product.name);
  if (slug) return `${SITE}/shop/p/${slug}`;
  return `${SITE}/shop/${product.id}`;
}

function urlEntry({ loc, changefreq, priority, lastmod }) {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

/** Build sitemap.xml merging static pages + published product URLs. */
export function buildSitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = STATIC_URLS.map((u) =>
    urlEntry({
      loc: `${SITE}${u.path}`,
      changefreq: u.changefreq,
      priority: u.priority,
      lastmod: today,
    })
  );

  const products = store
    .getProducts({})
    .filter((p) => store.isPublishedProduct(p));

  for (const product of products) {
    const updated = String(product.updated_at || product.created_at || '').slice(0, 10);
    entries.push(
      urlEntry({
        loc: productLoc(product),
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: /^\d{4}-\d{2}-\d{2}$/.test(updated) ? updated : today,
      })
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
}
