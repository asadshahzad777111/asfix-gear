import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import OtpInput from './OtpInput';

export default function CustomerLoginModal({ open, onClose }) {
  const { login, isCustomer, isStaff, user, completeSession, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [mode, setMode] = useState('password');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [otpStep, setOtpStep] = useState('request');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [otpHint, setOtpHint] = useState('');
  const [whatsappLink, setWhatsappLink] = useState(null);
  const [devCode, setDevCode] = useState(null);

  if (!open) return null;

  const handleClose = () => {
    setError('');
    setPassword('');
    setOtp('');
    setOtpStep('request');
    setMode('password');
    onClose();
  };

  const handlePasswordSubmit = async (e) => {
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

  const handleOtpStart = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setOtpHint('');
    setWhatsappLink(null);
    setDevCode(null);

    try {
      const data = await api.loginOtpStart({ login: loginValue.trim() });
      setOtpHint(t('otp.sentLogin'));
      if (data.whatsappLink) setWhatsappLink(data.whatsappLink);
      if (data.devCode) setDevCode(data.devCode);
      setOtpStep('verify');
      setOtp('');
    } catch (err) {
      setError(err.message || t('otp.sendFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (otp.length !== 6) {
      setError(t('otp.codeRequired'));
      setSubmitting(false);
      return;
    }

    try {
      const data = await api.loginOtpVerify({ login: loginValue.trim(), code: otp });
      await completeSession(data);
      setLoginValue('');
      setOtp('');
      handleClose();
      navigate('/account');
    } catch (err) {
      setError(err.message || t('otp.verifyFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (user && isCustomer) {
    const handleLogout = async () => {
      handleClose();
      await logout();
      navigate('/');
    };

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
          <Link to="/account/settings" className="btn btn-ghost btn-block" onClick={handleClose}>
            {t('nav.settings')}
          </Link>
          <button type="button" className="btn btn-ghost btn-block settings-logout" onClick={handleLogout}>
            {t('account.logout')}
          </button>
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

        <div className="login-tabs login-tabs--modal">
          <button
            type="button"
            className={mode === 'password' ? 'active' : ''}
            onClick={() => { setMode('password'); setError(''); }}
          >
            {t('otp.passwordTab')}
          </button>
          <button
            type="button"
            className={mode === 'otp' ? 'active' : ''}
            onClick={() => { setMode('otp'); setError(''); setOtpStep('request'); }}
          >
            {t('otp.codeTab')}
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={handlePasswordSubmit}>
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
        ) : otpStep === 'request' ? (
          <form onSubmit={handleOtpStart}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="modal-otp-login">{t('otp.loginField')}</label>
              <input
                id="modal-otp-login"
                type="text"
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                placeholder={t('otp.loginPlaceholder')}
                required
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? t('otp.sending') : t('otp.sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpVerify}>
            {error && <div className="alert alert-error">{error}</div>}
            {otpHint && <div className="alert alert-info">{otpHint}</div>}
            {devCode && (
              <div className="alert alert-info otp-dev-code">
                {t('otp.devCode')}: <strong>{devCode}</strong>
              </div>
            )}
            {whatsappLink && (
              <p className="form-hint">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  {t('otp.openWhatsApp')}
                </a>
              </p>
            )}

            <div className="form-group">
              <label>{t('otp.enterCode')}</label>
              <OtpInput value={otp} onChange={setOtp} disabled={submitting} idPrefix="modal-otp" />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting || otp.length !== 6}>
              {submitting ? t('otp.verifying') : t('account.signIn')}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-block"
              disabled={submitting}
              onClick={() => { setOtpStep('request'); setOtp(''); setError(''); }}
            >
              {t('otp.back')}
            </button>
          </form>
        )}

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
