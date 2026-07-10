import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeProductCard from './HomeProductCard';
import { useTranslation } from '../../context/LanguageContext';

const AUTO_SCROLL_MS = 3500;

export default function ProductCarousel({ titleKey, subtitleKey, products = [], viewAllTo = '/shop' }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const getStep = (track) => {
    const card = track.firstElementChild;
    if (!card) return 0;
    const gap = parseFloat(getComputedStyle(track).gap) || 16;
    return card.offsetWidth + gap;
  };

  const scrollByDir = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    const step = getStep(track);
    if (!step) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (maxScroll <= 0) return;

    if (dir > 0 && track.scrollLeft >= maxScroll - 4) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (dir < 0 && track.scrollLeft <= 4) {
      track.scrollTo({ left: maxScroll, behavior: 'smooth' });
    } else {
      track.scrollBy({ left: dir * step, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track || products.length < 2 || paused) return undefined;

    const id = window.setInterval(() => scrollByDir(1), AUTO_SCROLL_MS);
    return () => window.clearInterval(id);
  }, [products.length, paused]);

  if (products.length === 0) return null;

  return (
    <section className="home-section">
      <div className="container">
        <div className="home-section-head home-carousel-head">
          <div>
            <h2 className="section-title">{t(titleKey)}</h2>
            {subtitleKey && <p className="section-subtitle">{t(subtitleKey)}</p>}
          </div>
          {products.length > 1 && (
            <div className="home-carousel-nav" role="group" aria-label="Carousel controls">
              <button
                type="button"
                className="home-carousel-btn"
                aria-label="Previous products"
                onClick={() => scrollByDir(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="home-carousel-btn"
                aria-label="Next products"
                onClick={() => scrollByDir(1)}
              >
                ›
              </button>
            </div>
          )}
        </div>
        <div
          className="home-carousel-wrap"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="home-carousel-track" ref={trackRef}>
            {products.map((product) => (
              <HomeProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
        <div className="text-center mt-2">
          <Link to={viewAllTo} className="btn btn-ghost">
            {t('home.viewAll')} →
          </Link>
        </div>
      </div>
    </section>
  );
}
