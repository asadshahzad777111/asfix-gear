import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
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
import PasswordField from '../components/auth/PasswordField';
import { AuthGoogleSection } from '../components/auth/GoogleSignIn';
import { getPostLoginPath } from '../utils/authRedirect';

export default function AccountRegister() {
  const { isCustomer, isStaff, user, loading, completeSession } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState('form');
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [otpHint, setOtpHint] = useState('');
  const [devCode, setDevCode] = useState(null);

  if (loading) {
    return <div className="loading container">{t('common.loading')}</div>;
  }

  if (user && isStaff) {
    return <Navigate to={getPostLoginPath(user)} replace />;
  }

  if (user && isCustomer) {
    return <Navigate to="/account" replace />;
  }

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleStart = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setOtpHint('');
    setDevCode(null);

    if (!form.username.trim()) {
      setError(t('account.usernameRequired'));
      setSubmitting(false);
      return;
    }

    if (!form.email.trim()) {
      setError(t('account.gmailRequired'));
      setSubmitting(false);
      return;
    }

    if (!/^[a-z0-9._%+.-]+@gmail\.com$/i.test(form.email.trim())) {
      setError(t('otp.invalidGmail'));
      setSubmitting(false);
      return;
    }

    try {
      const data = await api.registerStart({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      setOtpHint(t('otp.sentEmail', { email: form.email.trim() }));
      if (data.devCode) setDevCode(data.devCode);

      setStep('verify');
      setOtp('');
    } catch (err) {
      setError(err.message || t('otp.sendFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (otp.length !== 6) {
      setError(t('otp.codeRequired'));
      setSubmitting(false);
      return;
    }

    try {
      const data = await api.registerVerify({
        code: otp,
        email: form.email.trim(),
      });
      await completeSession(data);
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err.message || t('otp.verifyFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data = await api.registerStart({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      if (data.devCode) setDevCode(data.devCode);
      setOtp('');
      setOtpHint(t('otp.sentEmail', { email: form.email.trim() }));
    } catch (err) {
      setError(err.message || t('otp.sendFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setSubmitting(true);
    setError('');
    try {
      const data = await api.googleSignIn({ credential });
      await completeSession(data);
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err.message || t('auth.googleSignInFailed'));
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
            eyebrow={t('account.registerEyebrow')}
            title={t('account.registerTitle')}
            subtitle={t('account.registerSubtitle')}
          />

          <AuthSteps
            step={step === 'form' ? 'start' : 'verify'}
            labelStart={t('account.createAccount')}
            labelVerify={t('otp.enterCode')}
          />

          {step === 'form' ? (
            <>
              <AuthGoogleSection
                onCredential={handleGoogleCredential}
                disabled={submitting}
                submitting={submitting}
                buttonText="signup_with"
              />
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              <form onSubmit={handleStart}>
              <div className="auth-2026-field">
                <label htmlFor="name">{t('contact.name')} *</label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="auth-2026-field">
                <label htmlFor="username">{t('account.username')} *</label>
                <input
                  id="username"
                  value={form.username}
                  onChange={(e) => setField('username', e.target.value.toLowerCase())}
                  placeholder={t('account.usernamePlaceholder')}
                  autoComplete="username"
                  minLength={3}
                  maxLength={30}
                  pattern="[a-z0-9_]+"
                  required
                />
                <p className="auth-2026-field-hint">{t('account.usernameHint')}</p>
              </div>

              <div className="auth-2026-field">
                <label htmlFor="email">{t('account.gmailLabel')} *</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-2026-field">
                <label htmlFor="password">{t('login.password')} *</label>
                <PasswordField
                  id="password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <div className="auth-2026-field">
                <label htmlFor="confirmPassword">{t('account.confirmPassword')} *</label>
                <PasswordField
                  id="confirmPassword"
                  value={form.confirmPassword}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <AuthSubmitButton submitting={submitting}>
                {submitting ? t('otp.sending') : t('otp.sendCode')}
              </AuthSubmitButton>

              <p className="auth-2026-foot">
                {t('account.haveAccount')}{' '}
                <Link to="/account/login">{t('account.signIn')}</Link>
              </p>
            </form>
            </>
          ) : (
            <form onSubmit={handleVerify}>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              {otpHint && <AuthAlert type="info">{otpHint}</AuthAlert>}
              {devCode && (
                <AuthAlert type="success" center>
                  {t('otp.devCode')}: <strong>{devCode}</strong>
                </AuthAlert>
              )}
              <div className="auth-2026-field">
                <label>{t('otp.enterCode')}</label>
                <OtpInput value={otp} onChange={setOtp} disabled={submitting} idPrefix="reg-otp" />
              </div>

              <AuthSubmitButton submitting={submitting} disabled={otp.length !== 6}>
                {submitting ? t('otp.verifying') : t('account.createAccount')}
              </AuthSubmitButton>

              <AuthSecondaryButton disabled={submitting} onClick={handleResend}>
                {submitting ? t('otp.sending') : t('otp.resend')}
              </AuthSecondaryButton>

              <AuthSecondaryButton
                disabled={submitting}
                onClick={() => { setStep('form'); setOtp(''); setError(''); }}
              >
                {t('otp.back')}
              </AuthSecondaryButton>
            </form>
          )}

        </AuthCard>
      </div>
    </AuthShell>
  );
}
