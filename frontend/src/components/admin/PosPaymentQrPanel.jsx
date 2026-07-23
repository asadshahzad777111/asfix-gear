import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import {
  enabledPosPaymentQrCards,
  formatPaymentDisplayNumber,
  mergePosPaymentQrCards,
} from '../../config/posPaymentQr';
import { buildPaymentQrDataUrl, printPaymentQrSlip } from '../../utils/paymentQrPrint';
import './pos-payment-qr.css';

/**
 * POS / admin panel: list wallet & bank QRs, print one slip at a time.
 * Portaled to body so it sits above the POS dock; dock is hidden while open.
 */
export default function PosPaymentQrPanel({
  open,
  onClose,
  thermalWidth = '58mm',
  title = 'Payment QR slips',
}) {
  const [cards, setCards] = useState(() => mergePosPaymentQrCards());
  const [previews, setPreviews] = useState({});
  const [busyId, setBusyId] = useState('');
  const [msg, setMsg] = useState('');

  const list = useMemo(() => enabledPosPaymentQrCards(cards), [cards]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    api
      .getPaymentSettings()
      .then((pay) => {
        if (cancelled) return;
        setCards(mergePosPaymentQrCards(pay?.posQrCards));
      })
      .catch(() => {
        if (!cancelled) setCards(mergePosPaymentQrCards());
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || list.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const card of list) {
        try {
          next[card.id] = await buildPaymentQrDataUrl(card, 160);
        } catch {
          next[card.id] = '';
        }
      }
      if (!cancelled) setPreviews(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, list]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.classList.add('pos-modal-open');
    body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      body.classList.remove('pos-modal-open');
      body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const onPrint = async (card) => {
    setBusyId(card.id);
    setMsg('');
    try {
      const result = await printPaymentQrSlip(card, { thermalWidth });
      if (!result?.ok) {
        setMsg(result?.message || 'Print failed');
      } else {
        setMsg(`Printed: ${card.label || card.method}`);
      }
    } catch (err) {
      setMsg(err?.message || 'Print failed');
    } finally {
      setBusyId('');
    }
  };

  return createPortal(
    <div
      className="pos-pay-qr-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="pos-pay-qr-panel">
        <header className="pos-pay-qr-panel__head">
          <div>
            <h2>{title}</h2>
            <p>
              Staff screen pe naam dikhega. Print pe naam upar tear strip mein hai — customer wale hisse
              mein naam nahi. List scroll karke har Print dabao (neeche dock hide).
            </p>
          </div>
          <button type="button" className="wp-button wp-button--secondary" onClick={onClose}>
            Close
          </button>
        </header>

        {msg ? <p className="pos-pay-qr-panel__msg">{msg}</p> : null}

        <ul className="pos-pay-qr-list">
          {list.map((card) => (
            <li key={card.id} className="pos-pay-qr-card">
              <div className="pos-pay-qr-card__preview">
                {previews[card.id] ? (
                  <img src={previews[card.id]} alt="" width={120} height={120} />
                ) : (
                  <div className="pos-pay-qr-card__placeholder">QR…</div>
                )}
              </div>
              <div className="pos-pay-qr-card__body">
                <strong className="pos-pay-qr-card__method">{card.label || card.method}</strong>
                <span className="pos-pay-qr-card__number">
                  {formatPaymentDisplayNumber(card.number || card.iban || card.payload)}
                </span>
                {card.accountName ? (
                  <span className="pos-pay-qr-card__name" title="Staff only — not on customer slip body">
                    Staff: {card.accountName}
                  </span>
                ) : null}
                {card.accountNumber ? (
                  <span className="pos-pay-qr-card__meta">A/C {card.accountNumber}</span>
                ) : null}
              </div>
              <button
                type="button"
                className="wp-button pos-pay-qr-card__print"
                disabled={Boolean(busyId)}
                onClick={() => onPrint(card)}
                aria-label={`Print ${card.label || card.method}`}
              >
                {busyId === card.id ? 'Printing…' : 'Print'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
