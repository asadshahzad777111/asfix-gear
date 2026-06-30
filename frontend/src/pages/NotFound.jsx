import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <section className="section">
      <div className="container" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h1 className="section-title">{t('common.pageNotFound')}</h1>
        <p className="section-subtitle" style={{ margin: '0 auto 1.5rem' }}>
          {t('common.pageNotFoundSub')}
        </p>
        <Link to="/" className="btn btn-primary">{t('nav.home')}</Link>
      </div>
    </section>
  );
}
