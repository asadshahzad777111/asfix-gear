import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { isStaff as checkStaff, isCustomer as checkCustomer } from '../config/permissions';
import {
  AuthShell,
  AuthCard,
  AuthBrand,
  AuthHead,
  AuthAlert,
  AuthSubmitButton,
} from '../components/auth/AuthUI';

export default function Login() {
  const { login, isStaff, user, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/admin';

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return <div className="loading container">{t('common.loading')}</div>;
  }

  if (user && isStaff) {
    return <Navigate to={from} replace />;
  }

  if (user && checkCustomer(user)) {
    return <Navigate to="/account" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const loggedIn = await login(loginValue.trim(), password);
      if (checkStaff(loggedIn)) {
        navigate(from, { replace: true });
      } else if (checkCustomer(loggedIn)) {
        navigate('/account', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message || t('login.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="container login-wrap">
        <AuthCard staff>
          <AuthBrand />
          <AuthHead
            eyebrow={t('login.eyebrow')}
            title={t('login.title')}
            subtitle={t('login.subtitle')}
          />

          <form onSubmit={handleSubmit}>
            {error && <AuthAlert type="error">{error}</AuthAlert>}

            <div className="auth-2026-field">
              <label htmlFor="login">{t('team.gmail')}</label>
              <input
                id="login"
                type="text"
                inputMode="email"
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                placeholder="staff@gmail.com"
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
              {submitting ? t('login.signingIn') : t('login.signIn')}
            </AuthSubmitButton>

            <p className="auth-2026-foot">
              <Link to="/account/login">{t('nav.accountLogin')}</Link>
            </p>
            <p className="auth-2026-foot">
              <Link to="/">{t('login.backToStore')}</Link>
            </p>
          </form>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
