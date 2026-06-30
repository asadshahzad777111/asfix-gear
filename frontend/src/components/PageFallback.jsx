import { useTranslation } from '../context/LanguageContext';

export default function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="page-fallback" role="status" aria-live="polite">
      <span className="page-fallback-spinner" aria-hidden="true" />
      <span>{t('common.loading')}</span>
    </div>
  );
}
