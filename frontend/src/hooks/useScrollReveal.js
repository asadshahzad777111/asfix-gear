import { useEffect, useRef, useState } from 'react';

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
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            delayTimer = window.setTimeout(() => setRevealed(true), delay);
          } else {
            setRevealed(true);
          }
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (delayTimer) window.clearTimeout(delayTimer);
    };
  }, [threshold, delay, disabled]);

  return {
    ref,
    revealClass: revealed ? 'scroll-revealed' : '',
  };
}
