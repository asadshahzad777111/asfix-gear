import { useEffect, useRef, useState } from 'react';

/**
 * Bidirectional scroll reveal — elements animate in when entering the viewport
 * and reset when leaving, so reverse scroll feels alive (not one-shot).
 */
export default function useScrollReveal({ threshold = 0.15, delay = 0, disabled = false } = {}) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(disabled);

  useEffect(() => {
    if (disabled) {
      setRevealed(true);
      return undefined;
    }

    const el = ref.current;
    if (!el) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return undefined;
    }

    let delayTimer = null;

    const clearDelay = () => {
      if (delayTimer) {
        window.clearTimeout(delayTimer);
        delayTimer = null;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            clearDelay();
            delayTimer = window.setTimeout(() => setRevealed(true), delay);
          } else {
            setRevealed(true);
          }
        } else {
          clearDelay();
          setRevealed(false);
        }
      },
      { threshold, rootMargin: '0px 0px -6% 0px' }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearDelay();
    };
  }, [threshold, delay, disabled]);

  return {
    ref,
    revealClass: revealed ? 'scroll-revealed' : '',
    revealed,
  };
}
