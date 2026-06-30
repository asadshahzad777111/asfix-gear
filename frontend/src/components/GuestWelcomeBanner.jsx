import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

const STORAGE_KEY = 'asfix_guest_welcome_dismissed';

export default function GuestWelcomeBanner() {
  const { isCustomer, loading } = useAuth();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (loading || isCustomer || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="guest-welcome-banner" role="region" aria-label={t('guestWelcome.title')}>
      <div className="guest-welcome-inner">
        <div className="guest-welcome-text">
          <strong>{t('guestWelcome.title')}</strong>
          <p>{t('guestWelcome.subtitle')}</p>
        </div>
        <div className="guest-welcome-actions">
          <Link to="/account/login" className="btn btn-ghost btn-sm">{t('guestWelcome.login')}</Link>
          <Link to="/account/register" className="btn btn-primary btn-sm">{t('guestWelcome.signup')}</Link>
          <button type="button" className="guest-welcome-dismiss" onClick={dismiss} aria-label={t('guestWelcome.dismiss')}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
