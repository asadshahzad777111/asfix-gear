import { useEffect } from 'react';
import { SHOP } from '../../config/shop';

const SITE = 'https://asfixgear.com';
const DEFAULT_TITLE = 'AsFix & Gear | Mobile Repair & Accessories — Asad Shahzad';
const DEFAULT_DESC =
  `AsFix & Gear by Asad Shahzad — Expert mobile repair & premium accessories. WhatsApp: ${SHOP.phone}. Open 9 AM – 9 PM.`;

function upsertMeta(attr, key, content) {
  if (typeof document === 'undefined' || !content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (typeof document === 'undefined' || !href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Lightweight per-page title / description / canonical (no react-helmet dependency).
 */
export default function DocumentHead({
  title,
  description = DEFAULT_DESC,
  path = '/',
  canonical,
  noindex = false,
}) {
  const fullTitle = title ? `${title} | AsFix & Gear` : DEFAULT_TITLE;
  const url = canonical || `${SITE}${path.startsWith('/') ? path : `/${path}`}`;

  useEffect(() => {
    document.title = fullTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('name', 'twitter:card', 'summary');
    upsertLink('canonical', url);
    if (noindex) {
      upsertMeta('name', 'robots', 'noindex,nofollow');
    } else {
      const robots = document.head.querySelector('meta[name="robots"]');
      if (robots && robots.getAttribute('content')?.includes('noindex')) {
        robots.remove();
      }
    }
  }, [fullTitle, description, url, noindex]);

  return null;
}

export { SITE, DEFAULT_TITLE, DEFAULT_DESC };
