import { useState } from 'react';
import { formatPrice } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { buildOrderReceipt } from '../utils/receipts';
import { getOrderCustomerStatus } from '../utils/orderStatus';
import { googleMapsUrl, osmStaticPreviewUrl } from '../utils/maps';
import { displayAddressLine } from '../utils/address';

export const ORDER_STATUSES = ['pending', 'payment_verified', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

const ORDER_QUICK_ACTIONS = [
  { status: 'payment_verified', label: 'Verify Payment', short: 'Paid' },
  { status: 'shipped', label: 'Mark Shipped', short: 'Ship' },
  { status: 'out_for_delivery', label: 'Out for Delivery', short: 'Rider' },
  { status: 'delivered', label: 'Mark Delivered', short: 'Done' },
];

function statusBtnLabel(status) {
  const found = ORDER_QUICK_ACTIONS.find((a) => a.status === status);
  return found?.short || status;
}

function AssignRiderForm({ onSubmit, onCancel, t, mapUrl }) {
  const [riderPhone, setRiderPhone] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const copyMapLink = async () => {
    if (!mapUrl) return;
    try {
      await navigator.clipboard.writeText(mapUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ rider_phone: riderPhone.trim(), delivery_charge: Number(deliveryCharge) });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <form className="admin-rider-form" onSubmit={handleSubmit}>
      {error && <p className="alert alert-error">{error}</p>}
      {mapUrl && (
        <div className="admin-delivery-map-actions">
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
            {t('admin.openInMaps')}
          </a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyMapLink}>
            {copied ? t('admin.locationCopied') : t('admin.copyLocationLink')}
          </button>
        </div>
      )}
      <input
        placeholder={t('admin.riderPhonePh')}
        value={riderPhone}
        onChange={(e) => setRiderPhone(e.target.value)}
        required
      />
      <input
        type="number"
        min="0"
        step="1"
        placeholder={t('admin.deliveryChargePh')}
        value={deliveryCharge}
        onChange={(e) => setDeliveryCharge(e.target.value)}
        required
      />
      <div className="admin-rider-form-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? t('common.saving') : t('admin.assignRider')}
        </button>
      </div>
    </form>
  );
}

function DeliveryLocationBlock({ addr, t }) {
  const mapUrl = googleMapsUrl(addr.lat, addr.lng);
  const previewUrl = osmStaticPreviewUrl(addr.lat, addr.lng, { width: 360, height: 100 });
  const [copied, setCopied] = useState(false);

  const copyMapLink = async () => {
    if (!mapUrl) return;
    try {
      await navigator.clipboard.writeText(mapUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="admin-delivery-location">
      <p className="admin-float-sub admin-delivery-location__text">
        {addr.name} · {addr.phone}
        <br />
        {displayAddressLine(addr)}
      </p>
      {Number.isFinite(Number(addr.lat)) && Number.isFinite(Number(addr.lng)) && (
        <p className="admin-delivery-location__coords">
          {Number(addr.lat).toFixed(5)}, {Number(addr.lng).toFixed(5)}
        </p>
      )}
      {previewUrl && (
        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="admin-delivery-map-preview">
          <img src={previewUrl} alt="" loading="lazy" />
        </a>
      )}
      {mapUrl && (
        <div className="admin-delivery-map-actions">
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
            {t('admin.openInMaps')}
          </a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyMapLink}>
            {copied ? t('admin.locationCopied') : t('admin.copyLocationLink')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Shared order card UI used by both the full-page Admin dashboard (`/admin`
 * → Orders tab) and the AdminFloatingDashboard "Ops Desk" widget, so the two
 * surfaces never drift out of sync on order actions/receipts.
 */
export default function AdminOrderCard({
  order: o,
  onUpdateStatus,
  onMarkPaid,
  onAssignRider,
  onMarkDelivered,
  className = 'admin-float-card',
}) {
  const { t } = useTranslation();
  const [showRiderForm, setShowRiderForm] = useState(false);
  const customerStatus = getOrderCustomerStatus(o);
  const addr = o.shipping_address;
  const mapUrl = addr ? googleMapsUrl(addr.lat, addr.lng) : null;

  const handleAssignRider = async (payload) => {
    await onAssignRider(o.id, payload);
    setShowRiderForm(false);
  };

  return (
    <article className={className}>
      <div className="admin-float-card-head">
        <strong>#{o.order_id || o.id} · {o.customer_name}</strong>
        <span>{formatPrice(o.total_amount)}</span>
      </div>
      <p className="admin-float-meta">
        {o.phone} · {o.city || 'No city'} ·{' '}
        <span className={o.payment_mode === 'cod' ? 'admin-payment-cod' : undefined}>
          {o.payment_mode === 'cod' ? 'COD (Cash on Delivery)' : o.payment_mode}
        </span>
        {o.fulfillment_method === 'pickup' ? ' · Pickup' : ''}
      </p>
      {o.payment_proof_url ? (
        <p className="admin-float-sub">
          Payment proof:{' '}
          <a href={o.payment_proof_url} target="_blank" rel="noopener noreferrer">
            View screenshot
          </a>
        </p>
      ) : null}
      {addr && <DeliveryLocationBlock addr={addr} t={t} />}
      {o.gmail && <p className="admin-float-sub">Gmail: {o.gmail}</p>}
      <p className="admin-float-sub">
        <span className={`order-status-pill status-${customerStatus}`}>
          {t(`track.status_${customerStatus}`) || customerStatus}
        </span>
      </p>
      {o.rider_phone && (
        <p className="admin-float-sub">
          {t('admin.riderPhone')}: {o.rider_phone}
          {Number(o.delivery_charge) > 0 && ` · ${t('admin.deliveryCharge')}: ${formatPrice(o.delivery_charge)}`}
        </p>
      )}
      <ul className="admin-float-items">
        {o.items.map((item, idx) => {
          const qty = Number(item.qty) || 1;
          const saleLine = Number(item.price) * qty;
          const costLine = Number(item.cost_price || 0) * qty;
          const profitLine = saleLine - costLine;
          return (
            <li key={idx}>
              {item.name} ×{qty}
              {item.price != null && (
                <span className="admin-float-item-price"> — {formatPrice(saleLine)}</span>
              )}
              {item.cost_price > 0 && (
                <span className="admin-float-item-cost">
                  {' '}· {t('sales.costShort')}: {formatPrice(costLine)}
                  {' '}· {t('sales.profitShort')}: {formatPrice(profitLine)}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="admin-float-receipt-actions">
        <a
          href={buildOrderReceipt(o, { showCost: false }).waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
        >
          {t('sales.receiptCustomer')}
        </a>
        <a
          href={buildOrderReceipt(o, { showCost: true }).waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
        >
          {t('sales.receiptStaff')}
        </a>
      </div>

      <div className="admin-order-actions admin-order-actions--delivery">
        {o.payment_status === 'pending_payment' && onMarkPaid && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onMarkPaid(o.id)}>
            {o.payment_mode === 'cod' ? t('admin.confirmCod') : t('admin.markPaid')}
          </button>
        )}
        {o.delivery_status === 'waiting_for_rider' && onAssignRider && !showRiderForm && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowRiderForm(true)}>
            {t('admin.assignRider')}
          </button>
        )}
        {showRiderForm && onAssignRider && (
          <AssignRiderForm
            t={t}
            mapUrl={mapUrl}
            onCancel={() => setShowRiderForm(false)}
            onSubmit={handleAssignRider}
          />
        )}
        {o.delivery_status === 'rider_assigned' && onMarkDelivered && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onMarkDelivered(o.id)}>
            {t('admin.markDelivered')}
          </button>
        )}
      </div>

      {onUpdateStatus && (
        <>
          <div className="admin-order-actions admin-order-actions--legacy">
            {ORDER_QUICK_ACTIONS.map((action) => (
              <button
                key={action.status}
                type="button"
                className={`btn btn-outline btn-sm admin-status-btn ${o.shipping_status === action.status ? 'active' : ''}`}
                disabled={o.shipping_status === action.status}
                onClick={() => onUpdateStatus(o.id, action.status)}
                title={action.label}
              >
                {statusBtnLabel(action.status)}
              </button>
            ))}
          </div>

          <select
            className="status-select"
            value={o.shipping_status}
            onChange={(e) => onUpdateStatus(o.id, e.target.value)}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </>
      )}

      {o.activity_log?.length > 0 && (
        <p className="admin-float-activity">{o.activity_log[o.activity_log.length - 1].message}</p>
      )}

      {o.customer_feedback?.rating ? (
        <p className="admin-float-feedback">
          ★ {o.customer_feedback.rating}/5
          {o.customer_feedback.status ? ` · ${o.customer_feedback.status}` : ''}
          {o.customer_feedback.comment ? ` — "${o.customer_feedback.comment}"` : ''}
        </p>
      ) : null}
    </article>
  );
}
