import { useState } from 'react';

import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import { canManageTeam, roleLabel } from '../config/permissions';

import { useTranslation } from '../context/LanguageContext';

import { SHOP } from '../config/shop';



export default function StaffAccessPanel() {

  const { user, isStaff, login, logout } = useAuth();

  const { t } = useTranslation();

  const [open, setOpen] = useState(false);

  const [loginValue, setLoginValue] = useState('');

  const [password, setPassword] = useState('');

  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [loginError, setLoginError] = useState('');



  const isSuperAdmin = canManageTeam(user);



  const handleLogin = async (e) => {

    e.preventDefault();

    setLoginSubmitting(true);

    setLoginError('');



    try {

      await login(loginValue.trim(), password);

      setPassword('');

    } catch (err) {

      setLoginError(err.message || t('staffForm.loginFailed'));

    } finally {

      setLoginSubmitting(false);

    }

  };



  const handleLogout = async () => {

    await logout();

    setLoginValue('');

    setPassword('');

  };



  return (

    <div className={`staff-access ${open ? 'is-open' : ''}`}>

      <button

        type="button"

        className="staff-access-trigger"

        onClick={() => setOpen((v) => !v)}

        aria-expanded={open}

        aria-label={open ? t('staffForm.closePanel') : t('staffForm.staffAccess')}

      >

        <span className="staff-access-trigger-icon" aria-hidden="true">🔐</span>

        <span className="staff-access-trigger-text">

          {isStaff ? user.name || user.username : t('staffForm.staffLogin')}

        </span>

        {isStaff && <span className="staff-access-live-dot" aria-hidden="true" />}

      </button>



      {open && (

        <div className="staff-access-panel glass-card">

          <div className="staff-access-head">

            <div>

              <span className="staff-access-badge">{t('staff.badge')}</span>

              <h3>{isStaff ? t('staff.welcome', { name: user.name || user.username }) : t('staff.portal')}</h3>

              <p>

                {isStaff

                  ? `${roleLabel(user.role)} · ${SHOP.name}`

                  : t('staff.loginHint')}

              </p>

            </div>

            <button type="button" className="staff-access-close" onClick={() => setOpen(false)} aria-label={t('staffForm.close')}>

              ✕

            </button>

          </div>



          {!isStaff ? (

            <form className="staff-access-form" onSubmit={handleLogin}>

              {loginError && <div className="alert alert-error">{loginError}</div>}



              <div className="form-group">

                <label htmlFor="staff-login">{t('team.gmail')}</label>

                <input

                  id="staff-login"

                  type="email"

                  value={loginValue}

                  onChange={(e) => setLoginValue(e.target.value)}

                  placeholder="staff@gmail.com"

                  autoComplete="username"

                  required

                />

              </div>



              <div className="form-group">

                <label htmlFor="staff-password">{t('login.password')}</label>

                <input

                  id="staff-password"

                  type="password"

                  value={password}

                  onChange={(e) => setPassword(e.target.value)}

                  placeholder="••••••••"

                  autoComplete="current-password"

                  required

                />

              </div>



              <button type="submit" className="btn btn-primary btn-block" disabled={loginSubmitting}>

                {loginSubmitting ? t('staff.verifying') : t('staff.signIn')}

              </button>

            </form>

          ) : (

            <div className="staff-access-home">

              <div className="staff-access-status">

                <span className="role-badge role-super">{roleLabel(user.role)}</span>

                <span className="status-pill active">{t('staff.sessionActive')}</span>

              </div>

              <p className="field-hint">{t('staff.dashboardHint')}</p>

              <Link to="/admin" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>

                {t('staff.openAdmin')}

              </Link>

              {isSuperAdmin && (

                <Link to="/admin?tab=admins" className="btn btn-outline btn-block" onClick={() => setOpen(false)}>

                  {t('team.manageTeam')}

                </Link>

              )}

              <button type="button" className="btn btn-outline btn-block" onClick={handleLogout}>

                {t('common.logout')}

              </button>

            </div>

          )}

        </div>

      )}

    </div>

  );

}

