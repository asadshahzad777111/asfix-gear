import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';

export default function ShopLoginPrompt({ open, onClose, onSignIn }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!open) return null;

  const handleSignIn = () => {
    onClose();
    if (onSignIn) {
      onSignIn();
    } else {
      navigate('/account/login');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-panel shop-login-prompt"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('shopAuth.title')}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('nav.closeMenu')}>
          ✕
        </button>
        <span className="shop-login-prompt-icon" aria-hidden="true">🛒</span>
        <h2>{t('shopAuth.title')}</h2>
        <p className="shop-login-prompt-message">{t('shopAuth.message')}</p>
        <div className="shop-login-prompt-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={handleSignIn}>
            {t('nav.signIn')}
          </button>
          <Link to="/account/register" className="btn btn-outline btn-block" onClick={onClose}>
            {t('nav.signUp')}
          </Link>
        </div>
      </div>
    </div>
  );
}
