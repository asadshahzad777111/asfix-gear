import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim();

function loadGtag(measurementId) {
  if (typeof window === 'undefined' || !measurementId) return;
  if (window.__asfixGaLoaded) return;
  window.__asfixGaLoaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(...args) {
    window.dataLayer.push(args);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: false });
}

/**
 * Loads GA4 only when VITE_GA_MEASUREMENT_ID is set. Tracks SPA page views on route change.
 */
export default function Analytics() {
  const location = useLocation();

  useEffect(() => {
    if (!GA_ID || !GA_ID.startsWith('G-')) return;
    loadGtag(GA_ID);
  }, []);

  useEffect(() => {
    if (!GA_ID || !GA_ID.startsWith('G-') || typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);

  return null;
}
