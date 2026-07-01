import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';

export default function FloatingRepairButton() {
  const { t } = useTranslation();
  const location = useLocation();
  const path = location.pathname;

  if (path.startsWith('/admin') || path.startsWith('/gaming') || path === '/repair') {
    return null;
  }

  return (
    <Link
      to="/repair"
      className="floating-repair-btn"
      aria-label={t('home.bookRepair')}
      title={t('home.bookRepair')}
    >
      <span className="floating-repair-btn-icon" aria-hidden="true">🔧</span>
      <span className="floating-repair-btn-label">{t('nav.repair')}</span>
    </Link>
  );
}
