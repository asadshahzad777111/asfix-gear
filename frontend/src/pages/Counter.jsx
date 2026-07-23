import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, formatPrice } from '../api/client';
import AdminCounterBill, {
  downloadCounterInvoicePdf,
  readThermalReceiptWidth,
  shareCounterInvoicePdf,
} from '../components/admin/AdminCounterBill';
import { SHOP } from '../config/shop';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import { useSmartThermalPrint } from '../hooks/useSmartThermalPrint';
import {
  clearSavedPrinter,
  getSavedPrinter,
  isNativePosApp,
  listBondedPrinters,
  savePrinter,
} from '../utils/nativePosPrint';
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
  const { resolved: themeResolved } = useTheme();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState({ today_sales: 0, bills_today: 0, items_sold_today: 0 });
  const [posSettings, setPosSettings] = useState(DEFAULT_POS_SETTINGS);
  const [returnSale, setReturnSale] = useState(null);
  const [returnQty, setReturnQty] = useState({});
  const [returnMethod, setReturnMethod] = useState('cash');
  const [returnReason, setReturnReason] = useState('');
  const [returnFeedback, setReturnFeedback] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [thermalWidth, setThermalWidth] = useState(() => readThermalReceiptWidth());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [salesOpen, setSalesOpen] = useState(false);
  const nativePos = isNativePosApp();
  const [nativePrinter, setNativePrinter] = useState(null);
  const [nativePrinters, setNativePrinters] = useState([]);
  const [nativePrinterBusy, setNativePrinterBusy] = useState(false);
  const [nativePickerOpen, setNativePickerOpen] = useState(false);
  const printInFlightRef = useRef(false);
  const salesSectionRef = useRef(null);
  const { printSmart, openPrintSetup, chooser: printChooser } = useSmartThermalPrint({
    thermalWidth,
    agentReady: !nativePos || Boolean(nativePrinter?.address),
  });
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

  useEffect(() => {
    if (!nativePos) return undefined;
    let cancelled = false;
    (async () => {
      const saved = await getSavedPrinter();
      if (!cancelled) setNativePrinter(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, [nativePos]);

  const openNativePrinterPicker = useCallback(async () => {
    if (!nativePos) return;
    setNativePickerOpen(true);
    setNativePrinterBusy(true);
    try {
      const list = await listBondedPrinters();
      setNativePrinters(list);
      const saved = await getSavedPrinter();
      setNativePrinter(saved);
    } catch (err) {
      window.alert?.(err?.message || t('admin.counterBillNativePrintFailed'));
    } finally {
      setNativePrinterBusy(false);
    }
  }, [nativePos, t]);

  const openPrinterSetup = useCallback(() => {
    if (nativePos) {
      void openNativePrinterPicker();
      return;
    }
    openPrintSetup();
  }, [nativePos, openNativePrinterPicker, openPrintSetup]);

  const selectNativePrinter = useCallback(async (printer) => {
    await savePrinter(printer);
    setNativePrinter(printer);
    setNativePickerOpen(false);
  }, []);

  const clearNativePrinter = useCallback(async () => {
    await clearSavedPrinter();
    setNativePrinter(null);
    setNativePrinters([]);
    setNativePickerOpen(false);
  }, []);

  const loadCounterData = async ({ silent = false } = {}) => {
    // Never tear down the bill UI after first paint — silent refresh only.
    try {
      const [productData, salesData, statsData] = await Promise.all([
        api.getProducts(),
        api.getCounterSales({ date: today }),
        api.getCounterStats({ date: today }).catch(() => null),
      ]);
      setProducts(productData);
      setSales(salesData);
      setStats(statsData || {
        today_sales: salesData.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
        bills_today: salesData.filter((order) => order.source !== 'counter_return').length,
        items_sold_today: salesData.reduce((sum, order) => {
          const sign = order.source === 'counter_return' || order.transaction_type === 'return' ? -1 : 1;
          return sum + sign * (order.items || []).reduce((itemSum, item) => itemSum + (Number(item.qty) || 0), 0);
        }, 0),
      });
      api.getPosSettings()
        .then((settings) => setPosSettings({ ...DEFAULT_POS_SETTINGS, ...(settings || {}) }))
        .catch(() => setPosSettings(DEFAULT_POS_SETTINGS));
    } finally {
      if (!silent) setBootstrapping(false);
    }
  };

  useEffect(() => {
    loadCounterData({ silent: false });
  }, []);

  const jumpToSales = () => {
    setSalesOpen(true);
    window.requestAnimationFrame(() => {
      salesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

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
      return { ok: false, reason: 'no_order', message: 'Receipt details are still loading' };
    }
    /* Smart print: native BT local, else remote station chooser */
    return printSmart(order, {
      thermalWidth,
      inFlightRef: printInFlightRef,
    });
  }, [printSmart, resolvePrintableCounterSale, thermalWidth]);

  const shareCounterSale = async (sale) => {
    try {
      const shared = await shareCounterInvoicePdf(sale, thermalWidth);
      if (!shared) {
        window.alert?.(t('admin.counterBillShareSheet'));
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        try {
          await downloadCounterInvoicePdf(sale, thermalWidth);
          window.alert?.(t('admin.counterBillShareSheet'));
        } catch (downloadErr) {
          window.alert?.(downloadErr?.message || t('admin.counterBillPdfFailed'));
        }
      }
    }
  };

  const downloadCounterSale = async (sale) => {
    try {
      const result = await downloadCounterInvoicePdf(sale, thermalWidth);
      if (result?.message === 'cancelled') return;
      if (!result?.ok) {
        window.alert?.(result?.message || t('admin.counterBillPdfFailed'));
        return;
      }
      window.alert?.(
        result.method === 'share' || result.method === 'open'
          ? t('admin.counterBillShareSheet')
          : t('admin.counterBillPdfDownloaded')
      );
    } catch (err) {
      if (err?.name !== 'AbortError') {
        window.alert?.(err?.message || t('admin.counterBillPdfFailed'));
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
          <div className="counter-theme-toggle" title={t('common.themeToggle')}>
            <span className="counter-theme-toggle__text" aria-hidden="true">
              {themeResolved === 'dark' ? t('common.themeDark') : t('common.themeLight')}
            </span>
            <ThemeToggle className="theme-switch--nav counter-theme-switch" />
          </div>
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
          <div className="counter-stats-bar" aria-label={t('counter.quickStats')}>
            <div className="counter-today-card">
              <span>{t('counter.todaySales')}</span>
              <strong>{formatPrice(stats.today_sales)}</strong>
              <small>{t('counter.shopToday')}</small>
            </div>
            <div className="counter-today-card">
              <span>{t('counter.billsToday')}</span>
              <strong>{Number(stats.bills_today || 0).toLocaleString('en-PK')}</strong>
              <small>{t('counter.counterBills')}</small>
            </div>
            <div className="counter-today-card">
              <span>{t('counter.itemsSoldToday')}</span>
              <strong>{Number(stats.items_sold_today || 0).toLocaleString('en-PK')}</strong>
              <small>{t('counter.netAfterReturns')}</small>
            </div>
          </div>
        </div>

        {bootstrapping && products.length === 0 ? (
          <div className="counter-boot">{t('common.loading')}</div>
        ) : null}

        <AdminCounterBill
          products={products}
          onBillCreated={() => loadCounterData({ silent: true })}
          onPrintOrder={printCounterSale}
          onThermalWidthChange={setThermalWidth}
          onJumpToSales={jumpToSales}
          onOpenReturnFlow={jumpToSales}
          onOpenPrinterSetup={openPrinterSetup}
        />

        <section className="counter-sales" ref={salesSectionRef}>
          <div className="counter-sales__head">
            <button
              type="button"
              className="counter-sales__toggle"
              onClick={() => setSalesOpen((open) => !open)}
              aria-expanded={salesOpen}
            >
              <h3>{t('counter.mySalesToday')}</h3>
              <span>{salesOpen ? 'Hide' : `Show (${sales.length})`}</span>
            </button>
            <button type="button" className="wp-button wp-button--secondary" onClick={() => loadCounterData({ silent: true })}>
              {t('sales.refresh')}
            </button>
          </div>
          {salesOpen ? (
            sales.length === 0 ? (
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
                              onClick={async () => {
                                const result = await printCounterSale(sale);
                                if (!result?.ok) {
                                  if (result?.reason === 'cancelled' || result?.reason === 'busy') return;
                                  if (result?.reason === 'no_printer') {
                                    window.alert?.(t('admin.counterBillNativeNoPrinter'));
                                    void openNativePrinterPicker();
                                    return;
                                  }
                                  if (result?.reason === 'no_station') {
                                    window.alert?.(t('admin.printTargetNoStation'));
                                    return;
                                  }
                                  const msg =
                                    result?.reason === 'permission_denied'
                                      ? t('admin.counterBillNativeBtPermission')
                                      : result?.message || t('admin.counterBillNativePrintFailed');
                                  window.alert?.(msg);
                                  return;
                                }
                                if (result?.job) {
                                  window.alert?.(t('admin.printTargetQueued'));
                                }
                              }}
                            >
                              {nativePos
                                ? t('admin.counterBillPrintNative')
                                : isAndroid
                                  ? t('admin.counterBillPrintMate')
                                  : t('admin.counterBillPrintNow')}
                            </button>
                            <button
                              type="button"
                              className="wp-button wp-button--secondary counter-sales__print"
                              onClick={() => downloadCounterSale(sale)}
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
            )
          ) : null}
        </section>

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

        {nativePos && nativePickerOpen ? (
          <div className="counter-printer-modal" role="dialog" aria-modal="true" aria-label={t('admin.counterBillNativePrinter')}>
            <div className="counter-printer-modal__card">
              <div className="counter-printer-modal__head">
                <div>
                  <h3>{t('admin.counterBillNativePrinter')}</h3>
                  <p>
                    {nativePrinter
                      ? `${nativePrinter.name || 'Printer'}${nativePrinter.address ? ` · ${nativePrinter.address}` : ''}`
                      : t('admin.counterBillNativeNoPrinter')}
                  </p>
                </div>
                <button type="button" className="wp-button wp-button--secondary" onClick={() => setNativePickerOpen(false)}>
                  Close
                </button>
              </div>
              <p className="field-hint">{t('admin.counterBillNativePairHint')}</p>
              {nativePrinterBusy ? (
                <p className="field-hint">{t('common.loading')}</p>
              ) : nativePrinters.length === 0 ? (
                <p className="field-hint">{t('admin.counterBillNativePairHint')}</p>
              ) : (
                <ul className="counter-bt-printer-bar__list">
                  {nativePrinters.map((printer) => (
                    <li key={printer.address}>
                      <button
                        type="button"
                        className={
                          nativePrinter?.address === printer.address
                            ? 'counter-bt-printer-bar__device counter-bt-printer-bar__device--active'
                            : 'counter-bt-printer-bar__device'
                        }
                        onClick={() => void selectNativePrinter(printer)}
                      >
                        {printer.name || printer.address}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="counter-printer-modal__actions">
                <button
                  type="button"
                  className="wp-button"
                  disabled={nativePrinterBusy}
                  onClick={() => void openNativePrinterPicker()}
                >
                  {nativePrinterBusy ? t('common.loading') : t('admin.counterBillNativeRefresh')}
                </button>
                {nativePrinter ? (
                  <button
                    type="button"
                    className="wp-button wp-button--secondary"
                    onClick={() => void clearNativePrinter()}
                  >
                    {t('admin.counterBillNativeClear')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </main>
      {printChooser}
    </div>
  );
}
