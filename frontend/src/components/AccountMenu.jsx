import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import MorphIcon from './nav/MorphIcon';
import { IconSettings, IconSettingsSpin } from './nav/NavIcons';

function IconOrders() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M4.5 7.5h15v11a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4.5 18.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 7.5V6a4 4 0 0 1 8 0v1.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPrefs() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.2 6.2l1.6 1.6M16.2 16.2l1.6 1.6M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M10 5.5H7.5A2.5 2.5 0 0 0 5 8v8a2.5 2.5 0 0 0 2.5 2.5H10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M13.5 12H20M17 8.5 20.5 12 17 15.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AccountMenu({ className = '' }) {
  const { isCustomer, user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  if (!isCustomer || !user) return null;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  const menuItems = [
    { to: '/account', icon: <IconProfile />, label: t('nav.profile') },
    { to: '/account', icon: <IconOrders />, label: t('nav.myOrders') },
    { to: '/account/settings', icon: <IconPrefs />, label: t('nav.settings') },
  ];

  return (
    <div className={`account-menu ${className}`} ref={menuRef}>
      <button
        type="button"
        className="account-menu-trigger dx-icon-btn dx-icon-btn--account dx-icon-btn--morph"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('nav.accountMenu')}
        title={t('nav.accountMenu')}
      >
        <MorphIcon
          idle={<IconSettings size={20} />}
          hover={<IconSettingsSpin size={20} />}
        />
      </button>

      {open && (
        <div className="account-menu-dropdown" role="menu">
          <div className="account-menu-head">
            <strong>{user.name || user.username}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          {menuItems.map(({ to, icon, label }) => (
            <Link
              key={`${to}-${label}`}
              to={to}
              className="account-menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className="account-menu-item-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="account-menu-item-label">{label}</span>
            </Link>
          ))}
          <button
            type="button"
            className="account-menu-item account-menu-logout"
            role="menuitem"
            onClick={handleLogout}
          >
            <span className="account-menu-item-icon" aria-hidden="true">
              <IconLogout />
            </span>
            <span className="account-menu-item-label">{t('account.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
