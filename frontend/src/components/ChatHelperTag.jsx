import { useEffect, useState } from 'react';
import { useTranslation } from '../context/LanguageContext';

const LINE_KEYS = ['a', 'b', 'c', 'd', 'e'];

/**
 * Thin straight ticker — cycles unique help lines with a soft fade/slide.
 */
export default function ChatHelperTag({ className = '' }) {
  const { t } = useTranslation();
  const lines = LINE_KEYS.map((key) => t(`chatbot.helpLines.${key}`));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('in'); // in | out

  useEffect(() => {
    if (lines.length < 2) return undefined;

    let outTimer;
    const cycle = window.setInterval(() => {
      setPhase('out');
      outTimer = window.setTimeout(() => {
        setIndex((i) => (i + 1) % lines.length);
        setPhase('in');
      }, 320);
    }, 2800);

    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(outTimer);
    };
  }, [lines.length]);

  const text = lines[index] || t('chatbot.helpTab');

  return (
    <span className={`chat-helper__tag ${className}`.trim()} aria-hidden="true">
      <span className="chat-helper__tag-rail" />
      <span className={`chat-helper__tag-line is-${phase}`}>
        {text}
      </span>
    </span>
  );
}
