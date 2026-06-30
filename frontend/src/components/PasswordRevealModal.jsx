import { useState } from 'react';
import { useTranslation } from '../context/LanguageContext';

export default function PasswordRevealModal({ open, password, title, subtitle, onClose }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!open || !password) return null;

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="password-reveal-backdrop" role="dialog" aria-modal="true">
      <div className="password-reveal-modal glass-card">
        <h3>{title || t('team.passwordModalTitle')}</h3>
        <p className="field-hint">{subtitle || t('team.passwordModalHint')}</p>
        <div className="password-reveal-value">
          <code>{password}</code>
          <button type="button" className="btn btn-outline btn-sm" onClick={copyPassword}>
            {copied ? t('team.copied') : t('team.copyPassword')}
          </button>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          {t('team.passwordModalDone')}
        </button>
      </div>
    </div>
  );
}
