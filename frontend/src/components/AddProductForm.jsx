import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DiscountPicker, { DiscountRibbon, ProductPrice } from './DiscountPicker';
import { CATEGORIES, EMPTY_PRODUCT, DEFAULT_IMAGES, SHOP_BRANDS, getDefaultImage } from '../config/products';
import ModelMultiPicker from './ModelMultiPicker';
import { useTranslation } from '../context/LanguageContext';
import ProductImagePanel from './admin/product-editor/ProductImagePanel';
import ProductGalleryPanel from './admin/product-editor/ProductGalleryPanel';
import ProductCategoriesPanel from './admin/product-editor/ProductCategoriesPanel';
import ProductPublishPanel from './admin/product-editor/ProductPublishPanel';
import { uploadProductImageFile } from '../utils/productImageUpload';

const isDefaultImage = (url) => Object.values(DEFAULT_IMAGES).includes(url);

function isTransientImageUrl(url) {
  return String(url || '').startsWith('blob:') || String(url || '').startsWith('data:');
}

function productToForm(editProduct) {
  if (!editProduct) return { ...EMPTY_PRODUCT, image: getDefaultImage('Cases'), gallery: [] };
  return {
    name: editProduct.name || '',
    category: editProduct.category || 'Cases',
    brand: editProduct.brand || '',
    compatible_models: editProduct.compatible_models || '',
    price: String(editProduct.price ?? ''),
    cost_price: String(editProduct.cost_price ?? ''),
    description: editProduct.description || '',
    image: editProduct.image || getDefaultImage(editProduct.category),
    gallery: Array.isArray(editProduct.gallery) ? editProduct.gallery : [],
    stock: String(editProduct.stock ?? 0),
    featured: Boolean(editProduct.featured),
    discount_enabled: Number(editProduct.discount_percent) > 0,
    discount_percent: Number(editProduct.discount_percent) || 0,
    warranty: editProduct.warranty || '',
    status: editProduct.status || 'published',
  };
}

export default function AddProductForm({
  onSuccess,
  onCancel,
  compact = false,
  wpLayout = false,
  editProduct = null,
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(editProduct?.id);
  const [product, setProduct] = useState(() => productToForm(editProduct));
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadHint, setImageUploadHint] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setProduct(productToForm(editProduct));
    setImageUploadHint('');
    setMessage({ type: '', text: '' });
  }, [editProduct?.id]);

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

  const handleImageFile = async (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setUploadingImage(true);
    setMessage({ type: '', text: '' });
    setImageUploadHint('Photo compress/upload ho rahi hai…');
    const previousImage = product.image;
    try {
      const url = await uploadProductImageFile(picked, { onPreview: (preview) => setField('image', preview) });
      setField('image', url);
      setImageUploadHint('Photo cloud par save ✓ Ab Save Changes dabayein.');
      setMessage({ type: 'success', text: 'Photo upload ho gayi ✓' });
    } catch (err) {
      setField('image', previousImage);
      setImageUploadHint('');
      setMessage({ type: 'error', text: err.message || 'Upload fail — Photo URL paste karein.' });
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const buildPayload = () => ({
    name: product.name.trim(),
    category: product.category,
    brand: product.brand,
    compatible_models: product.compatible_models.trim(),
    price: Number(product.price),
    cost_price: Number(product.cost_price) || 0,
    description: product.description.trim(),
    image: product.image.trim() || getDefaultImage(product.category),
    gallery: (product.gallery || []).filter((url) => url && !String(url).startsWith('blob:')),
    stock: Number(product.stock) || 0,
    featured: product.featured,
    discount_percent: product.discount_enabled ? Number(product.discount_percent) || 0 : 0,
    warranty: product.warranty.trim(),
    status: product.status || 'published',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploadingImage || product.image.startsWith('blob:')) {
      setMessage({ type: 'error', text: 'Photo upload complete hone ka wait karein.' });
      return;
    }

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
        setProduct({ ...EMPTY_PRODUCT, image: getDefaultImage('Cases'), gallery: [] });
      }

      if (onSuccess) onSuccess(saved);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const previewImage = product.image || getDefaultImage(product.category);
  const sidebarHint = (text) => {
    if (!text) return;
    setMessage({ type: text.includes('✓') ? 'success' : 'error', text });
  };

  const mainFields = (
    <>
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

      {!wpLayout && (
        <div className="form-group">
          <label>Category *</label>
          <div className="category-chips" role="radiogroup" aria-label="Category">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={product.category === cat}
                className={`category-chip ${product.category === cat ? 'active' : ''}`}
                onClick={() => handleCategoryPick(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-row-2">
        <div className="form-group">
          <label>Brand</label>
          <select
            value={product.brand}
            onChange={(e) => setField('brand', e.target.value)}
            className="category-select"
          >
            <option value="">Universal / Not brand-specific</option>
            {SHOP_BRANDS.map((b) => (
              <option key={b.id} value={b.id}>{b.icon} {b.label}</option>
            ))}
          </select>
          <p className="field-hint">Isse yeh product Shop brand filter mein sahi jagah dikhega.</p>
        </div>
        <div className="form-group">
          <label>Compatible Model(s)</label>
          <ModelMultiPicker
            brand={product.brand}
            value={product.compatible_models}
            onChange={(v) => setField('compatible_models', v)}
          />
        </div>
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label>{t('sales.salePrice')} *</label>
          <div className="input-with-prefix">
            <span>Rs.</span>
            <input type="number" min="1" value={product.price} onChange={(e) => setField('price', e.target.value)} placeholder="999" required />
          </div>
        </div>
        <div className="form-group">
          <label>{t('sales.costPrice')}</label>
          <div className="input-with-prefix">
            <span>Rs.</span>
            <input type="number" min="0" value={product.cost_price} onChange={(e) => setField('cost_price', e.target.value)} placeholder="700" />
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>{t('sales.stock')} *</label>
        <div className="stock-stepper">
          <button type="button" onClick={() => setField('stock', String(Math.max(0, Number(product.stock || 0) - 1)))}>−</button>
          <input type="number" min="0" value={product.stock} onChange={(e) => setField('stock', e.target.value)} required />
          <button type="button" onClick={() => setField('stock', String(Number(product.stock || 0) + 1))}>+</button>
        </div>
      </div>

      <div className="form-group">
        <label>{wpLayout ? 'Product description' : 'Description (optional)'}</label>
        <textarea
          value={product.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="Product ki detail likhein — quality, color, compatibility..."
          rows={wpLayout ? 6 : 3}
        />
      </div>

      <div className="form-group">
        <label>Warranty</label>
        <input value={product.warranty} onChange={(e) => setField('warranty', e.target.value)} placeholder="e.g. 6 months replacement warranty" />
      </div>

      {!wpLayout && (
        <>
          <div className="form-group">
            <label>Photo URL</label>
            <input
              value={isTransientImageUrl(product.image) ? '' : product.image}
              onChange={(e) => { setImageUploadHint(''); setField('image', e.target.value); }}
              placeholder="https://... ya neeche se file upload karein"
            />
          </div>
          <div className="form-group">
            <label>Photo Upload</label>
            <input type="file" accept="image/*" onChange={handleImageFile} disabled={uploadingImage} />
            <p className={`field-hint${imageUploadHint.includes('✓') ? ' field-hint-ok' : ''}`}>
              {uploadingImage ? 'Compress + upload…' : imageUploadHint || 'File choose karein, phir Save Changes.'}
            </p>
          </div>
        </>
      )}

      <DiscountPicker
        enabled={product.discount_enabled}
        percent={product.discount_percent}
        price={product.price}
        onToggle={(on) => setField('discount_enabled', on)}
        onChange={(pct) => setProduct((prev) => ({ ...prev, discount_enabled: true, discount_percent: pct }))}
      />

      <label className="checkbox-row">
        <input type="checkbox" checked={product.featured} onChange={(e) => setField('featured', e.target.checked)} />
        <span>⭐ Home page par Featured dikhayein</span>
      </label>
    </>
  );

  return (
    <form className={`add-product-form ${compact ? 'compact' : ''} ${wpLayout ? 'add-product-form--wp' : ''}`} onSubmit={handleSubmit}>
      {!compact && !wpLayout && (
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

      {wpLayout ? (
        <div className="wp-product-editor">
          <div className="wp-product-editor-main">{mainFields}</div>
          <aside className="wp-product-editor-sidebar">
            <ProductImagePanel
              image={product.image}
              category={product.category}
              uploading={uploadingImage}
              onUploadingChange={setUploadingImage}
              onImageChange={(url) => setField('image', url)}
              onMessage={sidebarHint}
            />
            <ProductGalleryPanel
              gallery={product.gallery}
              uploading={uploadingImage}
              onUploadingChange={setUploadingImage}
              onGalleryChange={(gallery) => setField('gallery', gallery)}
              onMessage={sidebarHint}
            />
            <ProductCategoriesPanel
              category={product.category}
              onCategoryChange={handleCategoryPick}
              onMessage={sidebarHint}
            />
            <ProductPublishPanel
              status={product.status}
              onStatusChange={(value) => setField('status', value)}
              productId={isEdit ? editProduct.id : null}
            />
          </aside>
        </div>
      ) : (
        <div className="add-product-layout">
          <div className="add-product-fields">{mainFields}</div>
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
              product={{ price: Number(product.price) || 0, discount_percent: product.discount_enabled ? product.discount_percent : 0 }}
              size="lg"
            />
            <span className="preview-stock">{product.stock || 0} in stock</span>
          </aside>
        </div>
      )}

      <div className="add-product-actions">
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" className={`${wpLayout ? 'wp-button' : 'btn btn-primary btn-add-submit'}`} disabled={submitting || uploadingImage}>
          {submitting ? (isEdit ? 'Saving...' : 'Adding...') : isEdit ? '✓ Save Changes' : '✓ Product Add Karein'}
        </button>
      </div>
    </form>
  );
}
