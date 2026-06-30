import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

export default function CustomerLoginModal({ open, onClose }) {
  const { login, isCustomer, isStaff, user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleClose = () => {
    setError('');
    setPassword('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const loggedIn = await login(loginValue.trim(), password);
      if (loggedIn.role === 'customer') {
        setLoginValue('');
        setPassword('');
        handleClose();
        navigate('/account');
      } else {
        setError(t('account.staffUseAdminLogin'));
      }
    } catch (err) {
      setError(err.message || t('account.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (user && isCustomer) {
    return (
      <div className="modal-overlay" onClick={handleClose} role="presentation">
        <div
          className="modal-panel customer-login-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('account.loginTitle')}
        >
          <button type="button" className="modal-close" onClick={handleClose} aria-label={t('nav.closeMenu')}>
            ✕
          </button>
          <h2>{t('account.title')}</h2>
          <p>{t('account.welcome')}, {user.name || user.username}</p>
          <Link to="/account" className="btn btn-primary btn-block" onClick={handleClose}>
            {t('nav.myAccount')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleClose} role="presentation">
      <div
        className="modal-panel customer-login-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('account.loginTitle')}
      >
        <button type="button" className="modal-close" onClick={handleClose} aria-label={t('nav.closeMenu')}>
          ✕
        </button>

        <h2>{t('account.loginTitle')}</h2>
        <p className="customer-login-modal-sub">{t('account.loginSubtitle')}</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="modal-login">{t('account.loginField')}</label>
            <input
              id="modal-login"
              type="text"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              placeholder={t('account.loginPlaceholder')}
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="modal-password">{t('login.password')}</label>
            <input
              id="modal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? t('account.signingIn') : t('account.signIn')}
          </button>
        </form>

        <p className="login-foot">
          {t('account.noAccount')}{' '}
          <Link to="/account/register" onClick={handleClose}>
            {t('account.createAccount')}
          </Link>
        </p>

        {isStaff && (
          <p className="login-foot">
            <Link to="/login" onClick={handleClose}>{t('nav.admin')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
