import { useEffect, useRef } from 'react';

/** Classic AsFix atmosphere: orange / violet / mint blooms + drifting dots. */

const DOT_COUNT = 24;

/** Deterministic layout so SSR/hydration stays stable */
function buildDots(count) {
  const dots = [];
  for (let i = 0; i < count; i += 1) {
    const left = ((i * 47) % 97) + 1.5;
    const top = ((i * 31) % 96) + 2;
    const size = 1 + (i % 3);
    const delay = -((i % 14) * 1.35);
    const duration = 16 + (i % 10) * 1.4;
    const opacity = 0.22 + ((i % 5) * 0.08);
    dots.push({ left, top, size, delay, duration, opacity });
  }
  return dots;
}

const DOTS = buildDots(DOT_COUNT);

export default function AmbientBackground() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    /* Skip scroll-linked CSS var updates on touch — invalidates blurred orb layers. */
    const coarse =
      typeof window !== 'undefined'
      && window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const reduce =
      typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduce) {
      root.style.setProperty('--ambient-parallax-y', '0px');
      root.style.setProperty('--ambient-parallax-x', '0px');
      return undefined;
    }

    let raf = 0;
    const syncParallax = () => {
      raf = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      /* Blooms drift a little with scroll so motion is felt while browsing */
      root.style.setProperty('--ambient-parallax-y', `${Math.min(y, 1400) * 0.055}px`);
      root.style.setProperty('--ambient-parallax-x', `${Math.sin(y / 280) * 18}px`);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(syncParallax);
    };

    syncParallax();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="ambient-bg" ref={rootRef} aria-hidden="true">
      <div className="ambient-veil" />
      <div className="ambient-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="ambient-dots">
        {DOTS.map((dot, i) => (
          <span
            key={i}
            className="ambient-dot"
            style={{
              left: `${dot.left}%`,
              top: `${dot.top}%`,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              opacity: dot.opacity,
              animationDelay: `${dot.delay}s`,
              animationDuration: `${dot.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="grid-overlay" />
    </div>
  );
}
