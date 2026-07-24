import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import TextParticle from './motion/TextParticle';

/** Category / service words shown in the scrolling strip */
const MARQUEE_KEYS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'];

function isCoarsePointer() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Marquee() {
  const { t } = useTranslation();
  const wrapRef = useRef(null);
  const [allowParticles, setAllowParticles] = useState(false);
  const [inView, setInView] = useState(true);
  const items = MARQUEE_KEYS.map((key) => t(`marquee.${key}`));
  const track = [...items, ...items];

  useEffect(() => {
    /* Hover-only particle overlay — skip canvas work on touch / reduced motion. */
    setAllowParticles(!isCoarsePointer() && !prefersReducedMotion());
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: '48px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`marquee-wrap${inView ? '' : ' is-offscreen'}`}
      aria-hidden="true"
    >
      <div className="marquee-track">
        {track.map((item, i) => (
          <span key={`${item}-${i}`} className="marquee-item">
            {/* Static label sizes the slot and stays readable while scrolling.
                Particles overlay only on hover (track paused). */}
            <span className="marquee-item__stack">
              <span className="marquee-item__label">{item}</span>
              {allowParticles && inView && i < items.length ? (
                <TextParticle
                  text={item}
                  className="marquee-particle"
                  gap={2}
                  particleSize={1.45}
                  mouseRadius={40}
                  maxParticles={700}
                  idleDrift={false}
                  aria-hidden
                />
              ) : null}
            </span>
            <span className="marquee-dot">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function MarqueeStatic() {
  return null;
}
