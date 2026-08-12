import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { useSmartThermalPrint } from '../hooks/useSmartThermalPrint';
import { buildOrderReceipt } from '../utils/receipts';
import { getOrderCustomerStatus } from '../utils/orderStatus';
import { displayAddressLine } from '../utils/address';
import {
  downloadCounterInvoicePdf,
  readThermalReceiptWidth,
  shareCounterInvoicePdf,
} from './admin/AdminCounterBill';
import {
  isReturnOrder,
  orderLineFinancials,
  orderProfitTotals,
  returnRefundAmount,
} from '../utils/orderReturns';
import AdminCancelRefundPanel from './AdminCancelRefundPanel';

export const ORDER_STATUSES = [
  'pending',
  'payment_verified',
  'shipped',
  'out_for_delivery',
  'delivered',
  'returned',
  'cancelled',
];

/** Online gateways — payment confirmed by provider; no manual Paid button. */
const AUTO_PAID_MODES = new Set(['safepay', 'payfast']);

function paymentModeLabel(mode, t) {
  const m = String(mode || '').toLowerCase();
  if (m === 'cod') return t('cart.cod');
  if (m === 'safepay') return t('cart.safepay');
  if (m === 'jazzcash') return t('cart.jazzcash');
  if (m === 'easypaisa') return t('cart.easypaisa');
  if (m === 'bank') return t('cart.bank');
  if (m === 'payfast') return t('cart.payfast');
  return mode || '—';
}

function paymentModeClass(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'cod') return 'is-cod';
  if (m === 'safepay' || m === 'payfast') return 'is-advance';
  if (m === 'jazzcash' || m === 'easypaisa' || m === 'bank') return 'is-wallet';
  return '';
}

function needsManualPaidButton(order) {
  if (order.payment_status !== 'pending_payment') return false;
  const mode = String(order.payment_mode || '').toLowerCase();
  // Safepay / PayFast: gateway marks paid — hide manual Paid
  if (AUTO_PAID_MODES.has(mode)) return false;
  return true;
}

/**
 * Shared order card — Admin Orders tab + Ops Desk.
 * PostEx tracking auto-updates status — no manual Ship/Rider/Done / Assign Rider.
 * Address text only (no map).
 */
export default function AdminOrderCard({
  order: o,
  linkedReturns: linkedReturnsProp,
  shipIntent = '',
  onShipIntentConsumed,
  onUpdateStatus,
  onMarkPaid,
  onBookPostEx,
  onOrderUpdated,
  className = 'admin-float-card',
}) {
  const { t } = useTranslation();
  const [showReceipts, setShowReceipts] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [postexBusy, setPostexBusy] = useState(false);
  const shipIntentDoneRef = useRef('');
  const printInFlightRef = useRef(false);
  const { printSmart, chooser: printChooser } = useSmartThermalPrint();
  const customerStatus = getOrderCustomerStatus(o);
  const addr = o.shipping_address;
  const isCounter = o.source === 'counter_sale' || o.source === 'counter_return';
  const isReturn = isReturnOrder(o);
  const isPickup = String(o.fulfillment_method || '').toLowerCase() === 'pickup';
  const linkedReturns = Array.isArray(linkedReturnsProp)
    ? linkedReturnsProp
    : Array.isArray(o.linked_returns)
      ? o.linked_returns
      : [];
  const returnedAmount = Math.max(
    0,
    Number(o.returned_amount) || linkedReturns.reduce((sum, row) => sum + returnRefundAmount(row), 0)
  );
  const hasLinkedReturns = !isReturn && (returnedAmount > 0 || linkedReturns.length > 0);
  const netAfterReturn = Number.isFinite(Number(o.net_amount))
    ? Number(o.net_amount)
    : (Number(o.total_amount) || 0) - returnedAmount;
  const profitTotals = orderProfitTotals(o);
  const refundAmount = isReturn ? returnRefundAmount(o) : 0;
  const walkInName = !o.customer_name || /^walk-?in/i.test(String(o.customer_name).trim());
  const customerLabel = walkInName
    ? o.phone
      ? `Walk-in · ${o.phone}`
      : 'Walk-in Customer'
    : o.customer_name;
  const thermalWidth = readThermalReceiptWidth();
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  const canBookPostEx =
    Boolean(onBookPostEx) &&
    !isCounter &&
    !isReturn &&
    !isPickup &&
    o.shipping_status !== 'cancelled' &&
    !o.postex_tracking;

  const needsPay = !isCounter && !isReturn && needsManualPaidButton(o) && Boolean(onMarkPaid);

  const handleBookPostEx = async () => {
    if (!canBookPostEx || postexBusy) return;
    if (!window.confirm?.(t('admin.postexBookConfirm'))) return;
    setPostexBusy(true);
    try {
      await onBookPostEx(o.id);
    } catch (err) {
      window.alert?.(err?.message || t('admin.postexBookFailed'));
    } finally {
      setPostexBusy(false);
    }
  };

  useEffect(() => {
    const intent = String(shipIntent || '').trim().toLowerCase();
    if (!intent || intent === shipIntentDoneRef.current) return;
    shipIntentDoneRef.current = intent;
    if (intent === 'postex' && canBookPostEx) {
      void handleBookPostEx();
    }
    onShipIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from URL intent
  }, [shipIntent, canBookPostEx]);

  const handleThermalPrint = async () => {
    if (receiptBusy) return;
    setReceiptBusy(true);
    try {
      const result = await printSmart(o, {
        thermalWidth,
        inFlightRef: printInFlightRef,
      });
      if (!result?.ok && result?.reason !== 'cancelled' && result?.reason !== 'busy') {
        window.alert?.(
          result?.reason === 'no_printer'
            ? t('admin.counterBillNativeNoPrinter')
            : result?.reason === 'permission_denied'
              ? t('admin.counterBillNativeBtPermission')
              : result?.reason === 'no_station'
                ? t('admin.printTargetNoStation')
                : result?.message || t('admin.counterBillNativePrintFailed')
        );
      } else if (result?.ok && result?.job) {
        window.alert?.(t('admin.printTargetQueued'));
      }
    } finally {
      setReceiptBusy(false);
    }
  };

  const handleShareReceipt = async () => {
    if (receiptBusy) return;
    setReceiptBusy(true);
    try {
      await shareCounterInvoicePdf(o, thermalWidth);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        try {
          await downloadCounterInvoicePdf(o, thermalWidth);
        } catch {
          window.alert?.(t('admin.counterBillPdfFailed'));
        }
      }
    } finally {
      setReceiptBusy(false);
    }
  };

  const addressText = addr ? displayAddressLine(addr) : '';

  return (
    <>
      <article className={`${className} admin-order-card-v2`.trim()}>
        <div className="admin-float-card-head">
          <strong>
            #{o.order_id || o.id}
            <span
              className={`admin-order-channel-pill ${isReturn ? 'is-return' : isCounter ? 'is-pos' : 'is-online'}`}
            >
              {isReturn
                ? t('admin.orderChannelReturn')
                : isCounter
                  ? t('admin.orderChannelPos')
                  : t('admin.orderChannelOnline')}
            </span>
            {o.cancel_request_status === 'pending' ? (
              <span
                className={`admin-cancel-badge${o.cancel_postex_booked_at_request || o.postex_tracking ? ' admin-cancel-badge--postex' : ''}`}
              >
                {t('admin.cancelRequestBadge')}
              </span>
            ) : null}
            {o.cancel_repeat_flag || Number(o.cancel_recent_count_7d) >= 2 ? (
              <span className="admin-cancel-badge">{t('admin.cancelRepeatBadge')}</span>
            ) : null}
          </strong>
          <span>{isReturn ? `−${formatPrice(refundAmount)}` : formatPrice(o.total_amount)}</span>
        </div>

        <p className="admin-order-customer-line">
          <strong>{customerLabel}</strong>
          {o.phone && !walkInName ? <span> · {o.phone}</span> : null}
          {!isCounter && o.city ? <span> · {o.city}</span> : null}
          {!isCounter ? (
            <span> · {isPickup ? t('cart.fulfillmentPickup') : t('cart.fulfillmentDelivery')}</span>
          ) : null}
        </p>

        {!isCounter ? (
          <div className="admin-order-badges">
            <span className={`admin-pay-pill ${paymentModeClass(o.payment_mode)}`}>
              {paymentModeLabel(o.payment_mode, t)}
            </span>
            <span className={`order-status-pill status-${customerStatus}`}>
              {t(`track.status_${customerStatus}`) || customerStatus}
            </span>
            {o.created_at ? (
              <span className="admin-order-time">{new Date(o.created_at).toLocaleString()}</span>
            ) : null}
          </div>
        ) : null}

        {!isCounter && (o.cancel_request_status === 'pending' || o.cancel_requested_at) ? (
          <AdminCancelRefundPanel order={o} onUpdated={onOrderUpdated} />
        ) : null}

        {isReturn && (o.original_order_ref || o.original_order_id) ? (
          <p className="admin-float-sub admin-order-return-link">
            {t('admin.orderReturnOf', { id: o.original_order_ref || o.original_order_id })}
            {o.refund_method ? ` · ${t('admin.orderRefundMethod')}: ${o.refund_method}` : ''}
            {o.return_reason ? ` · ${o.return_reason}` : ''}
          </p>
        ) : null}

        {hasLinkedReturns ? (
          <div className="admin-order-return-summary">
            <p className="admin-float-sub">
              <strong>{t('admin.orderHasReturn')}</strong>
              {' · '}
              {t('admin.returnedAmount')}: {formatPrice(returnedAmount)}
              {' · '}
              {t('admin.netAfterReturn')}: {formatPrice(netAfterReturn)}
            </p>
            <ul className="admin-order-return-summary__list">
              {linkedReturns.map((ret) => {
                const retProfit = orderProfitTotals(ret);
                return (
                  <li key={ret.id}>
                    #{ret.order_id || ret.id}
                    {' · '}
                    {t('admin.returnedAmount')}: {formatPrice(returnRefundAmount(ret))}
                    {' · '}
                    {t('sales.profitShort')}: {formatPrice(retProfit.profitTotal)}
                    {ret.created_at ? ` · ${new Date(ret.created_at).toLocaleString()}` : ''}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {isCounter ? (
          <p className="admin-float-sub">
            {isReturn ? t('admin.orderCounterReturnMeta') : t('admin.orderCounterSaleMeta')}
            {o.created_by_staff_name ? ` · ${o.created_by_staff_name}` : ''}
            {o.payment_mode ? ` · ${paymentModeLabel(o.payment_mode, t)}` : ''}
            {o.created_at ? ` · ${new Date(o.created_at).toLocaleString()}` : ''}
          </p>
        ) : null}

        {/* Address text only — no map */}
        {!isCounter && (addr || isPickup) ? (
          <div className="admin-order-address">
            <strong>{isPickup ? t('cart.fulfillmentPickup') : t('admin.deliveryAddress')}</strong>
            {isPickup ? (
              <p className="admin-float-sub">{t('cart.pickupHint')}</p>
            ) : (
              <p className="admin-float-sub">
                {addr?.name ? `${addr.name} · ` : null}
                {addr?.phone || o.phone || ''}
                {addressText ? (
                  <>
                    <br />
                    {addressText}
                  </>
                ) : null}
              </p>
            )}
          </div>
        ) : null}

        {!isCounter && o.payment_proof_url ? (
          <p className="admin-float-sub">
            {t('admin.paymentProof')}:{' '}
            <a href={o.payment_proof_url} target="_blank" rel="noopener noreferrer">
              {t('admin.viewScreenshot')}
            </a>
          </p>
        ) : null}
        {!isCounter && o.gmail ? <p className="admin-float-sub">Gmail: {o.gmail}</p> : null}

        {!isCounter && (o.postex_tracking || o.tracking_number) ? (
          <p className="admin-float-sub">
            {t('admin.postexTracking')}: {o.postex_tracking || o.tracking_number}
            {o.postex_status ? ` · ${o.postex_status}` : ''}
          </p>
        ) : null}
        {!isCounter && !o.postex_tracking && o.postex_last_error ? (
          <p className="admin-float-sub" style={{ color: 'var(--danger, #b91c1c)' }}>
            {t('admin.postexLastError')}: {o.postex_last_error}
          </p>
        ) : null}

        {!isCounter && o.rider_phone ? (
          <p className="admin-float-sub">
            {t('admin.riderPhone')}: {o.rider_phone}
            {Number(o.delivery_charge) > 0 &&
              ` · ${t('admin.deliveryCharge')}: ${formatPrice(o.delivery_charge)}`}
          </p>
        ) : null}

        <ul className="admin-float-items">
          {(o.items || []).map((item, idx) => {
            const { qty, saleLine, costLine, profitLine } = orderLineFinancials(item, { isReturn });
            return (
              <li key={idx}>
                {item.name} ×{qty}
                {item.price != null && (
                  <span className="admin-float-item-price"> — {formatPrice(saleLine)}</span>
                )}
                {Number(item.cost_price) > 0 && (
                  <span className="admin-float-item-cost">
                    {' '}
                    · {t('sales.costShort')}: {formatPrice(costLine)} · {t('sales.profitShort')}:{' '}
                    {formatPrice(profitLine)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="admin-float-sub admin-order-profit-line">
          {isReturn ? (
            <>
              {t('admin.returnedAmount')}: {formatPrice(refundAmount)}
              {' · '}
              {t('sales.costShort')}: {formatPrice(profitTotals.costTotal)}
              {' · '}
              {t('sales.profitShort')}: {formatPrice(profitTotals.profitTotal)}
            </>
          ) : (
            <>
              {Number(o.subtotal_amount) > 0 || Number(o.discount_amount) > 0 ? (
                <>
                  Subtotal {formatPrice(o.subtotal_amount || o.total_amount)}
                  {Number(o.discount_amount) > 0 ? ` · Discount ${formatPrice(o.discount_amount)}` : ''}
                  {` · Net ${formatPrice(o.total_amount)}`}
                </>
              ) : (
                <>
                  {t('admin.orderSoldTotal')}: {formatPrice(o.total_amount)}
                </>
              )}
              {Number(profitTotals.costTotal) !== 0 ? (
                <>
                  {' · '}
                  {t('sales.profitShort')}: {formatPrice(profitTotals.profitTotal)}
                </>
              ) : null}
              {hasLinkedReturns ? (
                <>
                  {' · '}
                  {t('admin.netAfterReturn')}: {formatPrice(netAfterReturn)}
                </>
              ) : null}
            </>
          )}
        </p>

        {/* Primary: Confirm COD / Mark Paid (wallets) + Book PostEx — no manual Ship/Rider */}
        {!isCounter && (needsPay || canBookPostEx) ? (
          <div className="admin-order-actions admin-order-actions--primary">
            {needsPay ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onMarkPaid(o.id)}>
                {o.payment_mode === 'cod' ? t('admin.confirmCod') : t('admin.markPaid')}
              </button>
            ) : null}
            {canBookPostEx ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={postexBusy}
                onClick={handleBookPostEx}
              >
                {postexBusy ? t('common.saving') : t('admin.postexBook')}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Cancel only — Ship/Rider/Done removed; PostEx tracking updates delivery */}
        {!isCounter && onUpdateStatus && o.shipping_status !== 'cancelled' ? (
          <div className="admin-order-actions admin-order-actions--status">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (window.confirm?.(t('admin.cancelOrderConfirm'))) {
                  onUpdateStatus(o.id, 'cancelled');
                }
              }}
            >
              {t('admin.cancelOrder')}
            </button>
          </div>
        ) : null}

        {/* Receipts — collapsed by default to reduce clutter */}
        <div className="admin-order-receipts">
          <button
            type="button"
            className="admin-order-receipts__toggle"
            onClick={() => setShowReceipts((v) => !v)}
          >
            {showReceipts ? '▾' : '▸'} {t('admin.receiptsPrint')}
          </button>
          {showReceipts ? (
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
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={receiptBusy}
                onClick={handleThermalPrint}
              >
                {isAndroid ? t('admin.counterBillPrintMate') : t('admin.counterBillPrint')}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={receiptBusy}
                onClick={handleShareReceipt}
              >
                {t('admin.orderShareThermal')}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={receiptBusy}
                onClick={() => downloadCounterInvoicePdf(o, thermalWidth)}
              >
                {t('admin.orderDownloadThermal')}
              </button>
            </div>
          ) : null}
        </div>

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
      {printChooser}
    </>
  );
}
