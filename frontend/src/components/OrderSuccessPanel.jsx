import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PaymentInstructions from './PaymentInstructions';
import OrderHelpActions from './OrderHelpActions';
import { mergePaymentSettings, isCodPayment } from '../config/payments';
import { buildOrderReceipt } from '../utils/receipts';
import { compressImageForUpload } from '../utils/compressImage';

const MOBILE_WALLETS = new Set(['jazzcash', 'easypaisa']);
const BANK_MODE = 'bank';
const LAST_ORDER_KEY = 'asfix_last_track_order';

const TRUST_BADGES = [
  { key: 'trustSecure', icon: '🔒' },
  { key: 'trustVerified', icon: '✓' },
  { key: 'trustDispatch', icon: '🚚' },
];

const NEXT_STEPS = ['step1', 'step2', 'step3'];

function rememberOrderForTrack(order, phone) {
  try {
    localStorage.setItem(
      LAST_ORDER_KEY,
      JSON.stringify({
        orderId: order.order_id,
        phone: phone || order.phone || '',
        at: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

export default function OrderSuccessPanel({ order, phone, onDone }) {
  const { t } = useTranslation();
  const { isCustomer } = useAuth();
  const { waUrl } = buildOrderReceipt(order);
  const [gmail, setGmail] = useState('');
  const [gmailMsg, setGmailMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [proofUrl, setProofUrl] = useState(order?.payment_proof_url || '');
  const [proofMsg, setProofMsg] = useState('');
  const [proofUploading, setProofUploading] = useState(false);

  const needsProof = MOBILE_WALLETS.has(order.payment_mode) || order.payment_mode === BANK_MODE;
  const trackHref = `/track?orderId=${encodeURIComponent(order.order_id)}&phone=${encodeURIComponent(phone || '')}`;

  useEffect(() => {
    rememberOrderForTrack(order, phone);
    api.getPaymentSettings()
      .then((data) => setPaymentSettings(mergePaymentSettings(data)))
      .catch(() => setPaymentSettings(mergePaymentSettings()));
  }, [order, phone]);

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

  const onProofSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProofUploading(true);
    setProofMsg('');
    try {
      const compressed = await compressImageForUpload(file, 200 * 1024);
      if (!compressed) throw new Error(t('orderSuccess.proofTooLarge'));
      const result = await api.uploadOrderPaymentProof(order.id, compressed);
      setProofUrl(result.payment_proof_url || '');
      setProofMsg(t('orderSuccess.proofSaved'));
    } catch (err) {
      setProofMsg(err.message || t('orderSuccess.proofFailed'));
    } finally {
      setProofUploading(false);
    }
  };

  return (
    <div className="order-success-panel order-success-panel--daraz" role="status">
      <div className="order-success-hero">
        <div className="order-success-icon-ring">
          <span className="order-success-icon">✓</span>
        </div>
        <h3>{t('orderSuccess.title')}</h3>
        <p className="order-success-subtitle">{t('orderSuccess.subtitle')}</p>
      </div>

      <div className="order-success-id-card order-success-id-card--hero">
        <span className="order-success-id-label">{t('orderSuccess.orderId')}</span>
        <div className="order-success-id-row">
          <strong className="order-success-id-value">#{order.order_id}</strong>
          <button type="button" className="btn btn-outline btn-sm order-success-copy" onClick={copyOrderId}>
            {copied ? t('orderSuccess.copied') : t('orderSuccess.copyOrderId')}
          </button>
        </div>
        <p className="order-success-save-id">{t('orderSuccess.saveIdHint')}</p>
        <p className="order-success-dispatch">
          {order.fulfillment_method === 'pickup'
            ? t('orderSuccess.estimatedPickup')
            : t('orderSuccess.estimatedDelivery')}
        </p>
      </div>

      <div className="order-success-primary-cta">
        <Link to={trackHref} className="btn btn-primary order-success-track-btn" onClick={onDone}>
          {t('orderSuccess.trackOrder')}
        </Link>
        <p className="order-success-whats-next">{t('orderSuccess.whatsNext')}</p>
      </div>

      {needsProof && (
        <PaymentInstructions
          t={t}
          amount={formatPrice(order.total_amount)}
          orderId={order.order_id}
          paymentMode={order.payment_mode}
          settings={paymentSettings}
        />
      )}

      {needsProof && isCustomer && (
        <div className="order-success-proof glass-card">
          <h4>{t('orderSuccess.proofTitle')}</h4>
          <p className="checkout-payment-note">{t('orderSuccess.proofHint')}</p>
          {proofUrl ? (
            <p className="order-success-proof-done">
              <a href={proofUrl} target="_blank" rel="noopener noreferrer">{t('orderSuccess.proofView')}</a>
            </p>
          ) : null}
          <label className="btn btn-outline btn-sm">
            {proofUploading ? t('orderSuccess.proofUploading') : t('orderSuccess.proofUpload')}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={proofUploading}
              onChange={onProofSelected}
            />
          </label>
          {proofMsg ? <p className="order-success-gmail-msg">{proofMsg}</p> : null}
        </div>
      )}

      {isCodPayment(order.payment_mode) && (
        <div className="checkout-payment-instructions glass-card">
          <h4 className="checkout-payment-instructions-title">{t('cart.cod')}</h4>
          <p className="checkout-payment-note" style={{ marginBottom: 0 }}>
            {order.fulfillment_method === 'pickup' ? t('cart.codPickupHint') : t('cart.codPaymentHint')}
          </p>
        </div>
      )}

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

      <OrderHelpActions orderId={order.order_id} phone={phone} />

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
        {isCustomer ? (
          <Link to="/account" className="btn btn-outline btn-sm" onClick={onDone}>
            {t('nav.myOrders')}
          </Link>
        ) : null}
        <Link to={trackHref} className="btn btn-outline btn-sm" onClick={onDone}>
          {t('orderSuccess.trackOrder')}
        </Link>
        {onDone && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onDone}>
            {t('orderSuccess.done')}
          </button>
        )}
      </div>

      <div className="order-success-sticky-cta" aria-hidden={false}>
        <Link to={trackHref} className="btn btn-primary order-success-track-btn" onClick={onDone}>
          {t('orderSuccess.trackOrder')}
        </Link>
      </div>
    </div>
  );
}
