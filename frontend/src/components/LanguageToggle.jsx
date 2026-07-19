import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { LANGS, LANG_LABELS, LANG_SHORT } from '../locales/translations';

function IconGlobe({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5S14.4 17.9 12 20.5C9.6 17.9 8.4 15.1 8.4 12S9.6 6.1 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LanguageToggle({ className = '' }) {
  const { lang, setLang, t } = useLanguage();
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startLang: lang });
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const activeIndex = Math.max(0, LANGS.indexOf(lang));

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const measure = () => {
      const btn = track.querySelector(`[data-lang="${lang}"]`);
      if (!btn) return;
      const trackBox = track.getBoundingClientRect();
      const btnBox = btn.getBoundingClientRect();
      setPill({
        left: btnBox.left - trackBox.left,
        width: btnBox.width,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [lang]);

  const onPointerDown = (e) => {
    dragRef.current = { active: true, startX: e.clientX, startLang: lang };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerUp = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.active = false;
    if (Math.abs(dx) < 28) return;
    const idx = LANGS.indexOf(dragRef.current.startLang);
    if (dx < 0 && idx < LANGS.length - 1) setLang(LANGS[idx + 1]);
    if (dx > 0 && idx > 0) setLang(LANGS[idx - 1]);
  };

  return (
    <div
      className={`lang-world ${className}`.trim()}
      role="group"
      aria-label={t('lang.label')}
    >
      <span className="lang-world-globe" title={t('lang.label')} aria-hidden="true">
        <IconGlobe />
      </span>

      <div
        className="lang-world-track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current.active = false;
        }}
      >
        <span
          className="lang-world-pill"
          style={{
            transform: `translateX(${pill.left}px)`,
            width: pill.width || undefined,
            opacity: pill.width ? 1 : 0,
          }}
          aria-hidden="true"
        />
        {LANGS.map((code) => (
          <button
            key={code}
            type="button"
            data-lang={code}
            className={`lang-world-btn${lang === code ? ' is-active' : ''}`}
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            title={LANG_LABELS[code]}
          >
            <span className="lang-world-short">{LANG_SHORT[code]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
