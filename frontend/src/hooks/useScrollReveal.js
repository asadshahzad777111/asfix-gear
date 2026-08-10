import { useEffect, useRef, useState } from 'react';

/**
 * One-shot scroll reveal — once visible, stays visible.
 * (Replay-on-leave left sections at opacity:0 on iPhone after login/navigation.)
 */
export default function useScrollReveal({
  threshold = 0.08,
  delay = 0,
  disabled = false,
  rootMargin = '0px 0px -6% 0px',
} = {}) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(disabled);
  const delayRef = useRef(delay);
  delayRef.current = delay;
  const doneRef = useRef(disabled);

  useEffect(() => {
    if (disabled) {
      doneRef.current = true;
      setRevealed(true);
      return undefined;
    }

    const el = ref.current;
    if (!el || doneRef.current) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      doneRef.current = true;
      setRevealed(true);
      return undefined;
    }

    let delayTimer = null;

    const revealNow = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      const wait = Math.max(0, delayRef.current);
      if (wait === 0) {
        setRevealed(true);
      } else {
        delayTimer = window.setTimeout(() => setRevealed(true), wait);
      }
    };

    // iOS Safari often skips the first IO callback when the node is already on screen
    // (common after login redirect). Force a sync check on the next frames.
    const kick = () => {
      if (doneRef.current || !el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      const visible = rect.bottom > 0 && rect.top < vh;
      if (visible) revealNow();
    };

    const raf1 = window.requestAnimationFrame(() => {
      kick();
      window.requestAnimationFrame(kick);
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) revealNow();
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    // Last-resort: never leave storefront sections invisible
    const failsafe = window.setTimeout(() => {
      if (!doneRef.current) revealNow();
    }, 1200);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf1);
      window.clearTimeout(failsafe);
      if (delayTimer) window.clearTimeout(delayTimer);
    };
  }, [threshold, disabled, rootMargin]);

  return {
    ref,
    revealClass: revealed ? 'scroll-revealed' : '',
    revealed,
  };
}
