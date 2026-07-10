import { useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#@$%&*';

/**
 * Locomotive-style character scramble that resolves into final text.
 * Respects prefers-reduced-motion.
 */
export default function ScrambleText({
  text,
  as: Tag = 'span',
  className = '',
  delay = 0,
  duration = 900,
  ...rest
}) {
  const [display, setDisplay] = useState(text);
  const frameRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || !text) {
      setDisplay(text);
      return undefined;
    }

    let raf = 0;
    let timeout = 0;
    const chars = text.split('');

    const tick = (now) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const revealCount = Math.floor(progress * chars.length);

      const next = chars
        .map((ch, i) => {
          if (ch === ' ' || ch === '\n' || ch === '·' || ch === '&') return ch;
          if (i < revealCount) return chars[i];
          return GLYPHS[(frameRef.current + i * 7) % GLYPHS.length];
        })
        .join('');

      setDisplay(next);
      frameRef.current += 1;

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };

    timeout = window.setTimeout(() => {
      startRef.current = 0;
      raf = requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [text, delay, duration]);

  return (
    <Tag className={`scramble-text ${className}`.trim()} aria-label={text} {...rest}>
      {display}
    </Tag>
  );
}
