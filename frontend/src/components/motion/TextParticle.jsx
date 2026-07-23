import { useEffect, useRef, useState } from 'react';
import './text-particle.css';

const DEFAULT_ORANGE = '#ff6a2b';
const DEFAULT_LIGHT = 'rgba(245, 245, 247, 0.92)';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

function parseColor(input, fallback) {
  const raw = String(input || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('#')) {
    const hex = raw.length === 4
      ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
      : raw.slice(0, 7);
    const n = Number.parseInt(hex.slice(1), 16);
    if (Number.isNaN(n)) return fallback;
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
      a: 1,
    };
  }
  const m = raw.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (m) {
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] == null ? 1 : Number(m[4]),
    };
  }
  return fallback;
}

function resolveCssColor(el, colorProp, fallback) {
  if (!el) return parseColor(fallback, { r: 255, g: 106, b: 43, a: 1 });
  if (colorProp && !String(colorProp).startsWith('var(')) {
    return parseColor(colorProp, parseColor(fallback, { r: 255, g: 106, b: 43, a: 1 }));
  }
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:inherit';
  if (colorProp) probe.style.color = colorProp;
  el.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  el.removeChild(probe);
  return parseColor(computed, parseColor(fallback, { r: 255, g: 106, b: 43, a: 1 }));
}

function sampleTextParticles({
  text,
  width,
  height,
  fontSize,
  fontFamily,
  fontWeight,
  gap,
  maxParticles,
}) {
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.floor(width));
  off.height = Math.max(1, Math.floor(height));
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, off.width, off.height);
  ctx.fillStyle = '#fff';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, off.width / 2, off.height / 2);

  const { data } = ctx.getImageData(0, 0, off.width, off.height);
  const pts = [];
  const step = Math.max(2, Math.round(gap));

  for (let y = 0; y < off.height; y += step) {
    for (let x = 0; x < off.width; x += step) {
      const i = (y * off.width + x) * 4;
      if (data[i + 3] > 128) {
        pts.push({
          x: x + (Math.random() - 0.5) * 24,
          y: y + (Math.random() - 0.5) * 24,
          ox: x,
          oy: y,
          vx: 0,
          vy: 0,
          size: Math.random() * 1.1 + 0.7,
        });
      }
    }
  }

  if (pts.length <= maxParticles) return pts;
  const stride = Math.ceil(pts.length / maxParticles);
  return pts.filter((_, i) => i % stride === 0).slice(0, maxParticles);
}

/**
 * Mouse-repel particles that form `text`. Animation state lives in refs
 * (no React re-renders on mousemove). Falls back to plain text for
 * reduced-motion / failed canvas.
 */
export default function TextParticle({
  text,
  className = '',
  as: Tag = 'span',
  color,
  fontSize: fontSizeProp,
  fontWeight = 700,
  gap = 3,
  particleSize,
  mouseRadius = 46,
  mouseForce = 4.2,
  returnForce = 0.065,
  friction = 0.86,
  maxParticles = 900,
  idleDrift = true,
  'aria-hidden': ariaHidden,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const particlesRef = useRef([]);
  const rafRef = useRef(0);
  const colorRef = useRef({ r: 255, g: 106, b: 43, a: 0.92 });
  const optsRef = useRef({});
  const [fallback, setFallback] = useState(false);
  const label = String(text || '');

  optsRef.current = {
    mouseRadius,
    mouseForce,
    returnForce,
    friction,
    idleDrift,
    particleSize,
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || !label) return undefined;

    if (prefersReducedMotion()) {
      setFallback(true);
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setFallback(true);
      return undefined;
    }

    setFallback(false);
    const coarse = isCoarsePointer();
    let running = false;
    let visible = true;
    let disposed = false;

    const stopLoop = () => {
      running = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    const drawFrame = (time) => {
      if (disposed || !running) return;
      const particles = particlesRef.current;
      const { width, height } = canvas;
      const mouse = mouseRef.current;
      const {
        mouseRadius: radius,
        mouseForce: force,
        returnForce: home,
        friction: drag,
        idleDrift: drift,
        particleSize: sizeMul,
      } = optsRef.current;
      const c = colorRef.current;
      const t = time * 0.001;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${c.a})`;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        if (mouse.active && dist < radius && dist > 0.01) {
          const f = ((radius - dist) / radius) * force;
          p.vx += (dx / dist) * f;
          p.vy += (dy / dist) * f;
        } else if (coarse && drift) {
          p.vx += Math.sin(t + p.ox * 0.04) * 0.035;
          p.vy += Math.cos(t * 0.9 + p.oy * 0.04) * 0.035;
        }

        p.vx += (p.ox - p.x) * home;
        p.vy += (p.oy - p.y) * home;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx;
        p.y += p.vy;

        const s = (sizeMul || p.size);
        ctx.fillRect(p.x, p.y, s, s);
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    const startLoop = () => {
      if (disposed || running || !visible) return;
      running = true;
      rafRef.current = requestAnimationFrame(drawFrame);
    };

    const rebuild = () => {
      const rect = wrap.getBoundingClientRect();
      const css = getComputedStyle(wrap);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const resolvedSize = fontSizeProp
        || Number.parseFloat(css.fontSize)
        || Math.max(12, Math.min(width * 0.12, height * 0.62));
      const family = css.fontFamily || 'system-ui, sans-serif';
      const weight = fontWeight || css.fontWeight || 700;
      const drawText = css.textTransform === 'uppercase'
        ? label.toUpperCase()
        : css.textTransform === 'lowercase'
          ? label.toLowerCase()
          : label;

      colorRef.current = resolveCssColor(
        wrap,
        color || css.color,
        DEFAULT_ORANGE,
      );
      if (colorRef.current.a < 0.2) {
        colorRef.current = parseColor(DEFAULT_LIGHT, { r: 245, g: 245, b: 247, a: 0.92 });
      }

      const densityGap = gap + (width < 160 ? 1 : 0) + (coarse ? 1 : 0);
      particlesRef.current = sampleTextParticles({
        text: drawText,
        width,
        height,
        fontSize: resolvedSize,
        fontFamily: family,
        fontWeight: weight,
        gap: densityGap,
        maxParticles: coarse ? Math.min(maxParticles, 420) : maxParticles,
      });

      if (!particlesRef.current.length) {
        setFallback(true);
        stopLoop();
        return;
      }

      startLoop();
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const onPointerLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };

    rebuild();

    const ro = new ResizeObserver(() => {
      rebuild();
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) startLoop();
        else stopLoop();
      },
      { rootMargin: '40px', threshold: 0.01 },
    );
    io.observe(wrap);

    wrap.addEventListener('pointermove', onPointerMove, { passive: true });
    wrap.addEventListener('pointerleave', onPointerLeave);
    wrap.addEventListener('pointercancel', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      stopLoop();
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('pointerleave', onPointerLeave);
      wrap.removeEventListener('pointercancel', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      particlesRef.current = [];
    };
  }, [label, color, fontSizeProp, fontWeight, gap, maxParticles]);

  if (!label) return null;

  return (
    <Tag
      ref={wrapRef}
      className={`text-particle ${fallback ? 'text-particle--fallback' : ''} ${className}`.trim()}
      aria-label={ariaHidden ? undefined : label}
      aria-hidden={ariaHidden ? true : undefined}
    >
      {fallback ? (
        <span className="text-particle__static">{label}</span>
      ) : (
        <>
          <span className="text-particle__sr">{label}</span>
          <canvas ref={canvasRef} className="text-particle__canvas" aria-hidden="true" />
        </>
      )}
    </Tag>
  );
}
