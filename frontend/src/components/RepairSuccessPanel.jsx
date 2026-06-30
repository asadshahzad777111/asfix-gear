import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { buildRepairReceipt } from '../utils/receipts';

export default function RepairSuccessPanel({ booking, onReset }) {
  const { t } = useTranslation();
  const { waUrl } = buildRepairReceipt(booking);

  return (
    <div className="order-success-panel glass-card repair-success-panel">
      <div className="order-success-icon">🔧</div>
      <h3>{t('repairSuccess.title')}</h3>
      <p className="order-success-id">
        {t('repairSuccess.ref')}: <strong>#{booking.booking_ref}</strong>
      </p>
      <p className="order-success-hint">{t('repairSuccess.hint')}</p>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-whatsapp premium-btn premium-btn--liquid order-success-wa"
      >
        {t('repairSuccess.sendWhatsApp')}
      </a>

      <div className="order-success-actions">
        {onReset && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onReset}>
            {t('repairSuccess.newIntake')}
          </button>
        )}
        <Link to="/contact" className="btn btn-outline btn-sm">
          {t('repairSuccess.contact')}
        </Link>
      </div>
    </div>
  );
}
