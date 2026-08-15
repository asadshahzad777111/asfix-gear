import { useEffect, useMemo, useRef, useState } from 'react';
import { api, formatPrice } from '../../api/client';
import { canEditProduct, canManageProducts } from '../../config/permissions';
import { getStockStatus } from '../../utils/stock';
import './admin-products-sheet.css';

function salePrice(price, discount) {
  const p = Number(price);
  if (!Number.isFinite(p)) return 0;
  const d = Math.min(90, Math.max(0, Number(discount) || 0));
  return Math.round(p * (1 - d / 100));
}

function matchesQuery(product, query) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const hay = [
    product.name,
    product.brand,
    product.category,
    product.compatible_models,
    product.barcode,
    product.sku,
    String(product.id),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(term);
}

/**
 * Live Products Sheet for staff — type a name to filter; edit price / discount /
 * stock inline. CSV stays a backup/import helper; the backend remains master.
 */
export default function AdminProductsSheet({ products, currentUser, onProductsChange, onProductUpdated }) {
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const fileRef = useRef(null);
  const canUseCsv = canManageProducts(currentUser);

  useEffect(() => {
    setDrafts({});
  }, [products]);

  const filtered = useMemo(() => {
    return products
      .filter((p) => matchesQuery(p, query))
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [products, query]);

  const getDraft = (product) => {
    const d = drafts[product.id];
    if (!d) {
      return {
        price: product.price,
        discount_percent: product.discount_percent ?? 0,
        stock: product.stock ?? 0,
        status: product.status || 'published',
      };
    }
    return d;
  };

  const setField = (product, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [product.id]: {
        ...getDraft(product),
        ...prev[product.id],
        [field]: value,
      },
    }));
  };

  const saveRow = async (product) => {
    if (!canEditProduct(currentUser, product)) {
      setFeedback({ type: 'error', text: 'Sirf apne products edit kar sakte ho (ya Super Admin).' });
      return;
    }
    const draft = getDraft(product);
    const price = Number(draft.price);
    const discount = Number(draft.discount_percent);
    const stock = Number(draft.stock);
    if (!Number.isFinite(price) || price < 0) {
      setFeedback({ type: 'error', text: 'Price invalid' });
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 90) {
      setFeedback({ type: 'error', text: 'Discount 0–90 hona chahiye' });
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setFeedback({ type: 'error', text: 'Stock invalid' });
      return;
    }

    setBusyId(product.id);
    setFeedback(null);
    try {
      const updated = await api.updateProduct(product.id, {
        name: product.name,
        category: product.category,
        brand: product.brand,
        compatible_models: product.compatible_models,
        description: product.description,
        image: product.image,
        hover_image: product.hover_image,
        gallery: product.gallery,
        tags: product.tags,
        slug: product.slug,
        warranty: product.warranty,
        featured: product.featured,
        cost_price: product.cost_price,
        price,
        discount_percent: discount,
        stock: Math.floor(stock),
        status: draft.status === 'draft' ? 'draft' : 'published',
      });
      onProductUpdated?.(updated);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setFeedback({ type: 'success', text: `Saved: ${updated.name}` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Save failed' });
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      await api.downloadProductsCsv();
      setFeedback({
        type: 'success',
        text: 'CSV download ho gaya. Backup/import ke liye use karein — website DB master hai.',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setFeedback(null);
    try {
      const csv = await file.text();
      const summary = await api.importProductsCsv(csv);
      const errHint =
        summary.errors?.length > 0
          ? ` · ${summary.errors.slice(0, 3).map((e) => `row ${e.row}: ${e.error}`).join('; ')}`
          : '';
      setFeedback({
        type: summary.errors?.length ? 'error' : 'success',
        text: `Import: ${summary.updated} updated, ${summary.created} created, ${summary.skipped} skipped${errHint}`,
      });
      await onProductsChange?.();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Import failed' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="aps-sheet">
      <div className="aps-head">
        <div>
          <h3>Products Sheet</h3>
          <p>
            Name type karo → matching products. Price / discount / stock yahin edit — website DB pe live save.
            CSV export/import backup ke liye hai; master data AsFix backend mein rahega.
          </p>
        </div>
        {canUseCsv ? (
          <div className="aps-actions">
            <button type="button" className="wp-button" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export CSV Backup'}
            </button>
            <button
              type="button"
              className="wp-button wp-button--secondary"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => handleImportFile(e.target.files?.[0])}
            />
          </div>
        ) : null}
      </div>

      <label className="aps-search">
        <span className="aps-search-label">Search</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="iphone, battery, case, charger…"
          autoComplete="off"
        />
        <span className="aps-search-count">{filtered.length} / {products.length}</span>
      </label>

      {feedback ? (
        <div className={`aps-feedback aps-feedback--${feedback.type}`} role="status">
          {feedback.text}
        </div>
      ) : null}

      <div className="aps-table-wrap">
        <table className="aps-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Disc %</th>
              <th>Sale</th>
              <th>Stock</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="aps-empty">
                  Koi product match nahi — search clear karo ya naya product add karo.
                </td>
              </tr>
            ) : (
              filtered.map((product) => {
                const draft = getDraft(product);
                const editable = canEditProduct(currentUser, product);
                const stockStatus = getStockStatus(draft.stock);
                const dirty =
                  Number(draft.price) !== Number(product.price) ||
                  Number(draft.discount_percent) !== Number(product.discount_percent || 0) ||
                  Number(draft.stock) !== Number(product.stock || 0) ||
                  (draft.status || 'published') !== (product.status || 'published');

                return (
                  <tr key={product.id} className={dirty ? 'is-dirty' : undefined}>
                    <td className="aps-id">{product.id}</td>
                    <td className="aps-name">
                      <strong>{product.name}</strong>
                      {product.brand ? <small>{product.brand}</small> : null}
                    </td>
                    <td>{product.category}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={!editable || busyId === product.id}
                        value={draft.price}
                        onChange={(e) => setField(product, 'price', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRow(product)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        step="1"
                        disabled={!editable || busyId === product.id}
                        value={draft.discount_percent}
                        onChange={(e) => setField(product, 'discount_percent', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRow(product)}
                      />
                    </td>
                    <td className="aps-sale">{formatPrice(salePrice(draft.price, draft.discount_percent))}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={`aps-stock aps-stock--${stockStatus}`}
                        disabled={!editable || busyId === product.id}
                        value={draft.stock}
                        onChange={(e) => setField(product, 'stock', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRow(product)}
                      />
                    </td>
                    <td>
                      <select
                        disabled={!editable || busyId === product.id}
                        value={draft.status || 'published'}
                        onChange={(e) => setField(product, 'status', e.target.value)}
                      >
                        <option value="published">published</option>
                        <option value="draft">draft</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="wp-button wp-button--small"
                        disabled={!editable || !dirty || busyId === product.id}
                        onClick={() => saveRow(product)}
                      >
                        {busyId === product.id ? '…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
