import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import './order-cancel-request.css';

function orderRef(order) {
  return String(order?.order_id || order?.id || '').replace(/^#/, '');
}

export default function OrderCancelRequest({ order, phone = '', onUpdated }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const view = useMemo(() => {
    if (!order) return null;
    const postexBooked = Boolean(
      order.postex_booked || order.cancel_postex_booked_at_request || order.postex_tracking
    );
    const canRequest =
      order.can_request_cancel !== false &&
      order.cancel_request_status !== 'pending' &&
      order.shipping_status !== 'cancelled' &&
      order.shipping_status !== 'delivered' &&
      order.shipping_status !== 'returned' &&
      order.source !== 'counter_sale' &&
      order.source !== 'counter_return';
    return {
      postexBooked,
      canRequest,
      pending: order.cancel_request_status === 'pending',
      approved: order.cancel_request_status === 'approved' || order.shipping_status === 'cancelled',
      isPrepaid: order.is_prepaid === true,
    };
  }, [order]);

  if (!order || !view) return null;

  if (view.pending) {
    return (
      <div className="ocr-banner ocr-banner--pending" role="status">
        {t('cancelRequest.pendingBanner')}
      </div>
    );
  }

  if (view.approved && order.shipping_status === 'cancelled') {
    return (
      <div className="ocr-banner ocr-banner--done" role="status">
        {order.cancel_refund_status === 'not_needed'
          ? t('cancelRequest.cancelledCodBanner')
          : t('cancelRequest.cancelledBanner')}
      </div>
    );
  }

  if (!view.canRequest) return null;

  const submit = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const result = await api.requestOrderCancel({
        orderId: orderRef(order),
        phone: phone || order.phone || '',
        reason,
      });
      setMsg(result.message || t('cancelRequest.success'));
      setOpen(false);
      onUpdated?.(
        result.order || {
          ...order,
          cancel_request_status: 'pending',
          can_request_cancel: false,
        }
      );
    } catch (e) {
      setErr(e.message || t('cancelRequest.failed'));
    } finally {
      setBusy(false);
    }
  };

  const modal = open
    ? createPortal(
        <div className="ocr-modal" role="dialog" aria-modal="true" aria-labelledby="ocr-title">
          <div className="ocr-modal__card">
            <h3 id="ocr-title">{t('cancelRequest.modalTitle')}</h3>
            <p className="ocr-modal__lead">{t('cancelRequest.modalLead')}</p>
            {/* Soft customer warning only — never mention courier fees / PostEx cuts */}
            {view.postexBooked ? (
              <p className="ocr-modal__warn">{t('cancelRequest.warnAfterCourier')}</p>
            ) : (
              <p className="ocr-modal__warn">{t('cancelRequest.warnSoft')}</p>
            )}
            <p className="ocr-modal__lead">{t('cancelRequest.refundSoft')}</p>
            <label className="ocr-modal__label" htmlFor="ocr-reason">
              {t('cancelRequest.reasonLabel')}
            </label>
            <textarea
              id="ocr-reason"
              rows={3}
              maxLength={400}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('cancelRequest.reasonPh')}
            />
            {err ? <p className="ocr-modal__err">{err}</p> : null}
            <div className="ocr-modal__actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
                {busy ? t('common.saving') : t('cancelRequest.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="ocr-wrap">
      {msg ? <p className="ocr-msg">{msg}</p> : null}
      <button type="button" className="btn btn-outline btn-sm ocr-btn" onClick={() => setOpen(true)}>
        {t('cancelRequest.button')}
      </button>
      {modal}
    </div>
  );
}
