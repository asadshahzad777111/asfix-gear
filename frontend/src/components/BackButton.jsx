import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';

/**
 * Glass-style back control — uses browser history when possible, else fallback route.
 */
export default function BackButton({ to, label, className = '' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = () => {
    if (to) {
      navigate(to);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <button
      type="button"
      className={`back-nav-btn ${className}`.trim()}
      onClick={handleClick}
    >
      <span className="back-nav-btn__icon" aria-hidden="true">←</span>
      <span>{label || t('nav.back')}</span>
    </button>
  );
}
