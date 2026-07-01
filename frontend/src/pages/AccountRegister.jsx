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

export default function AccountRegister() {
  const { isCustomer, user, loading, completeSession } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState('form');
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
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
    return <Navigate to="/account" replace />;
  }

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleStart = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setOtpHint('');
    setWhatsappLink(null);
    setDevCode(null);

    if (!form.username.trim()) {
      setError(t('account.usernameRequired'));
      setSubmitting(false);
      return;
    }

    if (!form.email.trim() && !form.phone.trim()) {
      setError(t('account.emailOrPhoneRequired'));
      setSubmitting(false);
      return;
    }

    try {
      const data = await api.registerStart({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      if (form.email.trim()) {
        setOtpHint(t('otp.sentEmail', { email: form.email.trim() }));
      } else {
        setOtpHint(t('otp.sentPhone'));
      }

      if (data.whatsappLink) setWhatsappLink(data.whatsappLink);
      if (data.devCode) setDevCode(data.devCode);

      setStep('verify');
      setOtp('');
    } catch (err) {
      setError(err.message || t('account.registerFailed'));
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
        phone: form.phone.trim(),
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
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      if (data.devCode) setDevCode(data.devCode);
      if (data.whatsappLink) setWhatsappLink(data.whatsappLink);
      setOtp('');
      setOtpHint(form.email.trim() ? t('otp.sentEmail', { email: form.email.trim() }) : t('otp.sentPhone'));
    } catch (err) {
      setError(err.message || t('otp.sendFailed'));
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
            <form onSubmit={handleStart}>
              {error && <AuthAlert type="error">{error}</AuthAlert>}

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
                <label htmlFor="email">{t('account.gmailOptional')}</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                />
              </div>

              <div className="auth-2026-field">
                <label htmlFor="phone">{t('account.phoneOptional')}</label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="03xx-xxxxxxx"
                  autoComplete="tel"
                />
              </div>

              <p className="auth-2026-field-hint">{t('account.emailOrPhoneHint')}</p>

              <div className="auth-2026-field">
                <label htmlFor="password">{t('login.password')} *</label>
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <div className="auth-2026-field">
                <label htmlFor="confirmPassword">{t('account.confirmPassword')} *</label>
                <input
                  id="confirmPassword"
                  type="password"
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
          ) : (
            <form onSubmit={handleVerify}>
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

          <p className="auth-2026-foot">
            <Link to="/">{t('login.backToStore')}</Link>
          </p>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
