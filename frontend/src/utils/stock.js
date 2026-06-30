export const LOW_STOCK_THRESHOLD = 5;

export function getStockStatus(stock) {
  const n = Number(stock) || 0;
  if (n <= 0) return 'out';
  if (n <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
}

export function maxCartQty(product, currentQty = 0) {
  return Math.max(0, Number(product?.stock) || 0);
}
