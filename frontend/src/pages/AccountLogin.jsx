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

  const [resetLogin, setResetLogin] = useState('');
  const [resetStep, setResetStep] = useState('request');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetDone, setResetDone] = useState(false);

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

  const openForgotPassword = () => {
    setMode('reset');
    setError('');
    setResetStep('request');
    setResetLogin(loginValue.trim());
    setResetCode('');
    setResetPassword('');
    setResetConfirm('');
    setResetDone(false);
    setOtpHint('');
    setWhatsappLink(null);
    setDevCode(null);
  };

  const handleResetStart = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setOtpHint('');
    setWhatsappLink(null);
    setDevCode(null);

    try {
      const data = await api.passwordResetStart({ login: resetLogin.trim() });
      setOtpHint(t('otp.sentReset'));
      if (data.whatsappLink) setWhatsappLink(data.whatsappLink);
      if (data.devCode) setDevCode(data.devCode);
      setResetStep('verify');
      setResetCode('');
    } catch (err) {
      setError(err.message || t('otp.sendFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetVerify = async (e) => {
    e.preventDefault();
    setError('');

    if (resetCode.length !== 6) {
      setError(t('otp.codeRequired'));
      return;
    }
    if (resetPassword.length < 6) {
      setError(t('otp.passwordTooShort'));
      return;
    }
    if (resetPassword !== resetConfirm) {
      setError(t('otp.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await api.passwordResetVerify({
        login: resetLogin.trim(),
        code: resetCode,
        newPassword: resetPassword,
        confirmPassword: resetConfirm,
      });
      setResetDone(true);
    } catch (err) {
      setError(err.message || t('otp.verifyFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const backToSignIn = () => {
    setMode('password');
    setError('');
    setPassword('');
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
      await finishLogin(data);
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

          {mode !== 'reset' && (
            <AuthTabs
              layoutId="account-login-tab"
              active={mode}
              onChange={(next) => { setMode(next); setError(''); setOtpStep('request'); }}
              tabs={[
                { id: 'password', label: t('otp.passwordTab') },
                { id: 'otp', label: t('otp.codeTab') },
              ]}
            />
          )}

          {mode === 'otp' && (
            <AuthSteps
              step={otpStep === 'request' ? 'start' : 'verify'}
              labelStart={t('otp.loginField')}
              labelVerify={t('otp.enterCode')}
            />
          )}

          {mode === 'reset' && !resetDone && (
            <AuthSteps
              step={resetStep === 'request' ? 'start' : 'verify'}
              labelStart={t('otp.loginField')}
              labelVerify={t('otp.resetStepLabel')}
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

              <button type="button" className="auth-2026-forgot-link" onClick={openForgotPassword}>
                {t('otp.forgotPassword')}
              </button>
            </form>
          ) : mode === 'reset' ? (
            resetDone ? (
              <div className="auth-2026-reset-done">
                <AuthAlert type="success">{t('otp.resetSuccess')}</AuthAlert>
                <AuthSubmitButton onClick={backToSignIn} type="button">
                  {t('otp.backToSignIn')}
                </AuthSubmitButton>
              </div>
            ) : resetStep === 'request' ? (
              <form onSubmit={handleResetStart}>
                {error && <AuthAlert type="error">{error}</AuthAlert>}

                <div className="auth-2026-field">
                  <label htmlFor="reset-login">{t('otp.loginField')}</label>
                  <input
                    id="reset-login"
                    type="text"
                    value={resetLogin}
                    onChange={(e) => setResetLogin(e.target.value)}
                    placeholder={t('otp.loginPlaceholder')}
                    required
                    autoFocus
                  />
                </div>

                <AuthSubmitButton submitting={submitting}>
                  {submitting ? t('otp.sending') : t('otp.sendCode')}
                </AuthSubmitButton>

                <AuthSecondaryButton disabled={submitting} onClick={backToSignIn}>
                  {t('otp.back')}
                </AuthSecondaryButton>
              </form>
            ) : (
              <form onSubmit={handleResetVerify}>
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
                  <OtpInput value={resetCode} onChange={setResetCode} disabled={submitting} idPrefix="reset-otp" />
                </div>

                <div className="auth-2026-field">
                  <label htmlFor="reset-new-password">{t('otp.newPassword')}</label>
                  <input
                    id="reset-new-password"
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder={t('login.passwordPlaceholder')}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="auth-2026-field">
                  <label htmlFor="reset-confirm-password">{t('otp.confirmNewPassword')}</label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    placeholder={t('login.passwordPlaceholder')}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <AuthSubmitButton submitting={submitting} disabled={resetCode.length !== 6}>
                  {submitting ? t('otp.verifying') : t('otp.resetSubmit')}
                </AuthSubmitButton>

                <AuthSecondaryButton
                  disabled={submitting}
                  onClick={() => { setResetStep('request'); setResetCode(''); setError(''); }}
                >
                  {t('otp.back')}
                </AuthSecondaryButton>
              </form>
            )
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
