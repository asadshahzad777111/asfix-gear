import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { LANGS, LANG_LABELS, LANG_SHORT } from '../locales/translations';

export default function LanguageToggle({ className = '' }) {
  const { lang, setLang, t } = useLanguage();
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startLang: lang });
  const [pill, setPill] = useState({ left: 0, width: 0 });

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
