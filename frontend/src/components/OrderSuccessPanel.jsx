import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { buildOrderReceipt } from '../utils/receipts';

const TRUST_BADGES = [
  { key: 'trustSecure', icon: '🔒' },
  { key: 'trustVerified', icon: '✓' },
  { key: 'trustDispatch', icon: '🚚' },
];

const NEXT_STEPS = ['step1', 'step2', 'step3'];

export default function OrderSuccessPanel({ order, phone, onDone }) {
  const { t } = useTranslation();
  const { waUrl } = buildOrderReceipt(order);
  const [gmail, setGmail] = useState('');
  const [gmailMsg, setGmailMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveGmail = async (e) => {
    e.preventDefault();
    if (!gmail.trim()) return;
    setSaving(true);
    setGmailMsg('');
    try {
      await api.saveOrderGmail(order.id, { gmail: gmail.trim(), phone });
      setGmailMsg(t('orderSuccess.gmailSaved'));
    } catch (err) {
      setGmailMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(order.order_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="order-success-panel order-success-panel--daraz">
      <div className="order-success-hero">
        <div className="order-success-icon-ring">
          <span className="order-success-icon">✓</span>
        </div>
        <h3>{t('orderSuccess.title')}</h3>
        <p className="order-success-subtitle">{t('orderSuccess.subtitle')}</p>
      </div>

      <div className="order-success-id-card">
        <span className="order-success-id-label">{t('orderSuccess.orderId')}</span>
        <div className="order-success-id-row">
          <strong className="order-success-id-value">#{order.order_id}</strong>
          <button type="button" className="btn btn-outline btn-sm order-success-copy" onClick={copyOrderId}>
            {copied ? t('orderSuccess.copied') : t('orderSuccess.copyOrderId')}
          </button>
        </div>
        <p className="order-success-dispatch">{t('orderSuccess.estimatedDelivery')}</p>
      </div>

      <div className="order-success-trust">
        {TRUST_BADGES.map(({ key, icon }) => (
          <div key={key} className="order-success-trust-badge">
            <span aria-hidden="true">{icon}</span>
            <span>{t(`orderSuccess.${key}`)}</span>
          </div>
        ))}
      </div>

      <div className="order-success-next glass-card">
        <h4>{t('orderSuccess.nextSteps')}</h4>
        <ol className="order-success-steps">
          {NEXT_STEPS.map((step) => (
            <li key={step}>{t(`orderSuccess.${step}`)}</li>
          ))}
        </ol>
      </div>

      <p className="order-success-hint">{t('orderSuccess.hint')}</p>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-whatsapp premium-btn premium-btn--liquid order-success-wa"
      >
        {t('orderSuccess.sendWhatsApp')}
      </a>

      <div className="order-success-gmail glass-card">
        <p>{t('orderSuccess.gmailPrompt')}</p>
        <form onSubmit={saveGmail} className="order-success-gmail-form">
          <input
            type="email"
            placeholder={t('orderSuccess.gmailPlaceholder')}
            value={gmail}
            onChange={(e) => setGmail(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? t('orderSuccess.saving') : t('orderSuccess.saveGmail')}
          </button>
        </form>
        {gmailMsg && <p className="order-success-gmail-msg">{gmailMsg}</p>}
      </div>

      <div className="order-success-actions">
        <Link to={`/track?orderId=${encodeURIComponent(order.order_id)}&phone=${encodeURIComponent(phone)}`} className="btn btn-outline btn-sm">
          {t('orderSuccess.trackOrder')}
        </Link>
        {onDone && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onDone}>
            {t('orderSuccess.done')}
          </button>
        )}
      </div>
    </div>
  );
}
