import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { isStaff } from '../config/permissions';
import {
  AuthShell,
  AuthCard,
  AuthBrand,
  AuthHead,
  AuthAlert,
  AuthSubmitButton,
} from '../components/auth/AuthUI';
import PasswordField from '../components/auth/PasswordField';
import { getPostLoginPath } from '../utils/authRedirect';

/** Dedicated staff login — customers use /account/login or the sign-in modal. */
export default function Login() {
  const { login, logout, user, loading } = useAuth();
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

  if (user) {
    if (isStaff(user)) {
      return <Navigate to={getPostLoginPath(user, from)} replace />;
    }
    return <Navigate to="/account" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const loggedIn = await login(loginValue.trim(), password);
      if (!isStaff(loggedIn)) {
        await logout();
        setError(t('login.customerUseAccountLogin'));
        return;
      }
      navigate(getPostLoginPath(loggedIn, from), { replace: true });
    } catch (err) {
      setError(err.message || t('login.loginFailed'));
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
            eyebrow={t('login.eyebrow')}
            title={t('login.title')}
            subtitle={t('login.subtitle')}
          />

          <form onSubmit={handleSubmit}>
            {error && <AuthAlert type="error">{error}</AuthAlert>}

            <div className="auth-2026-field">
              <label htmlFor="staff-login">{t('login.emailOrUsername')}</label>
              <input
                id="staff-login"
                type="text"
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div className="auth-2026-field">
              <label htmlFor="staff-password">{t('login.password')}</label>
              <PasswordField
                id="staff-password"
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
          </form>

          <p className="auth-2026-foot">
            {t('login.customerPrompt')}{' '}
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
