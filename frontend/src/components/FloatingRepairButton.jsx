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
      <svg
        className="floating-repair-btn-icon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span className="floating-repair-btn-label">{t('nav.repair')}</span>
    </Link>
  );
}
