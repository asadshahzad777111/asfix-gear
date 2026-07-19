import { isDefaultProductImage } from '../config/products';

function cleanUrl(url) {
  const value = String(url || '').trim();
  if (!value || value.startsWith('blob:') || value.startsWith('data:')) return '';
  if (isDefaultProductImage(value)) return '';
  return value;
}

function cleanGallery(gallery) {
  return (Array.isArray(gallery) ? gallery : [])
    .map(cleanUrl)
    .filter(Boolean);
}

/** Dedicated hover / thumb-swap image for shop cards (never shown on detail). */
export function getProductHoverImage(product) {
  if (!product) return null;
  return cleanUrl(product.hover_image) || null;
}

/**
 * Card image set: Pic 1 (main) + optional hover_image for mouse/thumb swap.
 * Gallery photos are detail-only and are not included here.
 */
export function getProductCardImages(product) {
  if (!product) return { main: '', hover: '', extras: [], images: [] };

  const gallery = cleanGallery(product.gallery);
  let main = cleanUrl(product.image);
  const hover = cleanUrl(product.hover_image);

  // Fallback: only use a stock placeholder when there are no real photos
  if (!main && !hover && !gallery.length) {
    const fallback = String(product.image || '').trim();
    if (fallback) main = fallback;
  }

  // If main missing but gallery exists, first gallery can stand in for card main
  if (!main && gallery.length) main = gallery[0];

  const images = [];
  if (main) images.push(main);
  if (hover && hover !== main) images.push(hover);

  return { main, hover, extras: hover && hover !== main ? [hover] : [], images };
}

/**
 * Detail page images: Pic 1 (main) + gallery only.
 * Hover image is excluded so it never appears in the detail carousel.
 */
export function getProductDetailImages(product) {
  if (!product) return { main: '', images: [] };

  const gallery = cleanGallery(product.gallery);
  const hover = cleanUrl(product.hover_image);
  let main = cleanUrl(product.image);

  if (!main && gallery.length) main = gallery[0];

  const images = [];
  if (main) images.push(main);
  for (const url of gallery) {
    if (!url || url === main || url === hover) continue;
    if (!images.includes(url)) images.push(url);
  }

  if (!images.length) {
    const fallback = String(product.image || '').trim();
    if (fallback) images.push(fallback);
  }

  return { main: images[0] || '', images };
}

/** @deprecated use getProductDetailImages / getProductCardImages */
export function getProductThirdImage(product) {
  if (!product) return null;
  const { images } = getProductDetailImages(product);
  return images[2] || null;
}

/**
 * Resolve main + hover + gallery for save.
 * Never persists stock placeholders; hover stays separate from gallery.
 */
export function resolveProductImagesForSave(image, hoverImage = '', gallery = []) {
  let main = cleanUrl(image);
  let hover = cleanUrl(hoverImage);
  let extras = cleanGallery(gallery).filter((url) => url !== main && url !== hover);

  // If staff only filled gallery, promote first as main (not as hover)
  if (!main && extras.length) {
    main = extras[0];
    extras = extras.slice(1);
  }

  if (hover && hover === main) hover = '';

  return { image: main, hover_image: hover, gallery: extras };
}
