import { Fragment, useMemo } from 'react';
import { formatPrice } from '../../api/client';
import AdminOrderCard from '../AdminOrderCard';
import { getOrderCustomerStatus } from '../../utils/orderStatus';
import {
  buildAdminOrderRows,
  isReturnOrder,
  orderProfitTotals,
  returnRefundAmount,
} from '../../utils/orderReturns';

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
 * Customers-style expandable order list.
 * Returns are nested under their original sale bill.
 */
export default function AdminOrdersTable({
  orders,
  allOrders,
  expandedId,
  onToggleExpand,
  highlightId = null,
  shipIntent = '',
  onShipIntentConsumed,
  onUpdateStatus,
  onMarkPaid,
  onBookPostEx,
  onOrderUpdated,
  t,
}) {
  const rows = useMemo(
    () => buildAdminOrderRows(orders, allOrders || orders),
    [orders, allOrders],
  );

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
            <th>Total / Net</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const o = row.order;
            const id = String(o.id);
            const expanded = String(expandedId) === id;
            const isHit = highlightId != null && String(highlightId) === id;
            const channel = orderChannel(o);
            const isReturn = row.kind === 'return' || isReturnOrder(o);
            const status = isReturn ? (o.shipping_status || 'returned') : getOrderCustomerStatus(o);
            const channelLabel = isReturn
              ? t('admin.orderChannelReturn')
              : channel === 'counter'
                ? t('admin.orderChannelPos')
                : t('admin.orderChannelOnline');
            const returnedAmount = Math.max(0, Number(o.returned_amount) || 0);
            const hasReturn = !isReturn && returnedAmount > 0;
            const netAmount = Number.isFinite(Number(o.net_amount))
              ? Number(o.net_amount)
              : (Number(o.total_amount) || 0) - returnedAmount;
            const refund = isReturn ? returnRefundAmount(o) : 0;
            const profit = orderProfitTotals(o);
            const originalRef = o.original_order_ref || row.parent?.order_id || '';

            return (
              <Fragment key={`${row.kind}-${o.id}`}>
                <tr
                  className={[
                    expanded ? 'is-expanded' : '',
                    isHit ? 'is-receipt-hit' : '',
                    isReturn ? 'wp-order-row--return' : '',
                    hasReturn ? 'wp-order-row--has-return' : '',
                    row.depth > 0 ? 'wp-order-row--nested' : '',
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
                      className={`wp-order-id-btn${row.depth > 0 ? ' wp-order-id-btn--nested' : ''}`}
                      onClick={() => onToggleExpand(expanded ? null : id)}
                    >
                      <strong>#{o.order_id || o.id}</strong>
                      {isReturn && originalRef ? (
                        <span className="wp-order-return-of">
                          {t('admin.orderReturnOf', { id: originalRef })}
                        </span>
                      ) : null}
                      {hasReturn ? (
                        <span className="wp-order-return-tag">{t('admin.orderHasReturn')}</span>
                      ) : null}
                    </button>
                  </td>
                  <td>
                    <div className="wp-row-title">{customerLabel(o)}</div>
                  </td>
                  <td className="wp-customer-phone">{o.phone || '—'}</td>
                  <td>
                    <span
                      className={`admin-order-channel-pill ${
                        isReturn ? 'is-return' : channel === 'counter' ? 'is-pos' : 'is-online'
                      }`}
                    >
                      {channelLabel}
                    </span>
                  </td>
                  <td className="wp-customer-spent">
                    {isReturn ? (
                      <div className="wp-order-total-cell">
                        <strong className="wp-order-total-cell__refund">
                          −{formatPrice(refund)}
                        </strong>
                        <small>
                          {t('sales.profitShort')}: {formatPrice(profit.profitTotal)}
                        </small>
                      </div>
                    ) : (
                      <div className="wp-order-total-cell">
                        <strong>{formatPrice(o.total_amount || 0)}</strong>
                        {hasReturn ? (
                          <>
                            <span className="wp-order-total-cell__returned">
                              {t('admin.returnedAmount')}: {formatPrice(returnedAmount)}
                            </span>
                            <small>
                              {t('admin.netAfterReturn')}: {formatPrice(netAmount)}
                            </small>
                          </>
                        ) : null}
                      </div>
                    )}
                  </td>
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
                          linkedReturns={isReturn ? undefined : o.linked_returns}
                          shipIntent={isHit ? shipIntent : ''}
                          onShipIntentConsumed={onShipIntentConsumed}
                          onUpdateStatus={channel === 'online' && !isReturn ? onUpdateStatus : undefined}
                          onMarkPaid={channel === 'online' && !isReturn ? onMarkPaid : undefined}
                          onBookPostEx={channel === 'online' && !isReturn ? onBookPostEx : undefined}
                          onOrderUpdated={onOrderUpdated}
                          className={`admin-float-card admin-order-card-full glass-card${
                            isReturn
                              ? ' admin-order-card--return'
                              : channel === 'counter'
                                ? ' admin-order-card--pos'
                                : ' admin-order-card--online'
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
