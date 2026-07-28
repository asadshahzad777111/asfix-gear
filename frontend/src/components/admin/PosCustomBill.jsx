import { useCallback, useMemo, useState } from 'react';
import { formatPrice } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';
import { isNativePosApp, getSavedPrinter } from '../../utils/nativePosPrint';
import { normalizePrintResult } from './AdminCounterBill';

const STORAGE_KEY = 'asfix_pos_custom_bill_v1';

const DEFAULT_ITEMS = [
  { id: '1', name: 'Body + Body Structure', rate: 2500 },
  { id: '2', name: 'SIM Jack', rate: 200 },
  { id: '3', name: 'Button', rate: 200 },
  { id: '4', name: 'Mobile Panel A+ (1st copy)', rate: 2800 },
];

function tomorrowLocalParts() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return {
    dateInput: `${yyyy}-${mm}-${dd}`,
    timeInput: '10:00',
  };
}

function formatReceiptDateLabel(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(`${dateInput}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateInput;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatReceiptTimeLabel(timeInput) {
  if (!timeInput) return '-';
  const [hh = '00', mi = '00'] = String(timeInput).split(':');
  return `${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function loadSavedDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function newItem() {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', rate: '' };
}

function buildDefaults() {
  const t = tomorrowLocalParts();
  return {
    shopName: 'Osama Center',
    shopPlace: 'Trade World',
    shopPhone: '',
    dateInput: t.dateInput,
    timeInput: t.timeInput,
    mobileName: 'Infinix Smart 5',
    customerName: '',
    notes: '',
    items: DEFAULT_ITEMS.map((row) => ({ ...row })),
  };
}

export function buildCustomBillOrder(draft) {
  const items = (draft.items || [])
    .map((row) => ({
      name: String(row.name || '').trim() || 'Item',
      qty: 1,
      price: Math.max(0, Number(row.rate) || 0),
    }))
    .filter((row) => row.name || row.price > 0);

  const total = items.reduce((sum, row) => sum + row.price * row.qty, 0);
  const dateLabel = formatReceiptDateLabel(draft.dateInput);
  const timeLabel = formatReceiptTimeLabel(draft.timeInput);
  const createdAt = (() => {
    const iso = new Date(`${draft.dateInput || ''}T${draft.timeInput || '00:00'}:00`);
    return Number.isNaN(iso.getTime()) ? new Date().toISOString() : iso.toISOString();
  })();

  return {
    order_id: `CB-${Date.now().toString(36).toUpperCase()}`,
    id: undefined,
    created_at: createdAt,
    receipt_date: dateLabel,
    receipt_time: timeLabel,
    customer_name: String(draft.customerName || '').trim() || 'Walk-in',
    phone: '',
    payment_mode: 'cash',
    device_name: String(draft.mobileName || '').trim(),
    notes: String(draft.notes || '').trim(),
    custom_receipt: true,
    shop_name: String(draft.shopName || '').trim() || 'Shop',
    shop_place: String(draft.shopPlace || '').trim(),
    shop_phone: String(draft.shopPhone || '').trim(),
    items,
    total_amount: total,
    discount_amount: 0,
  };
}

export default function PosCustomBill({
  onPrintOrder,
  onOpenPrinterSetup,
}) {
  const { t } = useTranslation();
  const nativePos = isNativePosApp();
  const [draft, setDraft] = useState(() => {
    const saved = loadSavedDraft();
    return saved ? { ...buildDefaults(), ...saved, items: saved.items?.length ? saved.items : buildDefaults().items } : buildDefaults();
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const total = useMemo(
    () => (draft.items || []).reduce((sum, row) => sum + (Number(row.rate) || 0), 0),
    [draft.items],
  );

  const persist = useCallback((next) => {
    setDraft(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  const updateField = useCallback((key, value) => {
    persist({ ...draft, [key]: value });
  }, [draft, persist]);

  const updateItem = useCallback((id, patch) => {
    persist({
      ...draft,
      items: draft.items.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  }, [draft, persist]);

  const addItem = useCallback(() => {
    persist({ ...draft, items: [...draft.items, newItem()] });
  }, [draft, persist]);

  const removeItem = useCallback((id) => {
    persist({
      ...draft,
      items: draft.items.length <= 1 ? draft.items : draft.items.filter((row) => row.id !== id),
    });
  }, [draft, persist]);

  const resetDefaults = useCallback(() => {
    const next = buildDefaults();
    persist(next);
    setFeedback({ type: 'ok', text: t('counter.customBillResetOk') });
  }, [persist, t]);

  const printBill = useCallback(async () => {
    const order = buildCustomBillOrder(draft);
    if (!order.items.length) {
      setFeedback({ type: 'error', text: t('counter.customBillNeedItems') });
      return;
    }
    if (nativePos) {
      const saved = await getSavedPrinter();
      if (!saved?.address) {
        onOpenPrinterSetup?.();
        setFeedback({ type: 'error', text: t('admin.counterBillNativePrintFailed') });
        return;
      }
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = normalizePrintResult(await onPrintOrder?.(order));
      if (result.ok) {
        setFeedback({ type: 'ok', text: t('counter.customBillPrintOk') });
      } else {
        setFeedback({
          type: 'error',
          text: result.message || t('admin.counterBillNativePrintFailed'),
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err?.message || t('admin.counterBillNativePrintFailed') });
    } finally {
      setBusy(false);
    }
  }, [draft, nativePos, onOpenPrinterSetup, onPrintOrder, t]);

  return (
    <section className="pos-custom-bill wp-postbox">
      <div className="wp-postbox-head pos-custom-bill__head">
        <strong>{t('counter.customBillTitle')}</strong>
        <span>{t('counter.customBillHint')}</span>
      </div>

      <div className="pos-custom-bill__grid">
        <label>
          <span>{t('counter.customBillShop')}</span>
          <input
            value={draft.shopName}
            onChange={(e) => updateField('shopName', e.target.value)}
            autoComplete="organization"
          />
        </label>
        <label>
          <span>{t('counter.customBillPlace')}</span>
          <input
            value={draft.shopPlace}
            onChange={(e) => updateField('shopPlace', e.target.value)}
          />
        </label>
        <label>
          <span>{t('counter.customBillPhone')}</span>
          <input
            value={draft.shopPhone}
            onChange={(e) => updateField('shopPhone', e.target.value)}
            inputMode="tel"
          />
        </label>
        <label>
          <span>{t('admin.counterBillDate')}</span>
          <input
            type="date"
            value={draft.dateInput}
            onChange={(e) => updateField('dateInput', e.target.value)}
          />
        </label>
        <label>
          <span>{t('counter.customBillTime')}</span>
          <input
            type="time"
            value={draft.timeInput}
            onChange={(e) => updateField('timeInput', e.target.value)}
          />
        </label>
        <label>
          <span>{t('counter.customBillMobile')}</span>
          <input
            value={draft.mobileName}
            onChange={(e) => updateField('mobileName', e.target.value)}
            placeholder="Infinix Smart 5"
          />
        </label>
        <label className="pos-custom-bill__full">
          <span>{t('admin.counterBillCustomer')}</span>
          <input
            value={draft.customerName}
            onChange={(e) => updateField('customerName', e.target.value)}
            placeholder={t('admin.counterBillCustomerPh')}
          />
        </label>
      </div>

      <div className="pos-custom-bill__items">
        <div className="pos-custom-bill__items-head">
          <strong>{t('counter.customBillItems')}</strong>
          <button type="button" className="wp-button wp-button--secondary" onClick={addItem}>
            + {t('counter.customBillAddItem')}
          </button>
        </div>
        <ul>
          {draft.items.map((row) => (
            <li key={row.id}>
              <input
                className="pos-custom-bill__item-name"
                value={row.name}
                onChange={(e) => updateItem(row.id, { name: e.target.value })}
                placeholder={t('counter.customBillItemName')}
              />
              <input
                className="pos-custom-bill__item-rate"
                type="number"
                min="0"
                step="1"
                value={row.rate}
                onChange={(e) => updateItem(row.id, { rate: e.target.value })}
                placeholder="0"
              />
              <button
                type="button"
                className="pos-custom-bill__remove"
                onClick={() => removeItem(row.id)}
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label className="pos-custom-bill__notes">
        <span>{t('counter.customBillNotes')}</span>
        <textarea
          value={draft.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={2}
          placeholder={t('counter.customBillNotesPh')}
        />
      </label>

      <div className="pos-custom-bill__total">
        <span>{t('admin.counterBillTotal')}</span>
        <strong>{formatPrice(total)}</strong>
      </div>

      {feedback ? (
        <p className={`pos-custom-bill__feedback pos-custom-bill__feedback--${feedback.type}`}>
          {feedback.text}
        </p>
      ) : null}

      <div className="pos-custom-bill__actions">
        <button type="button" className="wp-button wp-button--secondary" onClick={resetDefaults} disabled={busy}>
          {t('counter.customBillReset')}
        </button>
        <button
          type="button"
          className="wp-button counter-bill__print-cta pos-custom-bill__print"
          onClick={() => void printBill()}
          disabled={busy || total <= 0}
        >
          {busy ? t('common.loading') : t('counter.customBillPrint')}
        </button>
      </div>
    </section>
  );
}
