import { useEffect, useRef } from 'react';

/** Scroll target into view when `active` becomes true (e.g. after form submit). */
export default function useScrollIntoView(active, options = { block: 'start', behavior: 'smooth' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const timer = window.setTimeout(() => {
      ref.current?.scrollIntoView(options);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [active, options.block, options.behavior]);

  return ref;
}
