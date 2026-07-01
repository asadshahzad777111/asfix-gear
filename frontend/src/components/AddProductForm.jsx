import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DiscountPicker, { DiscountRibbon, ProductPrice } from './DiscountPicker';
import { CATEGORIES, EMPTY_PRODUCT, DEFAULT_IMAGES, getDefaultImage } from '../config/products';
import { useTranslation } from '../context/LanguageContext';

const isDefaultImage = (url) => Object.values(DEFAULT_IMAGES).includes(url);

function productToForm(editProduct) {
  if (!editProduct) return { ...EMPTY_PRODUCT, image: getDefaultImage('Cases') };
  return {
    name: editProduct.name || '',
    category: editProduct.category || 'Cases',
    price: String(editProduct.price ?? ''),
    cost_price: String(editProduct.cost_price ?? ''),
    description: editProduct.description || '',
    image: editProduct.image || getDefaultImage(editProduct.category),
    stock: String(editProduct.stock ?? 0),
    featured: Boolean(editProduct.featured),
    discount_enabled: Number(editProduct.discount_percent) > 0,
    discount_percent: Number(editProduct.discount_percent) || 0,
    warranty: editProduct.warranty || '',
  };
}

export default function AddProductForm({ onSuccess, onCancel, compact = false, editProduct = null }) {
  const { t } = useTranslation();
  const isEdit = Boolean(editProduct?.id);
  const [product, setProduct] = useState(() => productToForm(editProduct));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setProduct(productToForm(editProduct));
  }, [editProduct]);

  const setField = (field, value) => {
    setProduct((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'category' && isDefaultImage(prev.image)) {
        next.image = getDefaultImage(value);
      }
      return next;
    });
  };

  const handleCategoryPick = (cat) => {
    setProduct((prev) => ({
      ...prev,
      category: cat,
      image: prev.image && prev.image !== getDefaultImage(prev.category) ? prev.image : getDefaultImage(cat),
    }));
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Sirf image files upload karein.' });
      return;
    }
    if (file.size > 150 * 1024) {
      setMessage({ type: 'error', text: 'Image 150KB se chhoti honi chahiye (ya image URL use karein).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setField('image', reader.result);
    reader.readAsDataURL(file);
  };

  const buildPayload = () => ({
    name: product.name.trim(),
    category: product.category,
    price: Number(product.price),
    cost_price: Number(product.cost_price) || 0,
    description: product.description.trim(),
    image: product.image.trim() || getDefaultImage(product.category),
    stock: Number(product.stock) || 0,
    featured: product.featured,
    discount_percent: product.discount_enabled ? Number(product.discount_percent) || 0 : 0,
    warranty: product.warranty.trim(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const payload = buildPayload();
      const saved = isEdit
        ? await api.updateProduct(editProduct.id, payload)
        : await api.createProduct(payload);

      setMessage({
        type: 'success',
        text: isEdit ? `"${saved.name}" update ho gaya! ✓` : `"${saved.name}" shop mein add ho gaya! ✓`,
      });

      if (!isEdit) {
        setProduct({ ...EMPTY_PRODUCT, image: getDefaultImage('Cases') });
      }

      if (onSuccess) onSuccess(saved);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const previewImage = product.image || getDefaultImage(product.category);

  return (
    <form className={`add-product-form ${compact ? 'compact' : ''}`} onSubmit={handleSubmit}>
      {!compact && (
        <div className="add-product-header">
          <h2>{isEdit ? '✏️ Product Edit Karein' : '➕ Naya Product Add Karein'}</h2>
          <p>Sab fields yahan se manage karein — code edit ki zaroorat nahi.</p>
        </div>
      )}

      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>
          {message.text}
        </div>
      )}

      <div className="add-product-layout">
        <div className="add-product-fields">
          <div className="form-group">
            <label>Product ka Naam *</label>
            <input
              value={product.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. iPhone 15 Silicone Case"
              required
              autoFocus={!isEdit}
            />
          </div>

          <div className="form-group">
            <label>Category *</label>
            <select
              value={product.category}
              onChange={(e) => handleCategoryPick(e.target.value)}
              className="category-select"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="category-chips">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-chip ${product.category === cat ? 'active' : ''}`}
                  onClick={() => handleCategoryPick(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>{t('sales.salePrice')} *</label>
              <div className="input-with-prefix">
                <span>Rs.</span>
                <input
                  type="number"
                  min="1"
                  value={product.price}
                  onChange={(e) => setField('price', e.target.value)}
                  placeholder="999"
                  required
                />
              </div>
              <p className="field-hint">{t('sales.salePriceHint')}</p>
            </div>
            <div className="form-group">
              <label>{t('sales.costPrice')}</label>
              <div className="input-with-prefix">
                <span>Rs.</span>
                <input
                  type="number"
                  min="0"
                  value={product.cost_price}
                  onChange={(e) => setField('cost_price', e.target.value)}
                  placeholder="700"
                />
              </div>
              <p className="field-hint">{t('sales.costPriceHint')}</p>
            </div>
          </div>

          <div className="form-group">
            <label>{t('sales.stock')} *</label>
            <div className="stock-stepper">
              <button type="button" onClick={() => setField('stock', String(Math.max(0, Number(product.stock || 0) - 1)))}>−</button>
              <input
                type="number"
                min="0"
                value={product.stock}
                onChange={(e) => setField('stock', e.target.value)}
                required
              />
              <button type="button" onClick={() => setField('stock', String(Number(product.stock || 0) + 1))}>+</button>
            </div>
          </div>

          <div className="form-group">
            <label>Description *</label>
            <textarea
              value={product.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Product ki detail likhein — quality, color, compatibility..."
              required
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Warranty</label>
            <input
              value={product.warranty}
              onChange={(e) => setField('warranty', e.target.value)}
              placeholder="e.g. 6 months replacement warranty"
            />
          </div>

          <div className="form-group">
            <label>Photo URL</label>
            <input
              value={product.image.startsWith('data:') ? '' : product.image}
              onChange={(e) => setField('image', e.target.value)}
              placeholder="https://... ya neeche se file upload karein"
            />
          </div>

          <div className="form-group">
            <label>Photo Upload (optional)</label>
            <input type="file" accept="image/*" onChange={handleImageFile} />
            <p className="field-hint">Max 2MB. Upload ya URL — dono mein se koi ek use karein.</p>
          </div>

          <DiscountPicker
            enabled={product.discount_enabled}
            percent={product.discount_percent}
            price={product.price}
            onToggle={(on) => setField('discount_enabled', on)}
            onChange={(pct) => {
              setProduct((prev) => ({
                ...prev,
                discount_enabled: true,
                discount_percent: pct,
              }));
            }}
          />

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={product.featured}
              onChange={(e) => setField('featured', e.target.checked)}
            />
            <span>⭐ Home page par Featured dikhayein</span>
          </label>
        </div>

        <aside className={`add-product-preview glass-card ${product.discount_enabled ? 'has-discount' : ''}`}>
          <span className="preview-label">Live Preview</span>
          <div className="preview-image">
            {product.discount_enabled && product.discount_percent > 0 && (
              <DiscountRibbon percent={product.discount_percent} />
            )}
            <img src={previewImage} alt="Preview" onError={(e) => { e.target.src = getDefaultImage(product.category); }} />
          </div>
          <span className="preview-cat">{product.category}</span>
          <h3>{product.name || 'Product Name'}</h3>
          <p className="preview-desc">{product.description || 'Description yahan dikhegi...'}</p>
          {product.warranty ? <p className="preview-warranty">🛡️ {product.warranty}</p> : null}
          <ProductPrice
            product={{
              price: Number(product.price) || 0,
              discount_percent: product.discount_enabled ? product.discount_percent : 0,
            }}
            size="lg"
          />
          {Number(product.cost_price) > 0 && (
            <p className="preview-cost">
              {t('sales.costPrice')}: Rs. {Number(product.cost_price).toLocaleString('en-PK')}
            </p>
          )}
          <span className="preview-stock">{product.stock || 0} in stock</span>
        </aside>
      </div>

      <div className="add-product-actions">
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-add-submit" disabled={submitting}>
          {submitting ? (isEdit ? 'Saving...' : 'Adding...') : isEdit ? '✓ Save Changes' : '✓ Product Add Karein'}
        </button>
      </div>
    </form>
  );
}
