import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { buildRepairReceipt } from '../utils/receipts';
import { buildContactPath, buildContactPrefill } from '../utils/contactPrefill';

export default function RepairSuccessPanel({ booking, onReset }) {
  const { t } = useTranslation();
  const { text } = buildRepairReceipt(booking);
  const contactTo = buildContactPath(buildContactPrefill({ type: 'repair-receipt', text }));
  const [copied, setCopied] = useState(false);
  const ref = booking.booking_ref || `ASF-R-${1000 + booking.id}`;
  const trackTo = `/track?tab=repair&bookingId=${encodeURIComponent(ref)}&phone=${encodeURIComponent(booking.phone || '')}`;

  const copyBookingId = async () => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="order-success-panel glass-card repair-success-panel">
      <div className="order-success-icon">🔧</div>
      <h3>{t('repairSuccess.title')}</h3>
      <p className="order-success-subtitle">{t('repairSuccess.subtitle')}</p>

      <div className="order-success-id-card order-success-id-card--hero">
        <span className="order-success-id-label">{t('repairSuccess.bookingId')}</span>
        <div className="order-success-id-row">
          <strong className="order-success-id-value">#{ref}</strong>
          <button type="button" className="btn btn-outline btn-sm order-success-copy" onClick={copyBookingId}>
            {copied ? t('account.copied') : t('account.copyOrderId')}
          </button>
        </div>
        <p className="order-success-save-id">{t('repairSuccess.saveIdHint')}</p>
      </div>

      <p className="order-success-hint">{t('repairSuccess.hint')}</p>
      <p className="order-success-diagnosis">{t('repairSuccess.diagnosisNote')}</p>

      <Link
        to={contactTo}
        className="btn btn-whatsapp premium-btn premium-btn--liquid order-success-wa"
      >
        {t('repairSuccess.sendWhatsApp')}
      </Link>

      <div className="order-success-actions">
        <Link to={trackTo} className="btn btn-primary btn-sm">
          {t('repairSuccess.trackRepair')}
        </Link>
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
