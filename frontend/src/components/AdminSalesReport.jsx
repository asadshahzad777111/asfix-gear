import { useCallback, useEffect, useState } from 'react';
import { api, formatPrice } from '../api/client';
import { useTranslation } from '../context/LanguageContext';

const PERIODS = ['day', 'week', 'range'];

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function todayInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadSalesCsv(report, period) {
  if (!report?.orders?.length) return;

  const headers = [
    'Order ID',
    'Date',
    'Customer',
    'Phone',
    'Item',
    'Qty',
    'Sale',
    'Cost (Asal)',
    'Profit',
    'Order Sale',
    'Order Cost',
    'Order Profit',
    'Status',
  ];

  const rows = [headers.map(csvEscape).join(',')];

  for (const row of report.orders) {
    const items = row.items?.length ? row.items : [{ name: '—', qty: 1, sale_line: 0, cost_line: 0 }];
    items.forEach((item, idx) => {
      const lineProfit = Number(item.sale_line || 0) - Number(item.cost_line || 0);
      rows.push(
        [
          idx === 0 ? row.order_id : '',
          idx === 0 ? formatDateTime(row.created_at) : '',
          idx === 0 ? row.customer_name : '',
          idx === 0 ? row.phone : '',
          item.name,
          item.qty,
          item.sale_line,
          item.cost_line,
          lineProfit,
          idx === 0 ? row.sale_total : '',
          idx === 0 ? row.cost_total : '',
          idx === 0 ? row.profit : '',
          idx === 0 ? row.shipping_status : '',
        ]
          .map(csvEscape)
          .join(',')
      );
    });
  }

  if (report.summary) {
    rows.push(
      [
        'TOTALS',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        report.summary.sale_total,
        report.summary.cost_total,
        report.summary.profit,
        `${report.summary.order_count} orders`,
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `asfix-sales-${period}-${todayInputValue()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminSalesReport({ compact = false }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('day');
  const [from, setFrom] = useState(todayInputValue());
  const [to, setTo] = useState(todayInputValue());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { period };
      if (period === 'range') {
        params.from = from;
        params.to = to;
      }
      const data = await api.getSalesReport(params);
      setReport(data);
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const summary = report?.summary;

  return (
    <div className={`sales-report ${compact ? 'sales-report--compact' : ''}`}>
      <div className="sales-report-toolbar glass-card">
        <div className="sales-report-toolbar-head">
          <h3>{t('sales.title')}</h3>
          <p className="field-hint">{t('sales.subtitle')}</p>
        </div>
        <div className="sales-report-filters">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPeriod(p)}
            >
              {t(`sales.period.${p}`)}
            </button>
          ))}
          {period === 'range' && (
            <div className="sales-report-range">
              <label>
                <span>{t('sales.from')}</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                <span>{t('sales.to')}</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <button type="button" className="btn btn-primary btn-sm" onClick={loadReport}>
                {t('sales.apply')}
              </button>
            </div>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={loadReport} disabled={loading}>
            {loading ? t('sales.loading') : t('sales.refresh')}
          </button>
          {report?.orders?.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => downloadSalesCsv(report, period)}
            >
              {t('sales.exportCsv')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {summary && (
        <div className="sales-summary-grid">
          <div className="sales-summary-card glass-card">
            <span className="sales-summary-label">{t('sales.orders')}</span>
            <strong className="sales-summary-value">{summary.order_count}</strong>
          </div>
          <div className="sales-summary-card glass-card">
            <span className="sales-summary-label">{t('sales.totalSales')}</span>
            <strong className="sales-summary-value sales-summary-value--sale">{formatPrice(summary.sale_total)}</strong>
          </div>
          <div className="sales-summary-card glass-card">
            <span className="sales-summary-label">{t('sales.totalCost')}</span>
            <strong className="sales-summary-value sales-summary-value--cost">{formatPrice(summary.cost_total)}</strong>
          </div>
          <div className="sales-summary-card glass-card sales-summary-card--profit">
            <span className="sales-summary-label">{t('sales.totalProfit')}</span>
            <strong className={`sales-summary-value ${summary.profit >= 0 ? 'sales-summary-value--profit' : 'sales-summary-value--loss'}`}>
              {formatPrice(summary.profit)}
            </strong>
          </div>
        </div>
      )}

      <div className="glass-card sales-report-table-wrap">
        {loading ? (
          <div className="loading">{t('sales.loading')}</div>
        ) : !report?.orders?.length ? (
          <p className="field-hint sales-report-empty">{t('sales.empty')}</p>
        ) : (
          <table className="admin-table sales-report-table">
            <thead>
              <tr>
                <th>{t('sales.colOrder')}</th>
                <th>{t('sales.colDate')}</th>
                <th>{t('sales.colCustomer')}</th>
                <th>{t('sales.colItems')}</th>
                <th className="sales-num">{t('sales.colSale')}</th>
                <th className="sales-num">{t('sales.colCost')}</th>
                <th className="sales-num">{t('sales.colProfit')}</th>
                <th>{t('sales.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {report.orders.map((row) => (
                <tr key={row.id}>
                  <td><strong>#{row.order_id}</strong></td>
                  <td><small>{formatDateTime(row.created_at)}</small></td>
                  <td>
                    {row.customer_name}
                    <br /><small>{row.phone}</small>
                  </td>
                  <td className="sales-items-cell">
                    <ul className="sales-items-list">
                      {row.items.map((item, idx) => (
                        <li key={idx}>
                          {item.name} ×{item.qty}
                          <span className="sales-item-prices">
                            {formatPrice(item.sale_line)}
                            <em>{t('sales.costShort')}: {formatPrice(item.cost_line)}</em>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="sales-num">{formatPrice(row.sale_total)}</td>
                  <td className="sales-num">{formatPrice(row.cost_total)}</td>
                  <td className={`sales-num ${row.profit >= 0 ? 'sales-profit-pos' : 'sales-profit-neg'}`}>
                    {formatPrice(row.profit)}
                  </td>
                  <td><span className="status-pill">{row.shipping_status}</span></td>
                </tr>
              ))}
            </tbody>
            {summary && report.orders.length > 0 && (
              <tfoot>
                <tr className="sales-report-total-row">
                  <td colSpan={4}><strong>{t('sales.totals')}</strong></td>
                  <td className="sales-num"><strong>{formatPrice(summary.sale_total)}</strong></td>
                  <td className="sales-num"><strong>{formatPrice(summary.cost_total)}</strong></td>
                  <td className={`sales-num ${summary.profit >= 0 ? 'sales-profit-pos' : 'sales-profit-neg'}`}>
                    <strong>{formatPrice(summary.profit)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
