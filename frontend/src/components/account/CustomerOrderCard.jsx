import { Link } from 'react-router-dom';
import { formatPrice } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';
import OrderTimeline from '../OrderTimeline';
import OrderHelpActions from '../OrderHelpActions';
import { getOrderCustomerStatus } from '../../utils/orderStatus';
import { isPaymentVerified } from '../../utils/orderSearch';

function paymentLabel(t, mode) {
  if (!mode) return '—';
  const key = `cart.${mode}`;
  const label = t(key);
  return label === key ? mode : label;
}

export default function CustomerOrderCard({
  order,
  userPhone = '',
  copiedId = '',
  onCopyId,
  showTrackLink = true,
  compact = false,
}) {
  const { t } = useTranslation();
  const orderRef = order.order_id || `#${order.id}`;
  const orderIdClean = String(orderRef).replace(/^#/, '');
  const itemCount = (order.items || []).reduce((sum, i) => sum + Number(i.qty || 1), 0);
  const customerStatus = getOrderCustomerStatus(order);
  const paid = isPaymentVerified(order);

  const statusLabel = () => {
    const key = `track.status_${customerStatus}`;
    const label = t(key);
    return label === key ? customerStatus : label;
  };

  return (
    <article className={`account-list-item account-order-card ${compact ? 'account-order-card--compact' : ''}`}>
      <div className="order-success-id-card account-order-id-box">
        <span className="order-success-id-label">{t('account.orderIdLabel')}</span>
        <div className="order-success-id-row">
          <strong className="order-success-id-value">#{orderIdClean}</strong>
          {onCopyId ? (
            <button
              type="button"
              className="btn btn-outline btn-sm order-success-copy"
              onClick={() => onCopyId(orderIdClean)}
            >
              {copiedId === orderIdClean ? t('account.copied') : t('account.copyOrderId')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="account-order-head">
        <div className="account-order-badges">
          <span className={`order-status-pill status-${customerStatus}`}>{statusLabel()}</span>
          {paid ? (
            <span className="order-payment-badge order-payment-badge--verified">{t('account.paymentVerified')}</span>
          ) : order.payment_status === 'pending_payment' ? (
            <span className="order-payment-badge order-payment-badge--pending">{t('account.paymentPending')}</span>
          ) : null}
        </div>
        <strong>{formatPrice(order.total_amount)}</strong>
      </div>

      <div className="account-order-meta">
        <p>
          <span>{t('account.orderFor')}</span>{' '}
          <strong>{order.customer_name}</strong>
          {order.phone ? <> · {order.phone}</> : null}
        </p>
        <p>
          <span>{t('account.paymentVia')}</span>{' '}
          <strong>{paymentLabel(t, order.payment_mode)}</strong>
        </p>
        <p>
          <span>{t('account.orderCity')}</span>{' '}
          <strong>{order.city || '—'}</strong>
        </p>
        {order.shipping_address?.text && (
          <p>
            <span>{t('track.deliveryAddress')}</span>{' '}
            <strong>{order.shipping_address.text}</strong>
          </p>
        )}
        {order.rider_phone && (
          <p>
            <span>{t('track.riderPhone')}</span>{' '}
            <strong>{order.rider_phone}</strong>
            {Number(order.delivery_charge) > 0 && (
              <> · {t('track.deliveryCharge')}: {formatPrice(order.delivery_charge)}</>
            )}
          </p>
        )}
        <p>
          <span>{t('account.orderItems')}</span>{' '}
          <strong>{t('account.itemsCount', { count: itemCount })}</strong>
        </p>
        {!compact && (order.items || []).length > 0 && (
          <ul className="account-order-items">
            {(order.items || []).map((item, idx) => (
              <li key={`${item.name}-${idx}`}>
                {item.name} ×{item.qty || 1}
                <span>{formatPrice(Number(item.price || 0) * Number(item.qty || 1))}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="account-list-meta">{new Date(order.created_at).toLocaleString()}</p>
      </div>

      <OrderTimeline order={order} statusHistory={order.status_history} />

      {showTrackLink && (
        <Link
          to={`/track?orderId=${encodeURIComponent(orderIdClean)}&phone=${encodeURIComponent(userPhone || order.phone || '')}`}
          className="btn btn-outline btn-sm account-track-btn"
        >
          {t('account.trackOrder')}
        </Link>
      )}

      <OrderHelpActions
        orderId={orderIdClean}
        phone={userPhone || order.phone || ''}
        compact
        className="account-order-help"
      />
    </article>
  );
}
