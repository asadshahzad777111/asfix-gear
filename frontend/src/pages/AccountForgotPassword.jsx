import { useEffect, useState } from 'react';
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
  AuthSteps,
  AuthSubmitButton,
  AuthSecondaryButton,
} from '../components/auth/AuthUI';

export default function AccountForgotPassword() {
  const { isCustomer, user, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledLogin = location.state?.login || '';

  const [resetLogin, setResetLogin] = useState(prefilledLogin);
  const [resetStep, setResetStep] = useState('request');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [otpHint, setOtpHint] = useState('');
  const [whatsappLink, setWhatsappLink] = useState(null);
  const [devCode, setDevCode] = useState(null);

  useEffect(() => {
    if (prefilledLogin) setResetLogin(prefilledLogin);
  }, [prefilledLogin]);

  useEffect(() => {
    if (resetStep !== 'verify') return undefined;
    const id = requestAnimationFrame(() => {
      document.querySelector('.auth-2026-card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [resetStep]);

  if (loading) {
    return <div className="loading container">{t('common.loading')}</div>;
  }

  if (user && isCustomer) {
    return <Navigate to="/account" replace />;
  }

  const handleResetStart = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setErrorCode('');
    setOtpHint('');
    setWhatsappLink(null);
    setDevCode(null);

    try {
      const data = await api.passwordResetStart({ login: resetLogin.trim() });
      const loginTrim = resetLogin.trim();
      if (loginTrim.includes('@')) {
        setOtpHint(t('otp.sentEmail', { email: loginTrim }));
      } else {
        setOtpHint(t('otp.sentPhoneWhatsApp'));
      }
      if (data.whatsappLink) setWhatsappLink(data.whatsappLink);
      if (data.devCode) setDevCode(data.devCode);
      setResetStep('verify');
      setResetCode('');
    } catch (err) {
      setError(err.message || t('otp.sendFailed'));
      setErrorCode(err.code || '');
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

  return (
    <AuthShell>
      <div className="container login-wrap">
        <AuthCard>
          <AuthBrand />
          <AuthHead
            eyebrow={t('otp.resetEyebrow')}
            title={t('otp.resetTitle')}
            subtitle={t('otp.resetSubtitle')}
          />

          {!resetDone && (
            <AuthSteps
              step={resetStep === 'request' ? 'start' : 'verify'}
              labelStart={t('otp.loginField')}
              labelVerify={t('otp.resetStepLabel')}
            />
          )}

          {resetDone ? (
            <div className="auth-2026-reset-done">
              <AuthAlert type="success">{t('otp.resetSuccess')}</AuthAlert>
              <AuthSubmitButton type="button" onClick={() => navigate('/account/login', { replace: true })}>
                {t('otp.backToSignIn')}
              </AuthSubmitButton>
            </div>
          ) : resetStep === 'request' ? (
            <form onSubmit={handleResetStart}>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              {errorCode === 'ACCOUNT_NOT_FOUND' && (
                <p className="auth-2026-field-hint">
                  {t('otp.noAccountHint')}{' '}
                  <Link to="/account/register">{t('nav.signUp')}</Link>
                </p>
              )}
              {errorCode === 'STAFF_ACCOUNT' && (
                <p className="auth-2026-field-hint">
                  <Link to="/login">{t('otp.staffLoginLink')}</Link>
                </p>
              )}

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

              <AuthSecondaryButton
                disabled={submitting}
                onClick={() => navigate('/account/login')}
              >
                {t('otp.backToSignIn')}
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
          )}

          <p className="auth-2026-foot">
            {t('account.haveAccount')}{' '}
            <Link to="/account/login">{t('account.signIn')}</Link>
          </p>
          <p className="auth-2026-foot">
            <Link to="/">{t('login.backToStore')}</Link>
          </p>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
