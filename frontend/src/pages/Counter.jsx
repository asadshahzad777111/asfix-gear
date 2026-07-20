import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, formatPrice } from '../api/client';
import AdminCounterBill, {
  CounterBillReceipt,
  downloadCounterInvoicePdf,
  printActiveCounterReceipt,
  readThermalReceiptWidth,
  shareCounterInvoicePdf,
} from '../components/admin/AdminCounterBill';
import { SHOP } from '../config/shop';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import '../components/admin/admin-wp.css';
import '../components/admin/admin-counter-bill.css';

function saleHasReceiptItems(sale) {
  return Array.isArray(sale?.items) && sale.items.length > 0;
}

function counterSaleDate(sale, fallbackDate) {
  if (!sale?.created_at) return fallbackDate;
  const timestamp = new Date(sale.created_at);
  return Number.isNaN(timestamp.getTime()) ? fallbackDate : timestamp.toISOString().slice(0, 10);
}

const DEFAULT_POS_SETTINGS = {
  posReturnWindowHours: 24,
  posDiscountMaxPercentWithoutPin: 10,
  posDiscountMaxAmountWithoutPin: 500,
};

export default function Counter() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [posSettings, setPosSettings] = useState(DEFAULT_POS_SETTINGS);
  const [returnSale, setReturnSale] = useState(null);
  const [returnQty, setReturnQty] = useState({});
  const [returnMethod, setReturnMethod] = useState('cash');
  const [returnReason, setReturnReason] = useState('');
  const [returnFeedback, setReturnFeedback] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [printJob, setPrintJob] = useState(null);
  const [thermalWidth, setThermalWidth] = useState(() => readThermalReceiptWidth());
  const [loading, setLoading] = useState(true);
  const printInFlightRef = useRef(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadCounterData = async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const [productData, salesData] = await Promise.all([
        api.getProducts(),
        api.getCounterSales({ date: today }),
      ]);
      setProducts(productData);
      setSales(salesData);
      api.getPosSettings()
        .then((settings) => setPosSettings({ ...DEFAULT_POS_SETTINGS, ...(settings || {}) }))
        .catch(() => setPosSettings(DEFAULT_POS_SETTINGS));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadCounterData();
  }, []);

  useEffect(() => {
    if (!printJob?.order) return undefined;

    let cancelled = false;
    (async () => {
      await printActiveCounterReceipt({ thermalWidth, inFlightRef: printInFlightRef });
      if (!cancelled) {
        setPrintJob(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [printJob, thermalWidth]);

  const total = sales.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  const openReturnModal = async (sale) => {
    setReturnFeedback('');
    const fullSale = await resolvePrintableCounterSale(sale);
    if (!saleHasReceiptItems(fullSale)) {
      window.alert?.('Bill details are still loading. Refresh sales and try return again.');
      return;
    }
    setReturnSale(fullSale);
    setReturnQty({});
    setReturnMethod('cash');
    setReturnReason('');
  };

  const setReturnItemQty = (productId, value) => {
    const raw = Number(value);
    const item = (returnSale?.items || []).find((entry) => Number(entry.product_id) === Number(productId));
    const max = Math.max(0, Number(item?.qty) || 0);
    setReturnQty((prev) => ({
      ...prev,
      [productId]: Number.isFinite(raw) ? Math.max(0, Math.min(max, Math.floor(raw))) : 0,
    }));
  };

  const returnItems = (returnSale?.items || [])
    .map((item) => ({
      product_id: item.product_id,
      qty: Number(returnQty[item.product_id]) || 0,
    }))
    .filter((item) => item.qty > 0);

  const returnTotal = (returnSale?.items || []).reduce((sum, item) => {
    const qty = Number(returnQty[item.product_id]) || 0;
    return sum + qty * (Number(item.price) || 0);
  }, 0);

  const returnNeedsOverride = (() => {
    if (!returnSale?.created_at || ['super_admin', 'admin'].includes(user?.role)) return false;
    const created = new Date(returnSale.created_at).getTime();
    const windowMs = Math.max(0, Number(posSettings.posReturnWindowHours) || 0) * 60 * 60 * 1000;
    return Number.isFinite(created) && Date.now() - created > windowMs;
  })();

  const submitReturn = async () => {
    if (!returnSale || !returnItems.length) {
      setReturnFeedback('Select at least one item quantity to return.');
      return;
    }
    setReturnSubmitting(true);
    setReturnFeedback('');
    try {
      let approval = {};
      if (returnNeedsOverride) {
        const managerLogin = window.prompt?.('Outside return window. Enter admin username/email:') || '';
        const managerPassword = managerLogin ? window.prompt?.('Enter manager password/PIN:') || '' : '';
        if (!managerLogin.trim() || !managerPassword) {
          setReturnFeedback('Manager approval is required outside the return window.');
          setReturnSubmitting(false);
          return;
        }
        approval = { manager_login: managerLogin, manager_password: managerPassword };
      }
      await api.processCounterReturn(returnSale.id, {
        items: returnItems,
        refund_method: returnMethod,
        reason: returnReason,
        ...approval,
      });
      setReturnFeedback('Return processed. Stock restored.');
      setReturnSale(null);
      await loadCounterData({ showLoading: false });
    } catch (err) {
      setReturnFeedback(err.message || 'Could not process return.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const resolvePrintableCounterSale = useCallback(async (sale) => {
    if (saleHasReceiptItems(sale)) return sale;

    const saleKey = String(sale?.id ?? sale?.order_id ?? '').trim();
    if (!saleKey) return null;

    try {
      const freshSale = await api.getCounterSale(saleKey);
      if (saleHasReceiptItems(freshSale)) return freshSale;
    } catch {
      // Fall back to the day list below; older deployments may not expose the detail route yet.
    }

    const saleDate = counterSaleDate(sale, today);
    const daySales = await api.getCounterSales({ date: saleDate });
    return daySales.find((order) =>
      String(order.id) === saleKey || String(order.order_id || '').trim() === saleKey
    ) || null;
  }, [today]);

  const printCounterSale = useCallback(async (sale) => {
    let order = null;
    try {
      order = await resolvePrintableCounterSale(sale);
    } catch {
      order = null;
    }
    if (!saleHasReceiptItems(order)) {
      window.alert?.('Receipt details are still loading. Refresh sales and try Print Receipt again.');
      return;
    }
    setPrintJob({ order, requestedAt: Date.now() });
  }, [resolvePrintableCounterSale]);

  const shareCounterSale = async (sale) => {
    try {
      await shareCounterInvoicePdf(sale, thermalWidth);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        downloadCounterInvoicePdf(sale, thermalWidth);
      }
    }
  };

  return (
    <div className="wp-admin-shell counter-shell">
      <header className="wp-admin-bar">
        <div className="wp-admin-bar-left">
          <span className="wp-admin-bar-site">{SHOP.name}</span>
          <span className="wp-admin-bar-live">{t('counter.roleBadge')}</span>
        </div>
        <div className="wp-admin-bar-right">
          <span className="wp-admin-bar-user">
            {user?.name || user?.username} · {t('counter.counterOnly')}
          </span>
          <button type="button" className="wp-admin-bar-link" onClick={logout}>
            {t('common.logout')}
          </button>
        </div>
      </header>

      <main className="wp-admin-content counter-content">
        <div className="wp-admin-content-head counter-head">
          <div>
            <h1 className="wp-admin-page-title">{t('counter.title')}</h1>
            <p>{t('counter.subtitle')}</p>
          </div>
          <div className="counter-today-card">
            <span>{t('counter.todaySales')}</span>
            <strong>{formatPrice(total)}</strong>
            <small>{sales.length} {t('counter.billsToday')}</small>
          </div>
        </div>

        {loading ? (
          <div className="wp-loading">{t('common.loading')}</div>
        ) : (
          <AdminCounterBill
            products={products}
            onBillCreated={() => loadCounterData({ showLoading: false })}
            onPrintOrder={printCounterSale}
            onThermalWidthChange={setThermalWidth}
          />
        )}

        <section className="counter-sales glass-card">
          <div className="counter-sales__head">
            <h3>{t('counter.mySalesToday')}</h3>
            <button type="button" className="wp-button wp-button--secondary" onClick={() => loadCounterData({ showLoading: false })}>
              {t('sales.refresh')}
            </button>
          </div>
          {sales.length === 0 ? (
            <p className="field-hint">{t('counter.noSales')}</p>
          ) : (
            <div className="wp-table-wrap">
              <table className="wp-table">
                <thead>
                  <tr>
                    <th>{t('admin.counterBillNo')}</th>
                    <th>{t('admin.counterBillDate')}</th>
                    <th>{t('admin.counterBillCustomer')}</th>
                    <th>{t('admin.counterBillPayment')}</th>
                    <th>{t('admin.counterBillTotal')}</th>
                    <th>{t('admin.counterBillActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.order_id || sale.id}</td>
                      <td>{sale.created_at ? new Date(sale.created_at).toLocaleTimeString() : '-'}</td>
                      <td>{sale.customer_name || 'Walk-in Customer'}</td>
                      <td>{sale.payment_mode}</td>
                      <td>{formatPrice(sale.total_amount)}</td>
                      <td>
                        <div className="counter-sales__actions">
                          <button
                            type="button"
                            className="wp-button wp-button--secondary counter-sales__print"
                            onClick={() => printCounterSale(sale)}
                          >
                            {t('admin.counterBillPrintNow')}
                          </button>
                          <button
                            type="button"
                            className="wp-button wp-button--secondary counter-sales__print"
                            onClick={() => downloadCounterInvoicePdf(sale, thermalWidth)}
                          >
                            {t('admin.counterBillDownloadPdf')}
                          </button>
                          <button
                            type="button"
                            className="wp-button wp-button--secondary counter-sales__print"
                            onClick={() => shareCounterSale(sale)}
                          >
                            {t('admin.counterBillSharePdf')}
                          </button>
                          <button
                            type="button"
                            className="wp-button wp-button--secondary counter-sales__print counter-sales__return"
                            onClick={() => openReturnModal(sale)}
                          >
                            Process Return
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="counter-print-stage" aria-hidden="true">
          <CounterBillReceipt order={printJob?.order} printable thermalWidth={thermalWidth} />
        </div>

        {returnSale ? (
          <div className="counter-return-modal" role="dialog" aria-modal="true" aria-label="Process return">
            <div className="counter-return-modal__card glass-card">
              <div className="counter-return-modal__head">
                <div>
                  <h3>Process Return</h3>
                  <p>
                    Bill {returnSale.order_id || returnSale.id} · Return window: {posSettings.posReturnWindowHours} hours
                  </p>
                </div>
                <button type="button" className="wp-button wp-button--secondary" onClick={() => setReturnSale(null)}>
                  Close
                </button>
              </div>

              {returnNeedsOverride ? (
                <p className="counter-return-modal__warning">
                  This bill is outside the normal return window. Manager approval will be required.
                </p>
              ) : null}

              <div className="counter-return-modal__items">
                {(returnSale.items || []).map((item) => (
                  <label key={item.product_id} className="counter-return-item">
                    <span>
                      <strong>{item.name}</strong>
                      <small>Sold: {item.qty} · {formatPrice(item.price)} each</small>
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={Number(item.qty) || 0}
                      step="1"
                      value={returnQty[item.product_id] || ''}
                      onChange={(e) => setReturnItemQty(item.product_id, e.target.value)}
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>

              <div className="counter-return-modal__grid">
                <label>
                  <span>Refund method</span>
                  <select value={returnMethod} onChange={(e) => setReturnMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="store_credit">Store Credit</option>
                  </select>
                </label>
                <label>
                  <span>Reason (optional)</span>
                  <input
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    maxLength={500}
                    placeholder="Customer reason / staff note"
                  />
                </label>
              </div>

              <div className="counter-return-modal__foot">
                <strong>Refund total: {formatPrice(returnTotal)}</strong>
                <button
                  type="button"
                  className="wp-button"
                  onClick={submitReturn}
                  disabled={returnSubmitting || !returnItems.length}
                >
                  {returnSubmitting ? 'Processing…' : 'Confirm Return'}
                </button>
              </div>
              {returnFeedback ? <p className="counter-return-modal__feedback">{returnFeedback}</p> : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
