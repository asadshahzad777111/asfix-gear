import { useEffect, useRef } from 'react';

export default function useScrollReveal({ threshold = 0.15, delay = 0, disabled = false } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    if (disabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('scroll-revealed');
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => el.classList.add('scroll-revealed'), delay);
          } else {
            el.classList.add('scroll-revealed');
          }
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, delay, disabled]);

  return ref;
}
