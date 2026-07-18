import { useEffect, useRef, useState } from 'react';

const SCROLL_THRESHOLD = 8;
const TOP_REVEAL_Y = 16;

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Hide sticky header while scrolling down; reveal on scroll up.
 * Disabled when `blocked` (menu/cart open) or user prefers reduced motion.
 */
export default function useHeaderScrollHide(blocked = false) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (blocked || prefersReducedMotion()) {
      setHidden(false);
      return undefined;
    }

    lastY.current = window.scrollY;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;

        if (y <= TOP_REVEAL_Y) {
          setHidden(false);
        } else if (delta > SCROLL_THRESHOLD) {
          setHidden(true);
        } else if (delta < -SCROLL_THRESHOLD) {
          setHidden(false);
        }

        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [blocked]);

  return hidden;
}
