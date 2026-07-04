import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { whatsappLink } from '../config/shop';
import {
  buildContactPath,
  buildContactPrefill,
  buildOrderHelpWhatsAppMessage,
} from '../utils/contactPrefill';

/**
 * WhatsApp + contact page shortcuts when a customer needs help with an order.
 */
export default function OrderHelpActions({ orderId, phone = '', compact = false, className = '' }) {
  const { t } = useTranslation();
  if (!orderId) return null;

  const prefill = buildContactPrefill({ type: 'order-help', orderId, phone });
  const contactPath = buildContactPath(prefill);
  const waUrl = whatsappLink(buildOrderHelpWhatsAppMessage(orderId, phone));

  return (
    <div className={`order-help-actions${compact ? ' order-help-actions--compact' : ''}${className ? ` ${className}` : ''}`}>
      <p className="order-help-actions__label">{t('orderHelp.needHelp')}</p>
      <div className="order-help-actions__buttons">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-whatsapp btn-sm"
        >
          {t('orderHelp.whatsapp')}
        </a>
        <Link to={contactPath} className="btn btn-outline btn-sm">
          {t('orderHelp.contactPage')}
        </Link>
      </div>
    </div>
  );
}
