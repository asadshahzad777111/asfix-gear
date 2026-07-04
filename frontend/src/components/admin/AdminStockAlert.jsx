import { useState } from 'react';
import useModalBehavior from '../../hooks/useModalBehavior';
import { useTranslation } from '../../context/LanguageContext';
import { getStockStatus, LOW_STOCK_THRESHOLD } from '../../utils/stock';

const STORAGE_KEY = 'asfix_admin_stock_alert_dismissed_count';

export default function AdminStockAlert({
  products,
  ready,
  onViewStock,
  onEditProduct,
}) {
  const { t } = useTranslation();
  const alertCount = products.length;
  const [dismissedCount, setDismissedCount] = useState(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored != null ? Number(stored) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const visible = ready && alertCount > 0 && dismissedCount < alertCount;

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(alertCount));
    } catch {
      /* ignore */
    }
    setDismissedCount(alertCount);
  };

  const handleViewStock = () => {
    dismiss();
    onViewStock?.();
  };

  const handleEdit = (product) => {
    dismiss();
    onEditProduct?.(product);
  };

  useModalBehavior(visible, dismiss);

  if (!visible) return null;

  const sorted = [...products].sort((a, b) => {
    const sa = getStockStatus(a.stock);
    const sb = getStockStatus(b.stock);
    if (sa !== sb) {
      if (sa === 'out') return -1;
      if (sb === 'out') return 1;
      return Number(a.stock) - Number(b.stock);
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div
      className="wp-stock-alert-overlay"
      onClick={dismiss}
      role="presentation"
    >
      <div
        className="wp-stock-alert-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wp-stock-alert-title"
      >
        <div className="wp-stock-alert-head">
          <h2 id="wp-stock-alert-title" className="wp-stock-alert-title">
            {t('admin.stockAlertTitle')}
          </h2>
          <p className="wp-stock-alert-sub">
            {t('admin.stockAlertSub', { count: sorted.length, threshold: LOW_STOCK_THRESHOLD })}
          </p>
        </div>

        <ul className="wp-stock-alert-list">
          {sorted.map((p) => {
            const status = getStockStatus(p.stock);
            const stock = Number(p.stock) || 0;
            return (
              <li key={p.id} className="wp-stock-alert-item">
                <div className="wp-stock-alert-item-main">
                  <span className="wp-stock-alert-name">{p.name}</span>
                  <span
                    className={`wp-stock-alert-qty ${status === 'out' ? 'is-out' : 'is-low'}`}
                  >
                    {status === 'out'
                      ? t('admin.outOfStock')
                      : t('admin.stockLabel', { count: stock })}
                  </span>
                </div>
                <button
                  type="button"
                  className="wp-button wp-button--link wp-button--small"
                  onClick={() => handleEdit(p)}
                >
                  {t('admin.stockAlertEdit')}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="wp-stock-alert-actions">
          <button type="button" className="wp-button wp-button--secondary" onClick={dismiss}>
            {t('admin.stockAlertDismiss')}
          </button>
          <button type="button" className="wp-button" onClick={handleViewStock}>
            {t('admin.stockAlertViewStock')}
          </button>
        </div>
      </div>
    </div>
  );
}
