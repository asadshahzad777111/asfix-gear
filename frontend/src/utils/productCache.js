const PREFIX = 'asfix_products_';

export function readProductsCache(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeProductsCache(key, products) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(products));
  } catch {
    /* sessionStorage full or unavailable */
  }
}
