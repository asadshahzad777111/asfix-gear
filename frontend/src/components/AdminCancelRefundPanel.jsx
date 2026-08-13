import { useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { compressImageForUpload } from '../utils/compressImage';
import './order-cancel-request.css';

const REFUND_STATUSES = [
  { id: 'not_needed', labelKey: 'admin.cancelRefundNotNeeded' },
  { id: 'pending', labelKey: 'admin.cancelRefundPending' },
  { id: 'sent', labelKey: 'admin.cancelRefundSent' },
  { id: 'partial', labelKey: 'admin.cancelRefundPartial' },
];

/**
 * Staff-only cancel/refund panel. PostEx fee/cut language stays here — never on customer UI.
 */
export default function AdminCancelRefundPanel({ order, onUpdated }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState('');
  const [refundStatus, setRefundStatus] = useState(order.cancel_refund_status || 'pending');
  const [refundAmount, setRefundAmount] = useState(
    order.cancel_refund_amount != null ? String(order.cancel_refund_amount) : String(order.total_amount || '')
  );
  const [staffNote, setStaffNote] = useState(order.cancel_staff_note || '');
  const [msg, setMsg] = useState('');

  if (!order?.cancel_requested_at && order?.cancel_request_status !== 'pending') {
    return null;
  }

  const postexBooked = Boolean(
    order.cancel_postex_booked_at_request || order.postex_tracking || order.tracking_number
  );
  const payMode = String(order.payment_mode || '').toLowerCase();
  const isCod = payMode === 'cod' || payMode === 'cash';
  const isSafepay =
    payMode === 'safepay' || payMode === 'safe_pay' || payMode === 'card' || payMode === 'online';
  const isPrepaid = !isCod;
  const repeat = Boolean(order.cancel_repeat_flag) || Number(order.cancel_recent_count_7d) >= 2;
  const pending = order.cancel_request_status === 'pending';
  const approved = order.cancel_request_status === 'approved' || order.shipping_status === 'cancelled';

  const refresh = (next) => {
    onUpdated?.(next);
    if (next?.cancel_refund_status) setRefundStatus(next.cancel_refund_status);
    if (next?.cancel_refund_amount != null) setRefundAmount(String(next.cancel_refund_amount));
    if (next?.cancel_staff_note != null) setStaffNote(next.cancel_staff_note);
  };

  const approve = async () => {
    setBusy('approve');
    setMsg('');
    try {
      const r = await api.approveOrderCancelRequest(order.id, {
        refund_status: refundStatus,
        refund_amount: refundAmount,
        staff_note: staffNote,
      });
      refresh(r.order);
      setMsg(t('admin.cancelApprovedOk'));
    } catch (err) {
      setMsg(err.message || t('admin.cancelActionFail'));
    } finally {
      setBusy('');
    }
  };

  const dismiss = async () => {
    if (!window.confirm?.(t('admin.cancelDismissConfirm'))) return;
    setBusy('dismiss');
    setMsg('');
    try {
      const r = await api.dismissOrderCancelRequest(order.id, { staff_note: staffNote });
      refresh(r.order);
      setMsg(t('admin.cancelDismissedOk'));
    } catch (err) {
      setMsg(err.message || t('admin.cancelActionFail'));
    } finally {
      setBusy('');
    }
  };

  const saveRefund = async (notifyCustomer = false) => {
    setBusy(notifyCustomer ? 'notify' : 'save');
    setMsg('');
    try {
      const r = await api.updateOrderCancelRefund(order.id, {
        refund_status: refundStatus,
        refund_amount: refundAmount,
        staff_note: staffNote,
        notify_customer: notifyCustomer,
      });
      refresh(r.order);
      setMsg(
        notifyCustomer
          ? t('admin.cancelRefundNotified')
          : t('admin.cancelRefundSaved')
      );
    } catch (err) {
      setMsg(err.message || t('admin.cancelActionFail'));
    } finally {
      setBusy('');
    }
  };

  const onProof = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('proof');
    setMsg('');
    try {
      const compressed = await compressImageForUpload(file, 200 * 1024);
      if (!compressed) throw new Error(t('admin.cancelProofTooLarge'));
      const r = await api.uploadCancelRefundProof(order.id, compressed);
      refresh(r.order);
      setMsg(t('admin.cancelProofSaved'));
    } catch (err) {
      setMsg(err.message || t('admin.cancelActionFail'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={`admin-cancel-req${postexBooked ? ' admin-cancel-req--postex' : ''}`}>
      <p className="admin-cancel-req__title">
        {t('admin.cancelRequestTitle')}
        {repeat ? <span className="admin-cancel-badge">{t('admin.cancelRepeatBadge')}</span> : null}
        {postexBooked ? (
          <span className="admin-cancel-badge admin-cancel-badge--postex">{t('admin.cancelPostexBadge')}</span>
        ) : null}
        {isCod ? (
          <span className="admin-cancel-badge">{t('admin.cancelPayCodBadge')}</span>
        ) : isSafepay ? (
          <span className="admin-cancel-badge admin-cancel-badge--postex">{t('admin.cancelPaySafepayBadge')}</span>
        ) : (
          <span className="admin-cancel-badge admin-cancel-badge--postex">{t('admin.cancelPayPrepaidBadge')}</span>
        )}
      </p>
      <p className="admin-cancel-req__meta">
        {order.cancel_request_reason
          ? `${t('admin.cancelReason')}: ${order.cancel_request_reason}`
          : t('admin.cancelNoReason')}
        <br />
        {t('admin.cancelPaymentMode')}: <strong>{order.payment_mode || '—'}</strong>
        {isPrepaid ? ` · ${t('admin.cancelPrepaidHint')}` : ` · ${t('admin.cancelCodHint')}`}
        {postexBooked ? (
          <>
            <br />
            {t('admin.cancelPostexStaffNote')}
          </>
        ) : (
          <>
            <br />
            {t('admin.cancelBeforePostexNote')}
          </>
        )}
        <br />
        {t('admin.cancelSettlementNote')}
      </p>

      {isPrepaid ? (
        <div className="admin-cancel-req__meta" style={{ marginBottom: 10 }}>
          <strong>{t('admin.cancelSafepayTitle')}</strong>
          <br />
          {isSafepay ? t('admin.cancelSafepaySteps') : t('admin.cancelManualPrepaidSteps')}
          <br />
          <a
            href="https://getsafepay.com/dashboard/login"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('admin.cancelSafepayOpen')}
          </a>
          {' · '}
          <a
            href="https://safepay.helpscoutdocs.com/article/141-how-to-refund-car-new"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('admin.cancelSafepayHelp')}
          </a>
        </div>
      ) : null}

      <label className="ocr-modal__label" htmlFor={`cr-status-${order.id}`}>
        {t('admin.cancelRefundStatus')}
      </label>
      <select
        id={`cr-status-${order.id}`}
        value={refundStatus}
        onChange={(e) => setRefundStatus(e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
      >
        {REFUND_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {t(s.labelKey)}
          </option>
        ))}
      </select>

      <label className="ocr-modal__label" htmlFor={`cr-amt-${order.id}`}>
        {t('admin.cancelRefundAmount')}
      </label>
      <input
        id={`cr-amt-${order.id}`}
        type="number"
        min="0"
        step="1"
        value={refundAmount}
        onChange={(e) => setRefundAmount(e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
      />

      <label className="ocr-modal__label" htmlFor={`cr-note-${order.id}`}>
        {t('admin.cancelStaffNote')}
      </label>
      <textarea
        id={`cr-note-${order.id}`}
        rows={2}
        value={staffNote}
        onChange={(e) => setStaffNote(e.target.value)}
        placeholder={t('admin.cancelStaffNotePh')}
        style={{ width: '100%', marginBottom: 8 }}
      />

      {order.cancel_refund_proof_url ? (
        <p className="admin-cancel-req__meta">
          <a href={order.cancel_refund_proof_url} target="_blank" rel="noopener noreferrer">
            {t('admin.cancelProofView')}
          </a>
        </p>
      ) : null}

      <div className="admin-cancel-req__actions">
        {pending ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={approve}>
              {busy === 'approve' ? t('common.saving') : t('admin.cancelApprove')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={dismiss}>
              {busy === 'dismiss' ? t('common.saving') : t('admin.cancelDismiss')}
            </button>
          </>
        ) : null}
        {approved || pending ? (
          <>
            <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => saveRefund(false)}>
              {busy === 'save' ? t('common.saving') : t('admin.cancelSaveRefund')}
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => saveRefund(true)}>
              {busy === 'notify' ? t('common.saving') : t('admin.cancelNotifyCustomer')}
            </button>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              {busy === 'proof' ? t('common.saving') : t('admin.cancelUploadProof')}
              <input type="file" accept="image/*" hidden onChange={onProof} disabled={!!busy} />
            </label>
          </>
        ) : null}
      </div>
      {msg ? <p className="admin-cancel-req__meta">{msg}</p> : null}
    </div>
  );
}
