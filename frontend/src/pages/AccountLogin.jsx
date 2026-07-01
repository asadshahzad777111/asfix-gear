import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';
import OtpInput from '../components/OtpInput';

export default function AccountLogin() {
  const { login, isCustomer, isStaff, user, loading, completeSession } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/account';

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

  if (loading) {
    return <div className="loading container">{t('common.loading')}</div>;
  }

  if (user && isCustomer) {
    return <Navigate to={from} replace />;
  }

  if (user && isStaff) {
    return <Navigate to="/admin" replace />;
  }

  const finishLogin = async (data) => {
    await completeSession(data);
    navigate(from, { replace: true });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const loggedIn = await login(loginValue.trim(), password);
      if (loggedIn.role === 'customer') {
        navigate(from, { replace: true });
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
      finishLogin(data);
    } catch (err) {
      setError(err.message || t('otp.verifyFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={t('account.loginEyebrow')}
        title={t('account.loginTitle')}
        subtitle={t('account.loginSubtitle')}
      />

      <section className="section auth-section">
        <div className="container login-wrap">
          <div className="login-tabs">
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
            <form className="glass-card login-form" onSubmit={handlePasswordSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label htmlFor="login">{t('account.loginField')}</label>
                <input
                  id="login"
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
                <label htmlFor="password">{t('login.password')}</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? t('account.signingIn') : t('account.signIn')}
              </button>
            </form>
          ) : otpStep === 'request' ? (
            <form className="glass-card login-form" onSubmit={handleOtpStart}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label htmlFor="otp-login">{t('otp.loginField')}</label>
                <input
                  id="otp-login"
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
            <form className="glass-card login-form" onSubmit={handleOtpVerify}>
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
                <OtpInput value={otp} onChange={setOtp} disabled={submitting} idPrefix="login-otp" />
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
            <Link to="/account/register">{t('account.createAccount')}</Link>
          </p>
          <p className="login-foot">
            <Link to="/">{t('login.backToStore')}</Link>
          </p>
        </div>
      </section>
    </>
  );
}
