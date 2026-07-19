import { useEffect, useRef, useState } from 'react';

/**
 * Continuous scroll reveal — plays when entering the view band and
 * resets when leaving, so up/down scrolling keeps replaying (not one-shot).
 */
export default function useScrollReveal({
  threshold = 0.12,
  delay = 0,
  disabled = false,
  /** Inset band: leave top/bottom → reset; re-enter → animate again */
  rootMargin = '-10% 0px -18% 0px',
} = {}) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(disabled);
  const [playId, setPlayId] = useState(0);
  const delayRef = useRef(delay);
  delayRef.current = delay;

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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          /* Bump playId so enter always restarts even if still "revealed" */
          setRevealed(false);
          setPlayId((n) => n + 1);
        } else {
          setRevealed(false);
          setPlayId(0);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, disabled, rootMargin]);

  /* After reset, wait a frame so CSS can apply the hidden state, then reveal */
  useEffect(() => {
    if (disabled || playId === 0) return undefined;

    let delayTimer = null;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        const wait = Math.max(0, delayRef.current);
        if (wait === 0) {
          setRevealed(true);
        } else {
          delayTimer = window.setTimeout(() => setRevealed(true), wait);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      if (delayTimer) window.clearTimeout(delayTimer);
    };
  }, [playId, disabled]);

  return {
    ref,
    revealClass: revealed ? 'scroll-revealed' : '',
    revealed,
  };
}
