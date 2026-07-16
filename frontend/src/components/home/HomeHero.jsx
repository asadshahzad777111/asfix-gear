import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PremiumLink } from '../premium/PremiumButton';
import { useTranslation } from '../../context/LanguageContext';
import { api } from '../../api/client';

const FALLBACK_SLIDES = [
  {
    id: 'cases',
    image:
      'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=1400&h=900&fit=crop&q=80',
    titleKey: 'home.heroSlide1Title',
    subKey: 'home.heroSlide1Sub',
    ctaTo: '/shop?category=Cases',
  },
  {
    id: 'chargers',
    image:
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1400&h=900&fit=crop&q=80',
    titleKey: 'home.heroSlide2Title',
    subKey: 'home.heroSlide2Sub',
    ctaTo: '/shop?category=Chargers',
  },
  {
    id: 'guards',
    image:
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1400&h=900&fit=crop&q=80',
    titleKey: 'home.heroSlide3Title',
    subKey: 'home.heroSlide3Sub',
    ctaTo: '/shop?category=Screen%20Guards',
  },
];

/** PhoneCase-style full-bleed hero carousel — no Repair CTA in hero */
export default function HomeHero() {
  const { t } = useTranslation();
  const [slides, setSlides] = useState(FALLBACK_SLIDES);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getStorefrontImages()
      .then((data) => {
        if (cancelled || !data?.hero_slides?.length) return;
        const mapped = data.hero_slides
          .filter((s) => s?.image)
          .map((s, i) => ({
            id: s.id || `slide-${i}`,
            image: s.image,
            title: s.title || '',
            sub: s.subtitle || '',
            ctaTo: s.href || '/shop',
          }));
        if (mapped.length) setSlides(mapped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const slide = slides[index] || slides[0];
  const title = slide.title || (slide.titleKey ? t(slide.titleKey) : '');
  const sub = slide.sub || (slide.subKey ? t(slide.subKey) : '');

  return (
    <section className="pc-hero-carousel" aria-roledescription="carousel">
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`pc-hero-slide${i === index ? ' is-active' : ''}`}
          aria-hidden={i !== index}
        >
          <img src={s.image} alt="" className="pc-hero-slide-img" loading={i === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}
      <div className="pc-hero-overlay" />
      <div className="container pc-hero-content">
        <p className="pc-hero-kicker">{t('home.heroTag')}</p>
        <h1 className="pc-hero-title">{title}</h1>
        <p className="pc-hero-sub">{sub}</p>
        <PremiumLink to={slide.ctaTo || '/shop'} className="btn btn-primary pc-hero-cta">
          {t('home.shopNow')}
        </PremiumLink>
        <div className="pc-hero-dots" role="tablist" aria-label="Hero slides">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`pc-hero-dot${i === index ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
