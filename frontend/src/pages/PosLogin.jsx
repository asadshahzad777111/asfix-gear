import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canUsePos, isCustomer } from '../config/permissions';
import {
  AuthAlert,
  AuthBrand,
  AuthCard,
  AuthSubmitButton,
} from '../components/auth/AuthUI';
import PasswordField from '../components/auth/PasswordField';
import '../pos-login.css';

export default function PosLogin() {
  const { login, logout, user, loading } = useAuth();
  const navigate = useNavigate();

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return <div className="loading container">Loading POS...</div>;
  }

  if (user) {
    if (canUsePos(user)) return <Navigate to="/pos" replace />;
    if (isCustomer(user)) return <Navigate to="/account" replace />;
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const loggedIn = await login(loginValue.trim(), password);
      if (!canUsePos(loggedIn)) {
        await logout();
        setError('This login is not allowed for POS billing.');
        return;
      }
      navigate('/pos', { replace: true });
    } catch (err) {
      setError(err.message || 'POS login failed. Check username and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pos-login-shell">
      <div className="pos-login-panel">
        <div className="pos-login-copy">
          <span className="pos-login-kicker">Restricted billing route</span>
          <h1>AsFix POS Billing</h1>
          <p>Fast counter checkout for walk-in sales. POS Staff can bill, print receipts, and see only today&apos;s own sales.</p>
          <ul>
            <li>Search products</li>
            <li>Confirm paid sale</li>
            <li>Print receipt</li>
          </ul>
        </div>

        <AuthCard className="pos-login-card" staff>
          <AuthBrand size={44} />
          <div className="pos-login-head">
            <span>POS Staff Login</span>
            <h2>Open billing desk</h2>
            <p>Use the POS username or Gmail and password created by Super Admin.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <AuthAlert type="error">{error}</AuthAlert>}

            <div className="auth-2026-field">
              <label htmlFor="pos-login">Username or Gmail</label>
              <input
                id="pos-login"
                type="text"
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                placeholder="pos_staff@gmail.com"
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div className="auth-2026-field">
              <label htmlFor="pos-password">Password</label>
              <PasswordField
                id="pos-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="POS password"
                autoComplete="current-password"
                required
              />
            </div>

            <AuthSubmitButton submitting={submitting}>
              {submitting ? 'Opening POS...' : 'Open POS'}
            </AuthSubmitButton>
          </form>

          <p className="pos-login-foot">
            Admin access? <Link to="/login">Use main staff login</Link>
          </p>
        </AuthCard>
      </div>
    </section>
  );
}
