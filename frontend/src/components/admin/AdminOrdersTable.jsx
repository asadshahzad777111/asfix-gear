import { Fragment } from 'react';
import { formatPrice } from '../../api/client';
import AdminOrderCard from '../AdminOrderCard';
import { getOrderCustomerStatus } from '../../utils/orderStatus';

function orderChannel(o) {
  const src = o?.source || 'online';
  if (src === 'counter_sale' || src === 'counter_return' || src === 'counter_draft') return 'counter';
  return 'online';
}

function formatOrderDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function customerLabel(o) {
  const name = String(o?.customer_name || '').trim();
  if (!name || /^walk-?in/i.test(name)) {
    return o?.phone ? `Walk-in · ${o.phone}` : 'Walk-in';
  }
  return name;
}

/**
 * Customers-style expandable order list: one row per order, click ▶ to open bill + print/share.
 */
export default function AdminOrdersTable({
  orders,
  expandedId,
  onToggleExpand,
  highlightId = null,
  onUpdateStatus,
  onMarkPaid,
  onAssignRider,
  onMarkDelivered,
  t,
}) {
  const rows = [...(orders || [])].reverse();

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="wp-table-wrap">
      <table className="wp-table wp-table--orders">
        <thead>
          <tr>
            <th aria-label="Expand" className="wp-col-expand" />
            <th>Order</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Channel</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const id = String(o.id);
            const expanded = String(expandedId) === id;
            const isHit = highlightId != null && String(highlightId) === id;
            const channel = orderChannel(o);
            const isReturn = o.source === 'counter_return' || o.transaction_type === 'return';
            const status = getOrderCustomerStatus(o);
            const channelLabel = isReturn
              ? t('admin.orderChannelReturn')
              : channel === 'counter'
                ? t('admin.orderChannelPos')
                : t('admin.orderChannelOnline');

            return (
              <Fragment key={o.id}>
                <tr
                  className={[
                    expanded ? 'is-expanded' : '',
                    isHit ? 'is-receipt-hit' : '',
                  ].filter(Boolean).join(' ') || undefined}
                >
                  <td className="wp-col-expand">
                    <button
                      type="button"
                      className="wp-row-expand"
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Hide order bill' : 'Open order bill'}
                      onClick={() => onToggleExpand(expanded ? null : id)}
                    >
                      {expanded ? '▼' : '▶'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="wp-order-id-btn"
                      onClick={() => onToggleExpand(expanded ? null : id)}
                    >
                      <strong>#{o.order_id || o.id}</strong>
                    </button>
                  </td>
                  <td>
                    <div className="wp-row-title">{customerLabel(o)}</div>
                  </td>
                  <td className="wp-customer-phone">{o.phone || '—'}</td>
                  <td>
                    <span className={`admin-order-channel-pill ${channel === 'counter' ? 'is-pos' : 'is-online'}`}>
                      {channelLabel}
                    </span>
                  </td>
                  <td className="wp-customer-spent">{formatPrice(o.total_amount || 0)}</td>
                  <td>
                    <span className={`order-status-pill status-${status}`}>
                      {t(`track.status_${status}`) || String(status).replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="wp-customer-date">{formatOrderDate(o.created_at)}</td>
                </tr>
                {expanded ? (
                  <tr className="wp-customer-detail-row wp-order-detail-row">
                    <td colSpan={8}>
                      <div className="wp-order-bill-panel">
                        <AdminOrderCard
                          order={o}
                          onUpdateStatus={channel === 'online' ? onUpdateStatus : undefined}
                          onMarkPaid={channel === 'online' ? onMarkPaid : undefined}
                          onAssignRider={channel === 'online' ? onAssignRider : undefined}
                          onMarkDelivered={channel === 'online' ? onMarkDelivered : undefined}
                          className={`admin-float-card admin-order-card-full glass-card${
                            channel === 'counter' ? ' admin-order-card--pos' : ' admin-order-card--online'
                          }${isHit ? ' admin-order-card--search-hit' : ''}`}
                        />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
