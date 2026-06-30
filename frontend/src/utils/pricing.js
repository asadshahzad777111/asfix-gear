export const DISCOUNT_PRESETS = [5, 10, 15, 20, 25, 30, 50];

export function hasDiscount(product) {
  return Number(product?.discount_percent) > 0;
}

export function getSalePrice(product) {
  const price = Number(product?.price) || 0;
  const pct = Number(product?.discount_percent) || 0;
  if (pct <= 0) return price;
  return Math.round(price * (1 - pct / 100));
}

export function getSavings(product) {
  return Number(product?.price) - getSalePrice(product);
}
