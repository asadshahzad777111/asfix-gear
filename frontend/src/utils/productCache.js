import { filterPublishedProducts } from './productStatus';

const PREFIX = 'asfix_products_';

export function readProductsCache(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return filterPublishedProducts(parsed);
  } catch {
    return null;
  }
}

export function writeProductsCache(key, products) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(filterPublishedProducts(products)));
  } catch {
    /* sessionStorage full or unavailable */
  }
}

export function clearProductsCache() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* sessionStorage unavailable */
  }
}
