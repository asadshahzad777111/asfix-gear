/** Lowercase URL slug from product name or custom input. */
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

export function isValidSlug(slug) {
  if (!slug) return true;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100;
}

export function ensureUniqueSlug(products, baseSlug, excludeId = null) {
  const root = slugify(baseSlug);
  if (!root) return '';
  let candidate = root;
  let n = 2;
  const taken = (s) =>
    products.some((p) => p.slug === s && Number(p.id) !== Number(excludeId));
  while (taken(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}
