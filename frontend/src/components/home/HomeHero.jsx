import { useEffect, useRef, useState } from 'react';
import { PremiumLink } from '../premium/PremiumButton';
import { useTranslation } from '../../context/LanguageContext';
import { api } from '../../api/client';
import { DEFAULT_HERO_SLIDES } from '../../config/heroSlides';
import { detectMediaType } from '../../utils/heroMediaUpload';

const IMAGE_INTERVAL_MS = 5200;
const VIDEO_INTERVAL_MS = 10000;

/** PhoneCase-style full-bleed hero carousel — image or short muted video */
export default function HomeHero() {
  const { t } = useTranslation();
  const [slides, setSlides] = useState(DEFAULT_HERO_SLIDES);
  const [index, setIndex] = useState(0);
  const videoRefs = useRef({});

  useEffect(() => {
    let cancelled = false;

    const applySlides = (data) => {
      if (cancelled || !data?.hero_slides?.length) return;
      const mapped = data.hero_slides
        .filter((s) => s?.image)
        .map((s, i) => ({
          id: s.id || `slide-${i}`,
          image: s.image,
          media_type: detectMediaType(s.image, s.media_type),
          title: s.title || '',
          sub: s.subtitle || '',
          ctaTo: s.href || '/shop',
        }));
      if (mapped.length) {
        setSlides(mapped);
        setIndex(0);
      }
    };

    api.getStorefrontImages().then(applySlides).catch(() => {});

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        api.getStorefrontImages().then(applySlides).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Advance carousel; videos stay longer so the clip can play
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const current = slides[index];
    const delay = current?.media_type === 'video' ? VIDEO_INTERVAL_MS : IMAGE_INTERVAL_MS;
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [slides, index]);

  // Play active video muted; pause others (autoplay policy friendly)
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([key, el]) => {
      if (!el) return;
      const i = Number(key);
      if (i === index) {
        el.muted = true;
        const playPromise = el.play();
        if (playPromise?.catch) playPromise.catch(() => {});
      } else {
        el.pause();
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    });
  }, [index, slides]);

  const slide = slides[index] || slides[0];
  const title = slide.title || (slide.titleKey ? t(slide.titleKey) : '');
  const sub = slide.sub || slide.subtitle || (slide.subKey ? t(slide.subKey) : '');

  return (
    <section className="pc-hero-carousel" aria-roledescription="carousel">
      {slides.map((s, i) => {
        const isVideo = (s.media_type || detectMediaType(s.image)) === 'video';
        return (
          <div
            key={s.id}
            className={`pc-hero-slide${i === index ? ' is-active' : ''}`}
            aria-hidden={i !== index}
          >
            {isVideo ? (
              <video
                ref={(el) => {
                  if (el) videoRefs.current[i] = el;
                  else delete videoRefs.current[i];
                }}
                className="pc-hero-slide-img pc-hero-slide-video"
                src={s.image}
                muted
                playsInline
                loop
                preload={i === index || i === 0 ? 'auto' : 'metadata'}
                aria-hidden
              />
            ) : (
              <img
                src={s.image}
                alt=""
                className="pc-hero-slide-img"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            )}
          </div>
        );
      })}
      <div className="pc-hero-overlay" />
      <div className="container pc-hero-content">
        <p className="pc-hero-kicker">{t('home.heroTag')}</p>
        <h1 className="pc-hero-title">{title}</h1>
        <p className="pc-hero-sub">{sub}</p>
        <PremiumLink to={slide.ctaTo || slide.href || '/shop'} className="btn btn-primary pc-hero-cta">
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
