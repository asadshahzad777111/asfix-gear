import { Link } from 'react-router-dom';
import Logo from '../Logo';
import LanguageToggle from '../LanguageToggle';
import ThemeToggle from '../ThemeToggle';
import { useTranslation } from '../../context/LanguageContext';

/**
 * Minimal chrome for account auth pages — no search, cart, wishlist, or nav dock.
 * Just way-back, brand, and language/theme.
 */
export default function AuthTopBar() {
  const { t } = useTranslation();

  return (
    <header className="auth-topbar">
      <div className="auth-topbar-inner">
        <Link to="/" className="auth-topbar-back" replace={false}>
          <span aria-hidden="true">←</span>
          <span>{t('login.backToStore').replace(/^←\s*/, '')}</span>
        </Link>

        <Link to="/" className="auth-topbar-brand" aria-label="AsFix & Gear">
          <Logo size={34} showText={false} />
        </Link>

        <div className="auth-topbar-tools">
          <LanguageToggle className="lang-toggle--toolbar auth-topbar-lang" />
          <ThemeToggle className="theme-switch--nav auth-topbar-theme" />
        </div>
      </div>
    </header>
  );
}
