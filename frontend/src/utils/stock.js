export const LOW_STOCK_THRESHOLD = 5;

export function getStockStatus(stock) {
  const n = Number(stock) || 0;
  if (n <= 0) return 'out';
  if (n <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
}

/** True when stock is out (≤0) or low (1…threshold). */
export function needsStockAlert(stock) {
  return getStockStatus(stock) !== 'in';
}

export function getStockAlertProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => needsStockAlert(p.stock));
}

export function maxCartQty(product, currentQty = 0) {
  return Math.max(0, Number(product?.stock) || 0);
}
