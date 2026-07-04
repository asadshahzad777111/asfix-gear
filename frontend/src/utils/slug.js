/** Client-side slug preview — mirrors backend slugify. */
export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function productPermalinkPreview(slug, productId) {
  const s = slugify(slug);
  if (s) return `/shop/p/${s}`;
  if (productId) return `/shop/${productId}`;
  return '/shop/p/your-product-slug';
}
