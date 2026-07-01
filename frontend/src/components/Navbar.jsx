import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generalWhatsAppMessage } from '../config/shop';
import { useAuth } from '../context/AuthContext';
import useNavDrawerThumb from '../hooks/useNavDrawerThumb';
import OpenBadge from './OpenBadge';
import Logo from './Logo';
import AddProductModal from './AddProductModal';
import AccountMenu from './AccountMenu';
import CustomerLoginModal from './CustomerLoginModal';
import GamingModeButton from './gaming/GamingModeButton';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import {
  NavDrawerAdminLink,
  NavDrawerAnchor,
  NavDrawerButton,
  NavDrawerLink,
} from './NavDrawerItem';
import { useTranslation } from '../context/LanguageContext';

export default function Navbar() {
  const { isStaff, isCustomer, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/');
  };

  useNavDrawerThumb(menuOpen);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <header className="navbar navbar--mobile-pro">
        <div className="container navbar-inner">
          <LogoLink onNavigate={closeMenu} />

          <nav
            id="main-nav"
            className={`nav-links nav-drawer ${menuOpen ? 'open' : ''}`}
            aria-hidden={!menuOpen}
          >
            <div className="nav-drawer-head">
              <div className="nav-drawer-head-text">
                <span className="nav-drawer-title">{t('nav.menu')}</span>
                <span className="nav-drawer-subtitle">{t('nav.menuSub')}</span>
              </div>
              <button
                type="button"
                className="nav-drawer-close"
                onClick={closeMenu}
                aria-label={t('nav.closeMenu')}
              >
                <span className="nav-drawer-close-icon">✕</span>
              </button>
            </div>

            <LanguageToggle className="lang-toggle--drawer" />

            <span className="nav-drawer-section-label">{t('nav.explore')}</span>

            <div className="nav-links-primary">
              <NavDrawerLink to="/" end icon="🏠" label={t('nav.home')} onClick={closeMenu} />
              <NavDrawerLink to="/shop" icon="🛍️" label={t('nav.shop')} onClick={closeMenu} />
              <NavDrawerLink to="/repair" icon="🔧" label={t('nav.repair')} onClick={closeMenu} />
              <GamingModeButton variant="nav" onAfterClick={closeMenu} />
              <NavDrawerLink to="/track" icon="📦" label={t('nav.track')} onClick={closeMenu} />
              <NavDrawerLink to="/contact" icon="💬" label={t('nav.contact')} onClick={closeMenu} />
            </div>

            <span className="nav-drawer-section-label">{t('nav.accountSection')}</span>
            <div className="nav-links-account">
              {isCustomer ? (
                <>
                  <NavDrawerLink to="/account" icon="👤" label={t('nav.myAccount')} onClick={closeMenu} />
                  <NavDrawerLink to="/account/settings" icon="⚙️" label={t('nav.settings')} onClick={closeMenu} />
                  <NavDrawerButton
                    icon="🚪"
                    label={t('account.logout')}
                    className="nav-drawer-logout"
                    onClick={handleLogout}
                  />
                </>
              ) : (
                <>
                  <NavDrawerLink to="/account/login" icon="🔑" label={t('nav.signIn')} onClick={closeMenu} />
                  <NavDrawerLink to="/account/register" icon="✨" label={t('nav.signUp')} onClick={closeMenu} />
                </>
              )}
            </div>

            {isStaff && (
              <>
                <span className="nav-drawer-section-label">{t('staff.staffOnly')}</span>
                <div className="nav-links-staff">
                  <NavDrawerButton
                    icon="➕"
                    label={t('nav.addProduct')}
                    className="nav-add-product"
                    onClick={() => {
                      setAddOpen(true);
                      closeMenu();
                    }}
                  />
                  <NavDrawerAdminLink to="/admin" icon="⚙️" label={t('nav.admin')} onClick={closeMenu} />
                </div>
              </>
            )}

            <NavDrawerAnchor
              href={generalWhatsAppMessage()}
              icon="📱"
              label={t('nav.whatsapp')}
              className="nav-whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
            />
          </nav>

          <div className="navbar-aside">
            <OpenBadge compact />
            {isCustomer ? (
              <AccountMenu className="account-menu--toolbar" />
            ) : (
              <div className="nav-auth-buttons nav-auth-buttons--toolbar">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm nav-auth-btn"
                  onClick={() => setLoginOpen(true)}
                >
                  {t('nav.signIn')}
                </button>
                <Link to="/account/register" className="btn btn-primary btn-sm nav-auth-btn">
                  {t('nav.signUp')}
                </Link>
              </div>
            )}
            <LanguageToggle className="lang-toggle--toolbar" />
            <ThemeToggle className="theme-toggle--nav" />
            <button
              type="button"
              className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="main-nav"
            >
              <span className="menu-toggle-bar" />
              <span className="menu-toggle-bar" />
              <span className="menu-toggle-bar" />
            </button>
          </div>
        </div>

        <div
          className={`nav-overlay ${menuOpen ? 'visible' : ''}`}
          onClick={closeMenu}
          aria-hidden="true"
        />
      </header>

      {isStaff && <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} />}
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}

function LogoLink({ onNavigate }) {
  return (
    <Link to="/" className="logo" onClick={onNavigate}>
      <Logo size={38} showText />
    </Link>
  );
}
