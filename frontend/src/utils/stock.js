export const LOW_STOCK_THRESHOLD = 5;
const POS_CUSTOM_CATEGORY = 'pos custom';
const POS_CUSTOM_TAG = 'pos-custom';

/** Coerce API/form stock to a non-negative integer (handles strings like "4"). */
export function normalizeStock(stock) {
  const n = Number(stock);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** True only when salable units remain — low stock (1…threshold) still counts as in stock. */
export function isInStock(stock) {
  return normalizeStock(stock) > 0;
}

export function isOutOfStock(stock) {
  return !isInStock(stock);
}

export function getStockStatus(stock) {
  const n = normalizeStock(stock);
  if (n <= 0) return 'out';
  if (n <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
}

/** Custom-bill save rows — keep in inventory views, exclude from popup alert noise. */
export function isPosCustomProduct(product) {
  if (!product) return false;
  const category = String(product.category || '').trim().toLowerCase();
  if (category === POS_CUSTOM_CATEGORY) return true;
  const tags = Array.isArray(product.tags) ? product.tags : [];
  return tags.some((tag) => String(tag || '').trim().toLowerCase() === POS_CUSTOM_TAG);
}

/** True when stock is out (≤0) or low (1…threshold). */
export function needsStockAlert(stock) {
  return getStockStatus(stock) !== 'in';
}

export function getStockAlertProducts(products, { excludePosCustom = false } = {}) {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => {
    if (excludePosCustom && isPosCustomProduct(p)) return false;
    return needsStockAlert(p.stock);
  });
}

export function getLowStockProducts(products, { excludePosCustom = false } = {}) {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => {
    if (excludePosCustom && isPosCustomProduct(p)) return false;
    return getStockStatus(p.stock) === 'low';
  });
}

export function maxCartQty(product) {
  return normalizeStock(product?.stock);
}
