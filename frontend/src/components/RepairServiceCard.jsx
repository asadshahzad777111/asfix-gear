import { repairQuoteContactPath } from '../config/repairModels';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';

export default function RepairServiceCard({ service }) {
  const { t } = useTranslation();
  const models = service.supported_models || t('repairService.allBrands');
  const quoteTo = repairQuoteContactPath(service.name);

  return (
    <article className="glass-card service-card">
      <div className="service-icon">{service.icon}</div>
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <div className="service-models">
        <span className="service-models-label">{t('repairService.supportedModels')}</span>
        <p>{models}</p>
      </div>
      <div className="service-meta">
        <span className="service-duration">⏱ {service.duration}</span>
        <span className="service-quote-tag">{t('repairService.priceOnDiagnosis')}</span>
      </div>
      <Link
        to={quoteTo}
        className="btn btn-whatsapp btn-sm service-quote-btn"
      >
        {t('repairService.whatsappQuote')}
      </Link>
    </article>
  );
}
