import { isDefaultProductImage } from '../config/products';

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
 * Skips stock Unsplash placeholders when real gallery photos exist.
 */
export function getProductCardImages(product) {
  if (!product) return { main: '', extras: [], images: [] };

  const gallery = Array.isArray(product.gallery)
    ? product.gallery.filter((url) => url && !isDefaultProductImage(url))
    : [];

  let main = String(product.image || '').trim();
  if (isDefaultProductImage(main)) {
    // Don't show placeholder stock art alongside real gallery uploads
    main = gallery[0] || '';
  }

  const extras = [];
  for (const url of gallery) {
    if (url && url !== main && !extras.includes(url)) extras.push(url);
    if (extras.length >= 2) break;
  }

  // Fallback: only show category placeholder when there are no real photos at all
  if (!main && !extras.length) {
    const fallback = String(product.image || '').trim();
    if (fallback) main = fallback;
  }

  const images = main ? [main, ...extras] : extras;
  return { main, extras, images };
}

/**
 * Resolve main + gallery for save — never persist a stock placeholder
 * when the staff uploaded real gallery photos.
 */
export function resolveProductImagesForSave(image, gallery = []) {
  const cleanGallery = (Array.isArray(gallery) ? gallery : [])
    .map((url) => String(url || '').trim())
    .filter((url) => url && !url.startsWith('blob:') && !url.startsWith('data:') && !isDefaultProductImage(url));

  let main = String(image || '').trim();
  if (!main || main.startsWith('blob:') || main.startsWith('data:') || isDefaultProductImage(main)) {
    main = cleanGallery[0] || '';
  }

  const extras = cleanGallery.filter((url) => url !== main);
  return { image: main, gallery: extras };
}
