import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatPrice } from '../../api/client';
import { ASFIN } from '../../config/asfin';
import { useTranslation } from '../../context/LanguageContext';

export default function AdminAsfinBills() {
  const { t } = useTranslation();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.getAsfinBills();
      setBills(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err?.message || t('admin.asfinBillsLoadFail'));
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalSum = useMemo(
    () => bills.reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0),
    [bills],
  );

  const onDelete = async (bill) => {
    const label = bill.bill_id || bill.id;
    if (!window.confirm?.(t('admin.asfinBillsDeleteConfirm', { id: label }))) return;
    setDeletingId(bill.id);
    try {
      await api.deleteAsfinBill(bill.id);
      setBills((prev) => prev.filter((row) => row.id !== bill.id));
    } catch (err) {
      window.alert?.(err?.message || t('admin.asfinBillsDeleteFail'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <strong>{t('admin.asfinBillsTitle')}</strong>
          <div style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 400 }}>
            {ASFIN.shopName} · {ASFIN.siteUrl} — {t('admin.asfinBillsHint')}
          </div>
        </div>
        <button type="button" className="wp-button wp-button--secondary" onClick={() => void load()} disabled={loading}>
          {t('sales.refresh')}
        </button>
      </div>
      <div className="wp-postbox-body">
        <p style={{ marginTop: 0 }}>
          {t('admin.asfinBillsCount', { count: bills.length })} · {t('admin.asfinBillsTotal')}: <strong>{formatPrice(totalSum)}</strong>
        </p>
        {error ? <p className="field-hint" style={{ color: '#b32d2e' }}>{error}</p> : null}
        {loading ? (
          <div className="wp-loading">{t('common.loading')}</div>
        ) : bills.length === 0 ? (
          <p className="field-hint">{t('admin.asfinBillsEmpty')}</p>
        ) : (
          <div className="wp-table-wrap">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>{t('admin.counterBillNo')}</th>
                  <th>{t('admin.counterBillDate')}</th>
                  <th>{t('admin.counterBillCustomer')}</th>
                  <th>{t('counter.customBillShop')}</th>
                  <th>{t('counter.customBillItems')}</th>
                  <th>{t('admin.counterBillTotal')}</th>
                  <th>{t('admin.counterBillActions')}</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  const items = Array.isArray(bill.items) ? bill.items : [];
                  const open = expandedId === bill.id;
                  return (
                    <tr key={bill.id}>
                      <td>{bill.bill_id || bill.id}</td>
                      <td>
                        {[bill.receipt_date, bill.receipt_time].filter(Boolean).join(' ')
                          || (bill.created_at ? new Date(bill.created_at).toLocaleString() : '-')}
                      </td>
                      <td>{bill.customer_name || 'Walk-in'}</td>
                      <td>{bill.shop_name || ASFIN.shopName}</td>
                      <td>
                        {items.length === 0 ? (
                          <span className="field-hint">—</span>
                        ) : (
                          <div className="asfin-bills__items">
                            <button
                              type="button"
                              className="wp-button wp-button--secondary asfin-bills__items-toggle"
                              onClick={() => setExpandedId(open ? null : bill.id)}
                            >
                              {open
                                ? t('admin.asfinBillsHideItems')
                                : t('admin.asfinBillsShowItems', { count: items.length })}
                            </button>
                            {open ? (
                              <ul className="asfin-bills__items-list">
                                {items.map((item, idx) => {
                                  const qty = Number(item.qty) || 1;
                                  const unit = Number(item.price) || 0;
                                  return (
                                    <li key={`${bill.id}-${idx}`}>
                                      <strong>{item.name || 'Item'}</strong>
                                      <span>{qty}×{Math.round(unit)}</span>
                                      <b>{formatPrice(unit * qty)}</b>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <ul className="asfin-bills__items-summary">
                                {items.slice(0, 3).map((item, idx) => (
                                  <li key={`${bill.id}-s-${idx}`}>
                                    {item.name || 'Item'} ×{Number(item.qty) || 1}
                                  </li>
                                ))}
                                {items.length > 3 ? (
                                  <li>+{items.length - 3}</li>
                                ) : null}
                              </ul>
                            )}
                          </div>
                        )}
                      </td>
                      <td><strong>{formatPrice(bill.total_amount)}</strong></td>
                      <td>
                        <button
                          type="button"
                          className="wp-button wp-button--secondary"
                          disabled={deletingId === bill.id}
                          onClick={() => void onDelete(bill)}
                        >
                          {deletingId === bill.id ? t('common.loading') : t('admin.asfinBillsDelete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
