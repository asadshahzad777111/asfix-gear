import { useState } from 'react';
import { formatPrice } from '../api/client';
import { SHOP } from '../config/shop';
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function printOrderReceipt(order) {
  const rows = (order.items || []).map((item) => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    return `
      <div class="item">
        <strong>${escapeHtml(item.name)}</strong>
        <div class="row"><span>${qty} x ${escapeHtml(formatPrice(price))}</span><b>${escapeHtml(formatPrice(price * qty))}</b></div>
      </div>
    `;
  }).join('');
  const win = window.open('', '_blank', 'width=420,height=720');
  if (!win) return;
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(order.order_id || order.id)} receipt</title>
        <style>
          @page { size: 58mm auto; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          body { font-family: "Courier New", Courier, monospace; color: #111; }
          .receipt { width: 58mm; max-width: 100%; margin: 0 auto; padding: 4mm 3mm; font-size: 11px; line-height: 1.25; }
          .shop { text-align: center; margin-bottom: 6px; }
          h1 { margin: 0 0 4px; font-family: Arial, sans-serif; font-size: 15px; }
          p { margin: 2px 0; font-size: 10px; }
          .meta { margin: 6px 0; font-size: 10px; }
          .rule { border-top: 1px dashed #111; margin: 6px 0; }
          .item { margin: 0 0 5px; }
          .item strong { display: block; overflow-wrap: anywhere; }
          .row { display: flex; justify-content: space-between; gap: 8px; }
          .total { font-family: Arial, sans-serif; font-size: 13px; font-weight: 900; margin-top: 4px; }
          .thanks { text-align: center; margin-top: 8px; font-size: 10px; }
          .hint { text-align: center; color: #555; font-size: 9px; margin-top: 10px; }
          @media print {
            .hint { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="shop">
            <h1>${escapeHtml(SHOP.name)}</h1>
            <p>${escapeHtml(SHOP.addressLine1)}</p>
            <p>${escapeHtml(SHOP.addressLine2)} | ${escapeHtml(SHOP.phone)}</p>
          </div>
          <div class="meta">
            <div>Bill #: ${escapeHtml(order.order_id || order.id)}</div>
            <div>Date: ${escapeHtml(order.created_at ? new Date(order.created_at).toLocaleString() : '')}</div>
            <div>Customer: ${escapeHtml(order.customer_name || 'Walk-in Customer')}</div>
            <div>Phone: ${escapeHtml(order.phone || '-')}</div>
            <div>Payment: ${escapeHtml(order.payment_mode || '')}</div>
            <div>Staff: ${escapeHtml(order.created_by_staff_name || '-')}</div>
          </div>
          <div class="rule"></div>
          ${rows}
          <div class="rule"></div>
          <div class="row total"><span>Total</span><span>${escapeHtml(formatPrice(order.total_amount))}</span></div>
          <p class="thanks">Thank you for shopping at AsFix & Gear.</p>
          <p class="thanks">asfixgear.com</p>
          <p class="hint">Print dialog me apna Bluetooth thermal printer select karen · Paper: 58mm</p>
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => window.print(), 200);
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
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
  const isCounter = o.source === 'counter_sale' || o.source === 'counter_return';
  const isReturn = o.source === 'counter_return' || o.transaction_type === 'return';
  const walkInName = !o.customer_name || /^walk-?in/i.test(String(o.customer_name).trim());
  const customerLabel = walkInName
    ? (o.phone ? `Walk-in · ${o.phone}` : 'Walk-in Customer')
    : o.customer_name;

  const handleAssignRider = async (payload) => {
    await onAssignRider(o.id, payload);
    setShowRiderForm(false);
  };

  return (
    <article className={className}>
      <div className="admin-float-card-head">
        <strong>
          #{o.order_id || o.id}
          <span className={`admin-order-channel-pill ${isCounter ? 'is-pos' : 'is-online'}`}>
            {isReturn ? t('admin.orderChannelReturn') : isCounter ? t('admin.orderChannelPos') : t('admin.orderChannelOnline')}
          </span>
        </strong>
        <span>{formatPrice(o.total_amount)}</span>
      </div>

      <p className="admin-order-customer-line">
        <strong>{customerLabel}</strong>
        {o.phone && !walkInName ? <span> · {o.phone}</span> : null}
      </p>

      {isCounter ? (
        <p className="admin-float-sub">
          {isReturn ? t('admin.orderCounterReturnMeta') : t('admin.orderCounterSaleMeta')}
          {o.created_by_staff_name ? ` · ${o.created_by_staff_name}` : ''}
          {o.payment_mode ? ` · ${o.payment_mode}` : ''}
          {o.created_at ? ` · ${new Date(o.created_at).toLocaleString()}` : ''}
        </p>
      ) : (
        <p className="admin-float-meta">
          {o.phone || 'No phone'} · {o.city || 'No city'} ·{' '}
          <span className={o.payment_mode === 'cod' ? 'admin-payment-cod' : undefined}>
            {o.payment_mode === 'cod' ? 'COD (Cash on Delivery)' : o.payment_mode}
          </span>
          {o.fulfillment_method === 'pickup' ? ' · Pickup' : ''}
        </p>
      )}

      {!isCounter && o.payment_proof_url ? (
        <p className="admin-float-sub">
          Payment proof:{' '}
          <a href={o.payment_proof_url} target="_blank" rel="noopener noreferrer">
            View screenshot
          </a>
        </p>
      ) : null}
      {!isCounter && addr ? <DeliveryLocationBlock addr={addr} t={t} /> : null}
      {!isCounter && o.gmail ? <p className="admin-float-sub">Gmail: {o.gmail}</p> : null}

      {!isCounter ? (
        <p className="admin-float-sub">
          <span className={`order-status-pill status-${customerStatus}`}>
            {t(`track.status_${customerStatus}`) || customerStatus}
          </span>
        </p>
      ) : null}

      {!isCounter && o.rider_phone ? (
        <p className="admin-float-sub">
          {t('admin.riderPhone')}: {o.rider_phone}
          {Number(o.delivery_charge) > 0 && ` · ${t('admin.deliveryCharge')}: ${formatPrice(o.delivery_charge)}`}
        </p>
      ) : null}

      <ul className="admin-float-items">
        {(o.items || []).map((item, idx) => {
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

      {(Number(o.subtotal_amount) > 0 || Number(o.discount_amount) > 0) && (
        <p className="admin-float-sub">
          Subtotal {formatPrice(o.subtotal_amount || o.total_amount)}
          {Number(o.discount_amount) > 0 ? ` · Discount ${formatPrice(o.discount_amount)}` : ''}
          {` · Net ${formatPrice(o.total_amount)}`}
        </p>
      )}

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
        <button type="button" className="btn btn-outline btn-sm" onClick={() => printOrderReceipt(o)}>
          {t('admin.counterBillPrint')}
        </button>
      </div>

      {!isCounter ? (
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
      ) : null}

      {!isCounter && onUpdateStatus ? (
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
      ) : null}

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
