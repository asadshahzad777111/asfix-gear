import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import OtpInput from '../components/OtpInput';
import {
  AuthShell,
  AuthCard,
  AuthBrand,
  AuthHead,
  AuthAlert,
  AuthTabs,
  AuthSteps,
  AuthSubmitButton,
  AuthSecondaryButton,
} from '../components/auth/AuthUI';

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
    <AuthShell>
      <div className="container login-wrap">
        <AuthCard>
          <AuthBrand />
          <AuthHead
            eyebrow={t('account.loginEyebrow')}
            title={t('account.loginTitle')}
            subtitle={t('account.loginSubtitle')}
          />

          <AuthTabs
            layoutId="account-login-tab"
            active={mode}
            onChange={(next) => { setMode(next); setError(''); setOtpStep('request'); }}
            tabs={[
              { id: 'password', label: t('otp.passwordTab') },
              { id: 'otp', label: t('otp.codeTab') },
            ]}
          />

          {mode === 'otp' && (
            <AuthSteps
              step={otpStep === 'request' ? 'start' : 'verify'}
              labelStart={t('otp.loginField')}
              labelVerify={t('otp.enterCode')}
            />
          )}

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit}>
              {error && <AuthAlert type="error">{error}</AuthAlert>}

              <div className="auth-2026-field">
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

              <div className="auth-2026-field">
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

              <AuthSubmitButton submitting={submitting}>
                {submitting ? t('account.signingIn') : t('account.signIn')}
              </AuthSubmitButton>
            </form>
          ) : otpStep === 'request' ? (
            <form onSubmit={handleOtpStart}>
              {error && <AuthAlert type="error">{error}</AuthAlert>}

              <div className="auth-2026-field">
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

              <AuthSubmitButton submitting={submitting}>
                {submitting ? t('otp.sending') : t('otp.sendCode')}
              </AuthSubmitButton>
            </form>
          ) : (
            <form onSubmit={handleOtpVerify}>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              {otpHint && <AuthAlert type="info">{otpHint}</AuthAlert>}
              {devCode && (
                <AuthAlert type="success" center>
                  {t('otp.devCode')}: <strong>{devCode}</strong>
                </AuthAlert>
              )}
              {whatsappLink && (
                <p className="auth-2026-whatsapp-hint">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    {t('otp.openWhatsApp')}
                  </a>
                </p>
              )}

              <div className="auth-2026-field">
                <label>{t('otp.enterCode')}</label>
                <OtpInput value={otp} onChange={setOtp} disabled={submitting} idPrefix="login-otp" />
              </div>

              <AuthSubmitButton submitting={submitting} disabled={otp.length !== 6}>
                {submitting ? t('otp.verifying') : t('account.signIn')}
              </AuthSubmitButton>

              <AuthSecondaryButton
                disabled={submitting}
                onClick={() => { setOtpStep('request'); setOtp(''); setError(''); }}
              >
                {t('otp.back')}
              </AuthSecondaryButton>
            </form>
          )}

          <p className="auth-2026-foot">
            {t('account.noAccount')}{' '}
            <Link to="/account/register">{t('account.createAccount')}</Link>
          </p>
          <p className="auth-2026-foot">
            <Link to="/">{t('login.backToStore')}</Link>
          </p>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
