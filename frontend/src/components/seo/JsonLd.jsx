import { useEffect } from 'react';
import { SHOP } from '../../config/shop';
import { SITE } from './DocumentHead';

function upsertJsonLd(id, data) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id) {
  if (typeof document === 'undefined') return;
  document.getElementById(id)?.remove();
}

/** LocalBusiness schema for home / contact / shop hub pages. */
export function LocalBusinessJsonLd() {
  useEffect(() => {
    upsertJsonLd('asfix-ld-local', {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${SITE}/#business`,
      name: SHOP.name,
      description: 'Mobile repair and accessories shop in Lahore — screens, parts, gaming gear.',
      url: SITE,
      telephone: `+${SHOP.phoneIntl}`,
      email: SHOP.email,
      image: `${SITE}/logo.svg`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: SHOP.city,
        addressCountry: 'PK',
        streetAddress: SHOP.addressLine1,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: SHOP.lat,
        longitude: SHOP.lng,
      },
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '09:00',
        closes: '21:00',
      },
      priceRange: 'PKR',
    });
    return () => removeJsonLd('asfix-ld-local');
  }, []);

  return null;
}

/** Product schema for product detail pages. */
export function ProductJsonLd({ product, path }) {
  useEffect(() => {
    if (!product) return undefined;
    const price = Number(product.price) || 0;
    const discount = Number(product.discount_percent) || 0;
    const sale =
      discount > 0 ? Math.round(price * (1 - discount / 100)) : price;
    const inStock = Number(product.stock) > 0;

    upsertJsonLd('asfix-ld-product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: String(product.description || product.name).slice(0, 500),
      sku: String(product.id),
      image: product.image ? [product.image] : undefined,
      brand: product.brand
        ? { '@type': 'Brand', name: product.brand }
        : { '@type': 'Brand', name: SHOP.name },
      offers: {
        '@type': 'Offer',
        url: `${SITE}${path}`,
        priceCurrency: 'PKR',
        price: sale,
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: SHOP.name },
      },
    });
    return () => removeJsonLd('asfix-ld-product');
  }, [product, path]);

  return null;
}
