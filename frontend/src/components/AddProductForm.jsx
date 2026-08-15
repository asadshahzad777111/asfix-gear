import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import DiscountPicker, { DiscountRibbon, ProductPrice } from './DiscountPicker';
import { CATEGORIES, EMPTY_PRODUCT, SHOP_BRANDS, getDefaultImage, isDefaultProductImage } from '../config/products';
import ModelMultiPicker from './ModelMultiPicker';
import { useTranslation } from '../context/LanguageContext';
import ProductImagePanel from './admin/product-editor/ProductImagePanel';
import ProductGalleryPanel from './admin/product-editor/ProductGalleryPanel';
import ProductCategoriesPanel from './admin/product-editor/ProductCategoriesPanel';
import ProductPublishPanel from './admin/product-editor/ProductPublishPanel';
import ProductTagsPanel from './admin/product-editor/ProductTagsPanel';
import ProductPermalinkPanel from './admin/product-editor/ProductPermalinkPanel';
import ProductBrandPanel from './admin/product-editor/ProductBrandPanel';
import RichTextEditor from './admin/product-editor/RichTextEditor';
import { uploadProductImageFile } from '../utils/productImageUpload';
import { resolveProductImagesForSave } from '../utils/productImages';
import { slugify } from '../utils/slug';

function isTransientImageUrl(url) {
  return String(url || '').startsWith('blob:') || String(url || '').startsWith('data:');
}

function productToForm(editProduct) {
  if (!editProduct) return { ...EMPTY_PRODUCT, gallery: [] };
  const rawImage = editProduct.image || '';
  const rawHover = editProduct.hover_image || '';
  let image = isDefaultProductImage(rawImage) ? '' : rawImage;
  let hover_image = isDefaultProductImage(rawHover) ? '' : rawHover;
  let gallery = Array.isArray(editProduct.gallery) ? [...editProduct.gallery] : [];
  // Promote first gallery photo only when Pic 1 is empty (not as hover)
  if (!image && gallery.length) {
    image = gallery[0];
    gallery = gallery.slice(1);
  }
  if (hover_image && hover_image === image) hover_image = '';
  gallery = gallery.filter((url) => url && url !== image && url !== hover_image);
  return {
    name: editProduct.name || '',
    category: editProduct.category || 'Cases',
    brand: editProduct.brand || '',
    compatible_models: editProduct.compatible_models || '',
    price: String(editProduct.price ?? ''),
    cost_price: String(editProduct.cost_price ?? ''),
    description: editProduct.description || '',
    slug: editProduct.slug || '',
    tags: Array.isArray(editProduct.tags) ? editProduct.tags : [],
    image,
    hover_image,
    gallery,
    stock: String(editProduct.stock ?? 0),
    featured: Boolean(editProduct.featured),
    discount_enabled: Number(editProduct.discount_percent) > 0,
    discount_percent: Number(editProduct.discount_percent) || 0,
    warranty: editProduct.warranty || '',
    barcode: editProduct.barcode || editProduct.sku || '',
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
  const slugTouchedRef = useRef(Boolean(editProduct?.slug));

  useEffect(() => {
    setProduct(productToForm(editProduct));
    slugTouchedRef.current = Boolean(editProduct?.slug);
    setImageUploadHint('');
    setMessage({ type: '', text: '' });
  }, [editProduct?.id]);

  const setField = (field, value) => {
    setProduct((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && !slugTouchedRef.current) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const handleCategoryPick = (cat) => {
    setProduct((prev) => ({
      ...prev,
      category: cat,
    }));
  };

  const handleGalleryChange = (gallery) => {
    setField('gallery', gallery);
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

  const buildPayload = (statusOverride) => {
    const { image, hover_image, gallery } = resolveProductImagesForSave(
      product.image,
      product.hover_image,
      product.gallery
    );
    return {
      name: product.name.trim(),
      category: product.category,
      brand: product.brand,
      compatible_models: product.compatible_models.trim(),
      price: Number(product.price),
      cost_price: Number(product.cost_price) || 0,
      description: product.description.trim(),
      slug: product.slug.trim() || slugify(product.name),
      tags: Array.isArray(product.tags) ? product.tags : [],
      image,
      hover_image,
      gallery,
      stock: Number(product.stock) || 0,
      featured: product.featured,
      discount_percent: product.discount_enabled ? Number(product.discount_percent) || 0 : 0,
      warranty: product.warranty.trim(),
      barcode: String(product.barcode || '').trim(),
      sku: String(product.barcode || '').trim(),
      status: statusOverride || product.status || 'published',
    };
  };

  const saveProduct = async (statusOverride) => {
    if (
      uploadingImage
      || String(product.image || '').startsWith('blob:')
      || String(product.hover_image || '').startsWith('blob:')
    ) {
      setMessage({ type: 'error', text: 'Photo upload complete hone ka wait karein.' });
      return null;
    }
    if (!product.name.trim() || !product.category || !Number(product.price)) {
      setMessage({ type: 'error', text: 'Name, category, and price are required.' });
      return null;
    }

    const resolved = resolveProductImagesForSave(product.image, product.hover_image, product.gallery);
    const publishStatus = statusOverride || product.status || 'published';
    if (publishStatus !== 'draft' && !resolved.image) {
      setMessage({
        type: 'error',
        text: 'Pic 1 (main image) zaroori hai — card / ad wali photo set karein.',
      });
      return null;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const payload = buildPayload(statusOverride);
      const saved = isEdit
        ? await api.updateProduct(editProduct.id, payload)
        : await api.createProduct(payload);

      if (statusOverride) {
        setField('status', statusOverride);
      }
      if (saved.slug) {
        slugTouchedRef.current = true;
        setField('slug', saved.slug);
      }
      // Keep form in sync with what was saved
      setProduct((prev) => ({
        ...prev,
        image: saved.image || payload.image || '',
        hover_image: saved.hover_image ?? payload.hover_image ?? '',
        gallery: Array.isArray(saved.gallery) ? saved.gallery : payload.gallery,
      }));

      const statusLabel = payload.status === 'draft' ? 'draft saved' : 'published';
      setMessage({
        type: 'success',
        text: isEdit
          ? `"${saved.name}" updated (${statusLabel}) ✓`
          : `"${saved.name}" added to shop (${statusLabel}) ✓`,
      });

      if (!isEdit) {
        setProduct({ ...EMPTY_PRODUCT, gallery: [] });
        slugTouchedRef.current = false;
      }

      if (onSuccess) onSuccess(saved);
      return saved;
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveProduct();
  };

  const handleSaveDraft = async () => {
    setField('status', 'draft');
    await saveProduct('draft');
  };

  const handlePublish = async () => {
    setField('status', 'published');
    await saveProduct('published');
  };

  const previewImage = (!isDefaultProductImage(product.image) && product.image)
    || product.gallery?.[0]
    || getDefaultImage(product.category);
  const sidebarHint = (text) => {
    if (!text) return;
    setMessage({ type: text.includes('✓') ? 'success' : 'error', text });
  };

  const brandFields = wpLayout ? (
    <ProductBrandPanel
      brand={product.brand}
      compatibleModels={product.compatible_models}
      onBrandChange={(value) => setField('brand', value)}
      onCompatibleModelsChange={(value) => setField('compatible_models', value)}
    />
  ) : (
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
  );

  const descriptionField = wpLayout ? (
    <div className="form-group">
      <label id="product-description-label" htmlFor="product-description">Product description</label>
      <RichTextEditor
        id="product-description"
        value={product.description}
        onChange={(html) => setField('description', html)}
      />
    </div>
  ) : (
    <div className="form-group">
      <label>Description (optional)</label>
      <textarea
        value={product.description}
        onChange={(e) => setField('description', e.target.value)}
        placeholder="Product ki detail likhein — quality, color, compatibility..."
        rows={3}
      />
    </div>
  );

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

      {wpLayout && (
        <ProductPermalinkPanel
          slug={product.slug}
          name={product.name}
          productId={isEdit ? editProduct.id : null}
          onSlugChange={(value) => setField('slug', value)}
          onSlugTouched={() => { slugTouchedRef.current = true; }}
        />
      )}

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

      {!wpLayout && brandFields}

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
        <label>{t('sales.barcode')}</label>
        <input
          value={product.barcode}
          onChange={(e) => setField('barcode', e.target.value)}
          placeholder={t('sales.barcodePh')}
          autoComplete="off"
          inputMode="text"
        />
        <p className="field-hint">{t('sales.barcodeHint')}</p>
      </div>

      {descriptionField}

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
            <ProductPublishPanel
              status={product.status}
              onStatusChange={(value) => setField('status', value)}
              productId={isEdit ? editProduct.id : null}
              onSaveDraft={handleSaveDraft}
              onPublish={handlePublish}
              submitting={submitting}
              disabled={uploadingImage}
            />
            <ProductImagePanel
              image={product.image}
              uploading={uploadingImage}
              onUploadingChange={setUploadingImage}
              onImageChange={(url) => setField('image', url)}
              onMessage={sidebarHint}
              title="Pic 1 — Card / Ad"
              emptyText="No image yet — yeh photo ads & shop cards pe dikhegi"
              hint="Default photo — hamesha card / ad pe pehli nazar aati hai."
              setLabel="Set Pic 1"
              replaceLabel="Replace Pic 1"
              removeLabel="Remove Pic 1"
            />
            <ProductImagePanel
              image={product.hover_image}
              uploading={uploadingImage}
              onUploadingChange={setUploadingImage}
              onImageChange={(url) => setField('hover_image', url)}
              onMessage={sidebarHint}
              title="Hover image"
              emptyText="Optional — mouse / thumb pass lanay par card pe swap hogi"
              hint="Sirf card hover / thumb pe dikhegi — product details mein show nahi hogi."
              setLabel="Set hover image"
              replaceLabel="Replace hover image"
              removeLabel="Remove hover image"
            />
            <ProductGalleryPanel
              gallery={product.gallery}
              uploading={uploadingImage}
              onUploadingChange={setUploadingImage}
              onGalleryChange={handleGalleryChange}
              onMessage={sidebarHint}
            />
            <ProductCategoriesPanel
              category={product.category}
              onCategoryChange={handleCategoryPick}
              onMessage={sidebarHint}
            />
            {brandFields}
            <ProductTagsPanel
              tags={product.tags}
              onChange={(tags) => setField('tags', tags)}
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
