import { useLanguage } from '../context/LanguageContext';

import { LANGS, LANG_LABELS } from '../locales/translations';

export default function LanguageToggle({ className = '' }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className={`lang-toggle ${className}`.trim()} role="group" aria-label={t('lang.label')}>
      <span className="lang-toggle-globe" aria-hidden="true">🌐</span>
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-toggle-btn ${lang === code ? 'active' : ''}`}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          title={LANG_LABELS[code]}
        >
          {LANG_LABELS[code]}
        </button>
      ))}
    </div>
  );
}

