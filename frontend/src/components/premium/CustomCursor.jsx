import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const glowRef = useRef(null);
  const ringPos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const hovering = useRef(false);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduced) return undefined;

    document.body.classList.add('custom-cursor-active');

    const onMove = (e) => {
      target.current = { x: e.clientX, y: e.clientY };

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    };

    const onOver = (e) => {
      hovering.current = Boolean(
        e.target.closest('a, button, input, textarea, select, [data-magnetic], .product-card-wrap')
      );
      document.body.classList.toggle('cursor-hover', hovering.current);
    };

    let raf = 0;
    const tick = () => {
      ringPos.current.x += (target.current.x - ringPos.current.x) * 0.38;
      ringPos.current.y += (target.current.y - ringPos.current.y) * 0.38;

      if (ringRef.current) {
        const scale = hovering.current ? 1.45 : 1;
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      }

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.body.classList.remove('custom-cursor-active', 'cursor-hover');
    };
  }, []);

  return (
    <div className="custom-cursor" aria-hidden="true">
      <div ref={glowRef} className="custom-cursor-glow" />
      <div ref={ringRef} className="custom-cursor-ring" />
      <div ref={dotRef} className="custom-cursor-dot" />
    </div>
  );
}
