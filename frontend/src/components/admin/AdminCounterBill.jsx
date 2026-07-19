import { useMemo, useState } from 'react';
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

export default function AdminCounterBill({ products, onBillCreated }) {
  const { t } = useTranslation();
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
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || t('admin.counterBillFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
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
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.counterBillSearchPh')}
              autoComplete="off"
            />
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
          {lines.length === 0 ? (
            <p className="counter-bill__empty">{t('admin.counterBillEmptyState')}</p>
          ) : (
            <div className="counter-bill__lines">
              {lines.map((line) => {
                const unit = salePrice(line.product);
                return (
                  <div key={line.product.id} className="counter-bill__line">
                    <div>
                      <strong>{line.product.name}</strong>
                      <small>{formatPrice(unit)} each</small>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={Number(line.product.stock) || 1}
                      step="1"
                      value={line.qty}
                      onChange={(e) => setQty(line.product.id, e.target.value)}
                      aria-label={`${line.product.name} quantity`}
                    />
                    <strong>{formatPrice(unit * line.qty)}</strong>
                    <button type="button" onClick={() => removeLine(line.product.id)}>
                      {t('admin.counterBillRemove')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

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
              <button type="button" className="wp-button" onClick={printReceipt}>
                {t('admin.counterBillPrint')}
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {receiptOrder ? (
        <section className="counter-bill__receipt">
          <div className="counter-bill-print" aria-label={t('admin.counterBillReceipt')}>
            <div className="counter-bill-print__shop">
              <h2>{SHOP.name}</h2>
              <p>{SHOP.addressLine1}</p>
              <p>{SHOP.addressLine2} | {SHOP.phone}</p>
            </div>
            <div className="counter-bill-print__meta">
              <span>{t('admin.counterBillNo')}: {receiptOrder.order_id || receiptOrder.id}</span>
              <span>{t('admin.counterBillDate')}: {new Date(receiptOrder.created_at).toLocaleString()}</span>
              <span>
                {t('admin.counterBillPayment')}: {paymentLabel(receiptOrder.payment_mode)}
                {paymentNote ? ` (${paymentNote})` : ''}
              </span>
              <span>{t('admin.counterBillCustomer')}: {receiptOrder.customer_name || 'Walk-in Customer'}</span>
              {receiptOrder.phone ? <span>{t('admin.counterBillPhone')}: {receiptOrder.phone}</span> : null}
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t('admin.counterBillItem')}</th>
                  <th>{t('admin.counterBillQty')}</th>
                  <th>{t('admin.counterBillRate')}</th>
                  <th>{t('admin.counterBillAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {receiptOrder.items.map((item, index) => (
                  <tr key={`${item.product_id}-${index}`}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td>{formatPrice(item.price)}</td>
                    <td>{formatPrice(Number(item.price) * Number(item.qty || 1))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>{t('admin.counterBillTotal')}</td>
                  <td>{formatPrice(receiptOrder.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="counter-bill-print__thanks">{t('admin.counterBillThanks')}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
