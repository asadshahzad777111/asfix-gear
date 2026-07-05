/** Second image for shop cards: first gallery photo after the main image. */
export function getProductHoverImage(product) {
  if (!product) return null;
  const { extras } = getProductCardImages(product);
  return extras[0] || null;
}

/** Third image for premium hover cycle (gallery[1]). */
export function getProductThirdImage(product) {
  if (!product) return null;
  const { extras } = getProductCardImages(product);
  return extras[1] || null;
}

/**
 * Normalized image set for cards & detail — main + up to 2 unique gallery URLs (3 total).
 */
export function getProductCardImages(product) {
  if (!product) return { main: '', extras: [], images: [] };
  const main = product.image || '';
  const gallery = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
  const extras = [];
  for (const url of gallery) {
    if (url && url !== main && !extras.includes(url)) extras.push(url);
    if (extras.length >= 2) break;
  }
  const images = main ? [main, ...extras] : extras;
  return { main, extras, images };
}
