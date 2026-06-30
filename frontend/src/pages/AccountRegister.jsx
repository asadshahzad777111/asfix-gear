import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';

export default function AccountRegister() {
  const { register, isCustomer, user, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return <div className="loading container">{t('common.loading')}</div>;
  }

  if (user && isCustomer) {
    return <Navigate to="/account" replace />;
  }

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

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
      await register({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err.message || t('account.registerFailed'));
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

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container login-wrap">
          <form className="glass-card login-form" onSubmit={handleSubmit}>
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
              {submitting ? t('account.creating') : t('account.createAccount')}
            </button>

            <p className="login-foot">
              {t('account.haveAccount')}{' '}
              <Link to="/account/login">{t('account.signIn')}</Link>
            </p>
            <p className="login-foot">
              <Link to="/">{t('login.backToStore')}</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
