import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { canEditProduct } from '../config/permissions';
import { useTranslation } from '../context/LanguageContext';
import { getStockStatus, LOW_STOCK_THRESHOLD } from '../utils/stock';

const STOCK_FILTERS = ['all', 'low_stock', 'out_of_stock'];

function matchesStockFilter(product, filter) {
  const stock = Number(product.stock) || 0;
  if (filter === 'out_of_stock') return stock <= 0;
  if (filter === 'low_stock') return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  return true;
}

/**
 * Lets staff quickly deduct stock for items sold offline (walk-in customers
 * who never touch the website checkout) or add stock back after a physical
 * restock — search by name/brand/model, then bump the count up or down
 * without opening the full Edit Product form. Only the staff member who
 * added a product (or a Super Admin) can adjust its stock.
 */
export default function AdminStockManager({
  products,
  currentUser,
  onProductUpdated,
  stockFilter = 'all',
  onStockFilterChange,
  lowStockCount = 0,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [qtyById, setQtyById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const counts = useMemo(() => {
    let low = 0;
    let out = 0;
    for (const p of products) {
      const status = getStockStatus(p.stock);
      if (status === 'low') low += 1;
      if (status === 'out') out += 1;
    }
    return { all: products.length, low_stock: low, out_of_stock: out };
  }, [products]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = products
      .filter((p) => matchesStockFilter(p, stockFilter))
      .sort((a, b) => {
        const sa = Number(a.stock) || 0;
        const sb = Number(b.stock) || 0;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });
    if (!term) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        String(p.brand || '').toLowerCase().includes(term) ||
        String(p.compatible_models || '').toLowerCase().includes(term) ||
        String(p.category || '').toLowerCase().includes(term)
    );
  }, [products, query, stockFilter]);

  const getQty = (id) => qtyById[id] ?? 1;
  const setQty = (id, value) => {
    const n = Math.max(1, Math.min(9999, Math.trunc(Number(value)) || 1));
    setQtyById((prev) => ({ ...prev, [id]: n }));
  };

  const adjust = async (product, sign, reason) => {
    const qty = getQty(product.id);
    const delta = sign * qty;
    setBusyId(product.id);
    setFeedback(null);
    try {
      const updated = await api.adjustProductStock(product.id, delta, { reason });
      onProductUpdated(updated);
      setFeedback({
        type: 'success',
        text:
          sign < 0
            ? t('admin.stockSoldOffline', { qty, name: product.name, stock: updated.stock })
            : t('admin.stockRestocked', { qty, name: product.name, stock: updated.stock }),
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const filterLabel = (key) => {
    if (key === 'all') return t('admin.stockFilterAll');
    if (key === 'low_stock') return t('admin.stockFilterLow');
    return t('admin.stockFilterOut');
  };

  return (
    <div className="glass-card admin-stock-manager">
      <div className="admin-stock-head">
        <h3>{t('admin.stockManagerTitle')}</h3>
        <p>{t('admin.stockManagerSub')}</p>
      </div>

      <div className="wp-order-filters admin-stock-filters">
        {STOCK_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            className={`wp-order-filter ${stockFilter === key ? 'is-active' : ''}`}
            onClick={() => onStockFilterChange?.(key)}
          >
            {filterLabel(key)}
            {key === 'low_stock' && lowStockCount > 0 ? (
              <span className="wp-menu-badge wp-menu-badge--warn admin-stock-filter-badge">{lowStockCount}</span>
            ) : (
              <span className="admin-stock-filter-count">({counts[key] ?? 0})</span>
            )}
          </button>
        ))}
      </div>

      {stockFilter === 'low_stock' && (
        <p className="admin-stock-filter-hint">
          {t('admin.stockLowHint', { threshold: LOW_STOCK_THRESHOLD })}
        </p>
      )}

      <input
        type="search"
        className="admin-stock-search"
        placeholder={t('admin.stockSearchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus={stockFilter === 'low_stock'}
      />

      {feedback && (
        <div className={`admin-stock-feedback admin-stock-feedback--${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <div className="admin-stock-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {stockFilter === 'low_stock'
              ? t('admin.stockNoLow')
              : stockFilter === 'out_of_stock'
                ? t('admin.stockNoOut')
                : t('admin.stockNoMatch')}
          </div>
        ) : (
          filtered.map((p) => {
            const status = getStockStatus(p.stock);
            const editable = canEditProduct(currentUser, p);
            return (
              <div key={p.id} className={`admin-stock-row admin-stock-row--${status}`}>
                <img src={p.image} alt={p.name} className="admin-stock-row-img" />
                <div className="admin-stock-row-info">
                  <strong>{p.name}</strong>
                  <span className="admin-stock-row-meta">
                    {p.brand ? `${p.brand} · ` : ''}
                    {p.category}
                    {p.compatible_models ? ` · ${p.compatible_models}` : ''}
                  </span>
                  <span className={`admin-stock-row-count admin-stock-row-count--${status}`}>
                    {status === 'low'
                      ? t('admin.lowStock') + `: ${p.stock}`
                      : status === 'out'
                        ? t('admin.outOfStock')
                        : t('admin.stockLabel', { count: p.stock })}
                  </span>
                </div>
                {editable ? (
                  <div className="admin-stock-row-actions">
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      className="admin-stock-qty-input"
                      value={getQty(p.id)}
                      onChange={(e) => setQty(p.id, e.target.value)}
                      disabled={busyId === p.id}
                      aria-label={t('admin.stockQtyLabel')}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm admin-stock-btn admin-stock-btn--minus"
                      disabled={busyId === p.id || p.stock <= 0}
                      onClick={() => adjust(p, -1, 'offline_sale')}
                      title={t('admin.stockSoldOfflineBtn')}
                    >
                      − {t('admin.stockSoldOfflineBtn')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm admin-stock-btn admin-stock-btn--plus"
                      disabled={busyId === p.id}
                      onClick={() => adjust(p, 1, 'restock')}
                      title={t('admin.stockRestockBtn')}
                    >
                      + {t('admin.stockRestockBtn')}
                    </button>
                  </div>
                ) : (
                  <span className="admin-product-locked">🔒 {t('admin.ownerOnly')}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
