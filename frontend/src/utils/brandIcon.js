import { SHOP_BRANDS } from '../config/products';
import { SHOP_BRAND_TO_REPAIR_BRAND } from '../config/repairModels';

const REPAIR_BRAND_TO_SHOP_ID = Object.fromEntries(
  Object.entries(SHOP_BRAND_TO_REPAIR_BRAND).map(([shopId, repairName]) => [repairName, shopId])
);

/**
 * Self-hosted brand marks in /public/brands/ — avoid CDN 403s (simpleicons.org
 * blocks many hosts). Keep SVGs in the repo so logos survive redeploys.
 */
const BRAND_LOCAL_ICON = {
  iphone: '/brands/iphone.svg',
  samsung: '/brands/samsung.svg',
  oneplus: '/brands/oneplus.svg',
  xiaomi: '/brands/xiaomi.svg',
  vivo: '/brands/vivo.svg',
  oppo: '/brands/oppo.svg',
  infinix: '/brands/infinix.svg',
  tecno: '/brands/tecno.svg',
  pixel: '/brands/pixel.svg',
  realme: '/brands/realme.svg',
  motorola: '/brands/motorola.svg',
  nothing: '/brands/nothing.svg',
  honor: '/brands/honor.svg',
  itel: '/brands/itel.svg',
};

export function getSimpleIconSlug(brandId) {
  const id = String(brandId || '').trim().toLowerCase();
  if (!id) return '';
  if (id === 'iphone') return 'apple';
  if (id === 'pixel') return 'google';
  return id;
}

/** Prefer local SVG; empty string means use emoji fallback. */
export function getBrandIconUrl(brandId) {
  const id = String(brandId || '').trim().toLowerCase();
  if (!id) return '';
  return BRAND_LOCAL_ICON[id] || '';
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
