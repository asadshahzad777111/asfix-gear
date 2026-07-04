/** Second image for shop cards: first gallery photo after the main image. */
export function getProductHoverImage(product) {
  if (!product) return null;
  const main = product.image;
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  const next = gallery.find((url) => url && url !== main);
  return next || null;
}
