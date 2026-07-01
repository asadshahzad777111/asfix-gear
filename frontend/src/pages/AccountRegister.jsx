import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';
import OtpInput from '../components/OtpInput';

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
    <>
      <PageHeader
        eyebrow={t('account.registerEyebrow')}
        title={t('account.registerTitle')}
        subtitle={t('account.registerSubtitle')}
      />

      <section className="section auth-section">
        <div className="container login-wrap">
          {step === 'form' ? (
            <form className="glass-card login-form" onSubmit={handleStart}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label htmlFor="name">{t('contact.name')} *</label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
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
                <p className="form-hint">{t('account.usernameHint')}</p>
              </div>

              <div className="form-group">
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

              <div className="form-group">
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

              <p className="form-hint">{t('account.emailOrPhoneHint')}</p>

              <div className="form-group">
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

              <div className="form-group">
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

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? t('otp.sending') : t('otp.sendCode')}
              </button>

              <p className="login-foot">
                {t('account.haveAccount')}{' '}
                <Link to="/account/login">{t('account.signIn')}</Link>
              </p>
            </form>
          ) : (
            <form className="glass-card login-form" onSubmit={handleVerify}>
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
                <OtpInput value={otp} onChange={setOtp} disabled={submitting} idPrefix="reg-otp" />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting || otp.length !== 6}>
                {submitting ? t('otp.verifying') : t('account.createAccount')}
              </button>

              <button
                type="button"
                className="btn btn-outline btn-block"
                disabled={submitting}
                onClick={handleResend}
              >
                {submitting ? t('otp.sending') : t('otp.resend')}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-block"
                disabled={submitting}
                onClick={() => { setStep('form'); setOtp(''); setError(''); }}
              >
                {t('otp.back')}
              </button>
            </form>
          )}

          <p className="login-foot" style={{ marginTop: '1rem' }}>
            <Link to="/">{t('login.backToStore')}</Link>
          </p>
        </div>
      </section>
    </>
  );
}
