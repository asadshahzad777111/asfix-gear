import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';

export default function AccountLogin() {
  const { login, isCustomer, isStaff, user, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/account';

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return <div className="loading container">{t('common.loading')}</div>;
  }

  if (user && isCustomer) {
    return <Navigate to={from} replace />;
  }

  if (user && isStaff) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e) => {
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

  return (
    <>
      <PageHeader
        eyebrow={t('account.loginEyebrow')}
        title={t('account.loginTitle')}
        subtitle={t('account.loginSubtitle')}
      />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container login-wrap">
          <form className="glass-card login-form" onSubmit={handleSubmit}>
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

            <p className="login-foot">
              {t('account.noAccount')}{' '}
              <Link to="/account/register">{t('account.createAccount')}</Link>
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
