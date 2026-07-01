import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { getStockStatus } from '../utils/stock';

/**
 * Lets staff quickly deduct stock for items sold offline (walk-in customers
 * who never touch the website checkout) or add stock back after a physical
 * restock — search by name/brand/model, then bump the count up or down
 * without opening the full Edit Product form.
 */
export default function AdminStockManager({ products, onProductUpdated }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [qtyById, setQtyById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = [...products].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return list.slice(0, 40);
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        String(p.brand || '').toLowerCase().includes(term) ||
        String(p.compatible_models || '').toLowerCase().includes(term) ||
        String(p.category || '').toLowerCase().includes(term)
    );
  }, [products, query]);

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

  return (
    <div className="glass-card admin-stock-manager">
      <div className="admin-stock-head">
        <h3>{t('admin.stockManagerTitle')}</h3>
        <p>{t('admin.stockManagerSub')}</p>
      </div>

      <input
        type="search"
        className="admin-stock-search"
        placeholder={t('admin.stockSearchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {feedback && (
        <div className={`admin-stock-feedback admin-stock-feedback--${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <div className="admin-stock-list">
        {filtered.length === 0 ? (
          <div className="empty-state">{t('admin.stockNoMatch')}</div>
        ) : (
          filtered.map((p) => {
            const status = getStockStatus(p.stock);
            return (
              <div key={p.id} className="admin-stock-row">
                <img src={p.image} alt={p.name} className="admin-stock-row-img" />
                <div className="admin-stock-row-info">
                  <strong>{p.name}</strong>
                  <span className="admin-stock-row-meta">
                    {p.brand ? `${p.brand} · ` : ''}
                    {p.category}
                    {p.compatible_models ? ` · ${p.compatible_models}` : ''}
                  </span>
                  <span className={`admin-stock-row-count admin-stock-row-count--${status}`}>
                    {t('admin.stockLabel', { count: p.stock })}
                  </span>
                </div>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
