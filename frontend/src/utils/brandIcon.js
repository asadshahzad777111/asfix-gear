import { SHOP_BRANDS } from '../config/products';
import { SHOP_BRAND_TO_REPAIR_BRAND } from '../config/repairModels';

const REPAIR_BRAND_TO_SHOP_ID = Object.fromEntries(
  Object.entries(SHOP_BRAND_TO_REPAIR_BRAND).map(([shopId, repairName]) => [repairName, shopId])
);

/**
 * Map our shop brand ids to Simple Icons slugs (https://simpleicons.org).
 * CDN pattern only — no per-brand full URLs stored.
 */
const BRAND_SIMPLE_ICON_SLUG = {
  iphone: 'apple',
  pixel: 'google',
};

/** Brands not on Simple Icons — self-hosted SVG wordmarks in /public/brands/. */
const BRAND_LOCAL_ICON = {
  infinix: '/brands/infinix.svg',
  tecno: '/brands/tecno.svg',
  realme: '/brands/realme.svg',
  nothing: '/brands/nothing.svg',
  itel: '/brands/itel.svg',
};

export function getSimpleIconSlug(brandId) {
  const id = String(brandId || '').trim().toLowerCase();
  if (!id) return '';
  return BRAND_SIMPLE_ICON_SLUG[id] || id;
}

/** Simple Icons CDN, with local SVG fallback for brands missing from the CDN. */
export function getBrandIconUrl(brandId, color = '374151') {
  const id = String(brandId || '').trim().toLowerCase();
  if (!id) return '';
  if (BRAND_LOCAL_ICON[id]) return BRAND_LOCAL_ICON[id];
  const slug = getSimpleIconSlug(id);
  if (!slug) return '';
  const hex = String(color).replace('#', '');
  return `https://cdn.simpleicons.org/${encodeURIComponent(slug)}/${hex}`;
}

export function getBrandMeta(brandId) {
  const id = String(brandId || '').trim().toLowerCase();
  return SHOP_BRANDS.find((b) => b.id === id) || null;
}

export function getBrandFallbackEmoji(brandId) {
  return getBrandMeta(brandId)?.icon || '📱';
}

/** Resolve a repair catalog brand name back to a shop brand id for icons. */
export function getShopBrandIdFromRepairBrand(repairBrandName) {
  return REPAIR_BRAND_TO_SHOP_ID[String(repairBrandName || '').trim()] || '';
}
