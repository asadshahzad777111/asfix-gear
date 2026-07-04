/** Public shop surfaces only show published products (defense in depth vs API/cache). */
export function isPublishedProduct(product) {
  return (product?.status || 'published') === 'published';
}

export function filterPublishedProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.filter(isPublishedProduct);
}
