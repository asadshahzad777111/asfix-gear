import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './section-scroll-strap.css';

/**
 * Thin section title strap under header / AS FIX & GEAR slimline.
 * Updates as you cross each marked section (data-section-strap), with
 * up/down swap animation matching scroll direction.
 */
export default function SectionScrollStrap() {
  const { pathname } = useLocation();
  const [label, setLabel] = useState('');
  const [visible, setVisible] = useState(false);
  const [dir, setDir] = useState('down');
  const [underSlim, setUnderSlim] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const lastLabelRef = useRef('');
  const lastIndexRef = useRef(-1);
  const rafRef = useRef(0);

  useEffect(() => {
    lastLabelRef.current = '';
    lastIndexRef.current = -1;
    setLabel('');
    setVisible(false);
  }, [pathname]);

  useEffect(() => {
    const measure = () => {
      const slim = document.querySelector('.dx-slimline');
      const slimOn = !!(slim && slim.classList.contains('is-visible'));
      setUnderSlim(slimOn);

      const header = document.querySelector('header.navbar.navbar--dx');
      const headerH = slimOn
        ? 0
        : Math.round(header?.getBoundingClientRect().height || 72);
      const slimH = slimOn
        ? Math.round(slim.getBoundingClientRect().height || 36)
        : 0;
      document.documentElement.style.setProperty('--section-strap-offset', `${headerH + slimH}px`);
    };

    measure();
    const mo = new MutationObserver(measure);
    const slim = document.querySelector('.dx-slimline');
    const header = document.querySelector('header.navbar.navbar--dx');
    if (slim) mo.observe(slim, { attributes: true, attributeFilter: ['class'] });
    if (header) mo.observe(header, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      mo.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [pathname]);

  useEffect(() => {
    const update = () => {
      const nodes = Array.from(document.querySelectorAll('[data-section-strap]'));
      if (!nodes.length) {
        setVisible(false);
        lastLabelRef.current = '';
        lastIndexRef.current = -1;
        return;
      }

      const slim = document.querySelector('.dx-slimline');
      const slimOn = !!(slim && slim.classList.contains('is-visible'));
      const header = document.querySelector('header.navbar.navbar--dx');
      const stickyBottom = slimOn
        ? (slim?.getBoundingClientRect().bottom || 36)
        : (header?.getBoundingClientRect().bottom || 72);
      /* Activate when section top crosses just under sticky chrome */
      const line = stickyBottom + 10;

      let activeIndex = -1;
      for (let i = 0; i < nodes.length; i += 1) {
        const top = nodes[i].getBoundingClientRect().top;
        if (top <= line) activeIndex = i;
      }

      /* Near page top / hero — hide until first section is crossed */
      if (activeIndex < 0) {
        setVisible(false);
        lastLabelRef.current = '';
        lastIndexRef.current = -1;
        return;
      }

      const next = String(nodes[activeIndex].getAttribute('data-section-strap') || '').trim();
      if (!next) {
        setVisible(false);
        return;
      }

      if (next !== lastLabelRef.current) {
        const prev = lastIndexRef.current;
        if (prev >= 0) {
          setDir(activeIndex >= prev ? 'down' : 'up');
        } else {
          setDir('down');
        }
        lastLabelRef.current = next;
        lastIndexRef.current = activeIndex;
        setLabel(next);
        setAnimKey((k) => k + 1);
      } else {
        lastIndexRef.current = activeIndex;
      }
      setVisible(true);
    };

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    const t = window.setTimeout(update, 120);
    const t2 = window.setTimeout(update, 400);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.clearTimeout(t);
      window.clearTimeout(t2);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pathname]);

  if (!visible || !label) return null;

  return (
    <div
      className={`dx-section-strap${underSlim ? ' is-under-slim' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="dx-section-strap__bar">
        <span key={animKey} className={`dx-section-strap__text is-${dir}`}>
          {label}
        </span>
        <span className="dx-section-strap__ember" aria-hidden="true" />
      </div>
    </div>
  );
}
