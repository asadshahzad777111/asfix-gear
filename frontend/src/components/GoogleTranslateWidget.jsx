import { useEffect, useId, useRef } from 'react';
import { useTranslation } from '../context/LanguageContext';

const SCRIPT_ID = 'google-translate-script';
const CALLBACK_NAME = 'googleTranslateElementInit';
const pendingInits = [];

function runPendingInits() {
  while (pendingInits.length) {
    const init = pendingInits.shift();
    init();
  }
}

/**
 * Optional "translate to any language" widget on top of our built-in
 * English/Roman Urdu toggle — for the rare visitor who wants French,
 * Chinese, Arabic, etc. Loads Google's website-translate script lazily
 * and only once, and is fully independent of our own i18n system.
 * Can be rendered more than once on a page (desktop toolbar + mobile
 * drawer), each gets its own DOM id so Google's widget mounts cleanly.
 */
export default function GoogleTranslateWidget({ className = '' }) {
  const { t } = useTranslation();
  const hostRef = useRef(null);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const elementId = `google_translate_element_${rawId}`;

  useEffect(() => {
    const init = () => {
      if (!hostRef.current || hostRef.current.childElementCount > 0) return;
      if (!window.google?.translate?.TranslateElement) return;
      // eslint-disable-next-line no-new
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          autoDisplay: false,
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        },
        elementId
      );
    };

    if (window.google?.translate?.TranslateElement) {
      init();
      return;
    }

    pendingInits.push(init);
    window[CALLBACK_NAME] = runPendingInits;

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = `https://translate.google.com/translate_a/element.js?cb=${CALLBACK_NAME}`;
      script.async = true;
      document.body.appendChild(script);
    }
  }, [elementId]);

  return (
    <div className={`gtranslate-wrap ${className}`.trim()} title={t('nav.translatePage')}>
      <span className="gtranslate-icon" aria-hidden="true">🌍</span>
      <div id={elementId} ref={hostRef} className="notranslate" />
    </div>
  );
}
