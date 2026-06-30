import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

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

  const initial = (user.name || user.username || '?')[0].toUpperCase();

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className={`account-menu ${className}`} ref={menuRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('nav.accountMenu')}
      >
        <span className="account-menu-avatar" aria-hidden="true">{initial}</span>
        <span className="account-menu-icon" aria-hidden="true">⚙</span>
      </button>

      {open && (
        <div className="account-menu-dropdown" role="menu">
          <div className="account-menu-head">
            <strong>{user.name || user.username}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          <Link to="/account/settings" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <span aria-hidden="true">👤</span> {t('nav.profile')}
          </Link>
          <Link to="/account" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <span aria-hidden="true">📦</span> {t('nav.myOrders')}
          </Link>
          <Link to="/account/settings" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <span aria-hidden="true">⚙️</span> {t('nav.settings')}
          </Link>
          <button type="button" className="account-menu-item account-menu-logout" role="menuitem" onClick={handleLogout}>
            <span aria-hidden="true">🚪</span> {t('account.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
