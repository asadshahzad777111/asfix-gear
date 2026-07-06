import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { SHOP, whatsappLink } from '../config/shop';

export default function ContactSuccessPanel({ onSendAnother }) {
  const { t } = useTranslation();
  const waHref = whatsappLink(t('contactSuccess.whatsappFollowUp'));

  return (
    <div className="order-success-panel glass-card contact-success-panel">
      <div className="order-success-icon-ring">
        <span className="order-success-icon">✓</span>
      </div>
      <h3>{t('contactSuccess.title')}</h3>
      <p className="order-success-subtitle">{t('contactSuccess.subtitle')}</p>
      <p className="order-success-hint contact-success-wait">{t('contactSuccess.waitForReply')}</p>

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-whatsapp premium-btn premium-btn--liquid order-success-wa"
      >
        {t('contactSuccess.whatsappBtn')}
      </a>

      <div className="order-success-actions">
        <Link to="/" className="btn btn-primary btn-sm">
          {t('nav.home')}
        </Link>
        {onSendAnother ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={onSendAnother}>
            {t('contactSuccess.sendAnother')}
          </button>
        ) : null}
        <a href={`tel:+${SHOP.phoneIntl}`} className="btn btn-outline btn-sm">
          {t('contactSuccess.callShop')}
        </a>
      </div>
    </div>
  );
}
