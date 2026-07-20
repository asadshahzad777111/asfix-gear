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

export default function Counter() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
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
      await shareCounterInvoicePdf(sale);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        downloadCounterInvoicePdf(sale);
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
                            onClick={() => downloadCounterInvoicePdf(sale)}
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
      </main>
    </div>
  );
}
