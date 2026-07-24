import { useEffect, useRef, useState } from 'react';
import './text-particle.css';

const DEFAULT_ORANGE = '#ff6a2b';
const DEFAULT_LIGHT = 'rgba(245, 245, 247, 0.96)';
const MIN_LAYOUT_PX = 24;
const PAD_X = 6;
const PAD_Y = 3;

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

/** Shrink font until `text` fits inside canvas with padding. */
function fitFontSize(ctx, text, maxWidth, maxHeight, startSize, fontFamily, fontWeight) {
  let size = Math.max(8, Math.floor(startSize));
  const floor = 8;
  while (size > floor) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const w = metrics.width;
    const asc = metrics.actualBoundingBoxAscent || size * 0.8;
    const desc = metrics.actualBoundingBoxDescent || size * 0.25;
    const h = asc + desc;
    if (w <= maxWidth - PAD_X * 2 && h <= maxHeight - PAD_Y * 2) break;
    size -= 1;
  }
  return size;
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
  particleSizeBase,
}) {
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.floor(width));
  off.height = Math.max(1, Math.floor(height));
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const fitted = fitFontSize(ctx, text, off.width, off.height, fontSize, fontFamily, fontWeight);

  ctx.clearRect(0, 0, off.width, off.height);
  ctx.fillStyle = '#fff';
  ctx.font = `${fontWeight} ${fitted}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, off.width / 2, off.height / 2);

  const { data } = ctx.getImageData(0, 0, off.width, off.height);
  const pts = [];
  const step = Math.max(2, Math.min(4, Math.round(gap)));
  const base = particleSizeBase || 1.35;

  for (let y = 0; y < off.height; y += step) {
    for (let x = 0; x < off.width; x += step) {
      const i = (y * off.width + x) * 4;
      if (data[i + 3] > 110) {
        pts.push({
          // Tiny jitter only — large scatter made letterforms unreadable
          x: x + (Math.random() - 0.5) * 2.5,
          y: y + (Math.random() - 0.5) * 2.5,
          ox: x,
          oy: y,
          vx: 0,
          vy: 0,
          size: Math.random() * 0.55 + base,
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
  gap = 2,
  particleSize,
  mouseRadius = 46,
  mouseForce = 4.2,
  returnForce = 0.065,
  friction = 0.86,
  maxParticles = 1400,
  idleDrift = true,
  'aria-hidden': ariaHidden,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const particlesRef = useRef([]);
  const rafRef = useRef(0);
  const colorRef = useRef({ r: 255, g: 106, b: 43, a: 0.96 });
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

    /*
     * Touch / coarse: static label only. Continuous canvas + idle drift at
     * 120Hz with hundreds of particles tanks Android WebViews (storefront + POS APKs).
     */
    if (isCoarsePointer()) {
      setFallback(true);
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setFallback(true);
      return undefined;
    }

    setFallback(false);
    const coarse = false;
    let running = false;
    let visible = true;
    let disposed = false;
    let retryTimer = 0;

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
          p.vx += Math.sin(t + p.ox * 0.04) * 0.02;
          p.vy += Math.cos(t * 0.9 + p.oy * 0.04) * 0.02;
        }

        p.vx += (p.ox - p.x) * home;
        p.vy += (p.oy - p.y) * home;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx;
        p.y += p.vy;

        const s = sizeMul || p.size;
        ctx.fillRect(p.x, p.y, s, s);
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    const startLoop = () => {
      if (disposed || running || !visible) return;
      running = true;
      rafRef.current = requestAnimationFrame(drawFrame);
    };

    let lastLayoutKey = '';

    const rebuild = () => {
      if (disposed) return;
      const rect = wrap.getBoundingClientRect();
      const css = getComputedStyle(wrap);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Content-box only — using border-box + padding ratchets height via ResizeObserver
      const padX = (Number.parseFloat(css.paddingLeft) || 0)
        + (Number.parseFloat(css.paddingRight) || 0);
      const padY = (Number.parseFloat(css.paddingTop) || 0)
        + (Number.parseFloat(css.paddingBottom) || 0);
      const borderX = (Number.parseFloat(css.borderLeftWidth) || 0)
        + (Number.parseFloat(css.borderRightWidth) || 0);
      const borderY = (Number.parseFloat(css.borderTopWidth) || 0)
        + (Number.parseFloat(css.borderBottomWidth) || 0);
      let width = Math.max(1, Math.ceil(rect.width - padX - borderX));
      let height = Math.max(1, Math.ceil(rect.height - padY - borderY));

      // Layout not ready yet — retry shortly instead of sampling a tiny canvas
      if (width < MIN_LAYOUT_PX || height < 10) {
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(rebuild, 50);
        return;
      }

      // Prefer measured text width so letterforms never clip horizontally
      const family = css.fontFamily || 'system-ui, sans-serif';
      const weight = fontWeight || css.fontWeight || 700;
      const drawText = css.textTransform === 'uppercase'
        ? label.toUpperCase()
        : css.textTransform === 'lowercase'
          ? label.toLowerCase()
          : label;
      const startSize = fontSizeProp
        || Number.parseFloat(css.fontSize)
        || Math.max(12, Math.min(width * 0.12, height * 0.62));

      const positioned = css.position === 'absolute' || css.position === 'fixed';
      const measure = document.createElement('canvas').getContext('2d');
      if (measure && !positioned) {
        measure.font = `${weight} ${startSize}px ${family}`;
        const needed = Math.ceil(measure.measureText(drawText).width + PAD_X * 2);
        if (needed > width) {
          width = needed;
          // minWidth is border-box; include pad/border so content area stays `needed`
          wrap.style.minWidth = `${needed + padX + borderX}px`;
        }
      }

      // Floor from font only — never grow from measured height (avoids RO feedback loops)
      if (!positioned) {
        const fontBasedH = Math.max(18, Math.ceil(startSize * 1.2));
        if (height < fontBasedH) {
          height = fontBasedH;
          wrap.style.minHeight = `${fontBasedH + padY + borderY}px`;
        }
        // Hard cap: canvas must not expand toward viewport height
        const cssMaxH = Number.parseFloat(css.maxHeight);
        const hardCap = Number.isFinite(cssMaxH) && cssMaxH > 0
          ? Math.max(fontBasedH, Math.ceil(cssMaxH - padY - borderY))
          : Math.max(40, Math.ceil(startSize * 3.25));
        height = Math.min(height, hardCap);
      }

      const layoutKey = `${width}x${height}@${dpr}`;
      if (layoutKey === lastLayoutKey && particlesRef.current.length) {
        return;
      }
      lastLayoutKey = layoutKey;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      // Fill the content box — do not push parent larger than CSS allows
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      colorRef.current = resolveCssColor(
        wrap,
        color || css.color,
        DEFAULT_ORANGE,
      );
      // Floor alpha so particles stay readable on dark backgrounds
      if (colorRef.current.a < 0.85) {
        colorRef.current = { ...colorRef.current, a: 0.92 };
      }
      if (colorRef.current.a < 0.2) {
        colorRef.current = parseColor(DEFAULT_LIGHT, { r: 245, g: 245, b: 247, a: 0.96 });
      }

      // Denser sampling: gap 2–3 (never sparse 8+)
      const densityGap = Math.max(2, Math.min(3, gap + (coarse && width < 120 ? 1 : 0)));
      const particleCap = coarse
        ? Math.min(maxParticles, 900)
        : maxParticles;

      particlesRef.current = sampleTextParticles({
        text: drawText,
        width,
        height,
        fontSize: startSize,
        fontFamily: family,
        fontWeight: weight,
        gap: densityGap,
        maxParticles: particleCap,
        particleSizeBase: particleSize || (width < 140 ? 1.2 : 1.4),
      });

      if (!particlesRef.current.length) {
        setFallback(true);
        stopLoop();
        return;
      }

      setFallback(false);
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
      if (retryTimer) window.clearTimeout(retryTimer);
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('pointerleave', onPointerLeave);
      wrap.removeEventListener('pointercancel', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      particlesRef.current = [];
      wrap.style.minWidth = '';
      wrap.style.minHeight = '';
    };
  }, [label, color, fontSizeProp, fontWeight, gap, maxParticles, particleSize]);

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
