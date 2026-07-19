import { useMemo, useRef, useState } from 'react';
import { api, formatPrice } from '../../api/client';
import { SHOP } from '../../config/shop';
import { useTranslation } from '../../context/LanguageContext';
import './admin-counter-bill.css';

function salePrice(product) {
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) return 0;
  const discount = Math.min(90, Math.max(0, Number(product.discount_percent) || 0));
  return Math.round(price * (1 - discount / 100));
}

function matchesQuery(product, query) {
  const term = query.trim().toLowerCase();
  if (!term) return false;
  return [
    product.name,
    product.brand,
    product.category,
    product.compatible_models,
    String(product.id),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term);
}

function paymentLabel(mode) {
  const labels = {
    cash: 'Cash',
    card: 'Card',
    jazzcash: 'JazzCash',
    easypaisa: 'EasyPaisa',
    bank: 'Bank',
    cod: 'Cash',
    other: 'Other',
  };
  return labels[mode] || mode;
}

export function CounterBillReceipt({ order, printable = false }) {
  const { t } = useTranslation();
  if (!order) return null;

  const paymentNote = String(order.notes || '').startsWith('Counter sale payment note:')
    ? String(order.notes).replace('Counter sale payment note:', '').trim()
    : '';

  return (
    <div
      className={`counter-bill-print${printable ? ' counter-bill-print--active' : ''}`}
      aria-label={t('admin.counterBillReceipt')}
    >
      <div className="counter-bill-print__shop">
        <h2>{SHOP.name}</h2>
        <p>{SHOP.addressLine1}</p>
        <p>{SHOP.addressLine2} | {SHOP.phone}</p>
      </div>
      <div className="counter-bill-print__meta">
        <span>{t('admin.counterBillNo')}: {order.order_id || order.id}</span>
        <span>{t('admin.counterBillDate')}: {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</span>
        <span>
          {t('admin.counterBillPayment')}: {paymentLabel(order.payment_mode)}
          {paymentNote ? ` (${paymentNote})` : ''}
        </span>
        <span>{t('admin.counterBillCustomer')}: {order.customer_name || 'Walk-in Customer'}</span>
        {order.phone ? <span>{t('admin.counterBillPhone')}: {order.phone}</span> : null}
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{t('admin.counterBillItem')}</th>
            <th>{t('admin.counterBillQty')}</th>
            <th>{t('admin.counterBillRate')}</th>
            <th>{t('admin.counterBillAmount')}</th>
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((item, index) => (
            <tr key={`${item.product_id}-${index}`}>
              <td>{index + 1}</td>
              <td>{item.name}</td>
              <td>{item.qty}</td>
              <td>{formatPrice(item.price)}</td>
              <td>{formatPrice(Number(item.price) * Number(item.qty || 1))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>{t('admin.counterBillTotal')}</td>
            <td>{formatPrice(order.total_amount)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="counter-bill-print__thanks">{t('admin.counterBillThanks')}</p>
    </div>
  );
}

export default function AdminCounterBill({ products, onBillCreated, onPrintOrder }) {
  const { t } = useTranslation();
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);

  const availableProducts = useMemo(() => {
    return products
      .filter((p) => (p.status || 'published') === 'published' && Number(p.stock) > 0)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [products]);

  const results = useMemo(() => {
    const matches = availableProducts.filter((p) => matchesQuery(p, query)).slice(0, 12);
    return matches;
  }, [availableProducts, query]);

  const total = lines.reduce((sum, line) => sum + salePrice(line.product) * line.qty, 0);

  const addProduct = (product) => {
    setReceiptOrder(null);
    setFeedback(null);
    setLines((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, qty: Math.min(Number(product.stock) || 1, line.qty + 1) }
            : line
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    setQuery('');
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter' || !results[0]) return;
    e.preventDefault();
    addProduct(results[0]);
  };

  const setQty = (productId, value) => {
    setReceiptOrder(null);
    const raw = Number(value);
    setLines((prev) =>
      prev.map((line) => {
        if (line.product.id !== productId) return line;
        const max = Math.max(1, Number(line.product.stock) || 1);
        const qty = Number.isFinite(raw) ? Math.min(max, Math.max(1, Math.floor(raw))) : 1;
        return { ...line, qty };
      })
    );
  };

  const removeLine = (productId) => {
    setReceiptOrder(null);
    setLines((prev) => prev.filter((line) => line.product.id !== productId));
  };

  const resetBill = () => {
    setLines([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMode('cash');
    setPaymentNote('');
    setFeedback(null);
    setReceiptOrder(null);
  };

  const confirmBill = async () => {
    if (!lines.length) {
      setFeedback({ type: 'error', text: t('admin.counterBillEmpty') });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await api.createCounterSale({
        customer_name: customerName,
        phone: customerPhone,
        payment_mode: paymentMode,
        payment_note: paymentNote,
        items: lines.map((line) => ({
          product_id: line.product.id,
          qty: line.qty,
        })),
      });
      setReceiptOrder(result.order);
      setFeedback({ type: 'success', text: t('admin.counterBillCreated') });
      onBillCreated?.(result.order);
      window.setTimeout(() => printReceipt(result.order), 150);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || t('admin.counterBillFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = (order = receiptOrder) => {
    if (!order) return;
    if (onPrintOrder) {
      onPrintOrder(order);
      return;
    }
    window.print();
  };

  return (
    <div className="counter-bill">
      <div className="counter-bill__head">
        <div>
          <h3>{t('admin.counterBillTitle')}</h3>
          <p>{t('admin.counterBillSub')}</p>
        </div>
        <div className="counter-bill__shop">
          <strong>{SHOP.name}</strong>
          <span>{SHOP.fullAddress}</span>
          <span>{SHOP.phone}</span>
        </div>
      </div>

      {feedback ? (
        <div className={`counter-bill__feedback counter-bill__feedback--${feedback.type}`} role="status">
          {feedback.text}
        </div>
      ) : null}

      <div className="counter-bill__grid">
        <section className="counter-bill__panel">
          <h4>{t('admin.counterBillProducts')}</h4>
          <label className="counter-bill__search">
            <span>{t('admin.counterBillSearch')}</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('admin.counterBillSearchPh')}
              autoComplete="off"
            />
            <small>{t('admin.counterBillSearchHint')}</small>
          </label>

          <div className="counter-bill__results">
            {query.trim() && results.length === 0 ? (
              <p className="counter-bill__empty">{t('admin.counterBillNoMatch')}</p>
            ) : null}
            {results.map((product) => (
              <button
                key={product.id}
                type="button"
                className="counter-bill__result"
                onClick={() => addProduct(product)}
              >
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.category || product.brand || `#${product.id}`}</small>
                </span>
                <span>
                  <strong>{formatPrice(salePrice(product))}</strong>
                  <small>{t('admin.stockLabel', { count: Number(product.stock) || 0 })}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="counter-bill__panel">
          <h4>{t('admin.counterBillCart')}</h4>
          <div className="counter-bill__lines counter-bill__sheet">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('admin.counterBillItem')}</th>
                  <th>{t('admin.counterBillQty')}</th>
                  <th>{t('admin.counterBillRate')}</th>
                  <th>{t('admin.counterBillAmount')}</th>
                  <th>{t('admin.counterBillRemove')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="counter-bill__empty-cell">
                      {t('admin.counterBillEmptyState')}
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => {
                    const unit = salePrice(line.product);
                    return (
                      <tr key={line.product.id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{line.product.name}</strong>
                          <small>{formatPrice(unit)} each · {t('admin.stockLabel', { count: Number(line.product.stock) || 0 })}</small>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            max={Number(line.product.stock) || 1}
                            step="1"
                            value={line.qty}
                            onChange={(e) => setQty(line.product.id, e.target.value)}
                            aria-label={`${line.product.name} quantity`}
                          />
                        </td>
                        <td>{formatPrice(unit)}</td>
                        <td>{formatPrice(unit * line.qty)}</td>
                        <td>
                          <button type="button" onClick={() => removeLine(line.product.id)}>
                            {t('admin.counterBillRemove')}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="counter-bill__customer">
            <label>
              <span>{t('admin.counterBillCustomer')}</span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('admin.counterBillCustomerPh')}
                maxLength={120}
              />
            </label>
            <label>
              <span>{t('admin.counterBillPhone')}</span>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t('admin.counterBillPhonePh')}
                maxLength={30}
              />
            </label>
            <label>
              <span>{t('admin.counterBillPayment')}</span>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="bank">Bank</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="counter-bill__note">
              <span>{t('admin.counterBillPaymentNote')}</span>
              <input
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder={t('admin.counterBillPaymentNotePh')}
                maxLength={500}
              />
            </label>
          </div>

          <div className="counter-bill__footer">
            <div className="counter-bill__total">
              <span>{t('admin.counterBillTotal')}</span>
              <strong>{formatPrice(total)}</strong>
            </div>

            <div className="counter-bill__actions">
              <button type="button" className="wp-button wp-button--secondary" onClick={resetBill}>
                {t('admin.counterBillReset')}
              </button>
              <button type="button" className="wp-button" onClick={confirmBill} disabled={submitting || !lines.length}>
                {submitting ? t('common.saving') : t('admin.counterBillConfirm')}
              </button>
              {receiptOrder ? (
                <button type="button" className="wp-button counter-bill__print-cta" onClick={() => printReceipt()}>
                  {t('admin.counterBillPrintNow')}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {receiptOrder ? (
        <section className="counter-bill__receipt">
          <div className="counter-bill__receipt-head">
            <strong>{t('admin.counterBillSavedReady')}</strong>
            <button type="button" className="wp-button counter-bill__print-cta" onClick={() => printReceipt()}>
              {t('admin.counterBillPrintNow')}
            </button>
          </div>
          <CounterBillReceipt order={receiptOrder} printable={!onPrintOrder} />
        </section>
      ) : null}
    </div>
  );
}
