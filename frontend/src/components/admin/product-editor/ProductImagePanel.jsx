import { useRef } from 'react';
import { getDefaultImage } from '../../config/products';
import { uploadProductImageFile } from '../../utils/productImageUpload';

export default function ProductImagePanel({
  image,
  category,
  uploading,
  onUploadingChange,
  onImageChange,
  onMessage,
}) {
  const fileRef = useRef(null);
  const preview = image || getDefaultImage(category);
  const hasCustom = Boolean(image && image !== getDefaultImage(category));

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    onUploadingChange(true);
    onMessage?.('');
    try {
      const url = await uploadProductImageFile(picked, { onPreview: onImageChange });
      onImageChange(url);
      onMessage?.('Product image set ✓ Save Changes dabayein.');
    } catch (err) {
      onMessage?.(err.message || 'Upload failed');
    } finally {
      onUploadingChange(false);
      e.target.value = '';
    }
  };

  return (
    <div className="wp-postbox wp-product-image">
      <div className="wp-postbox-head">Product image</div>
      <div className="wp-postbox-body">
        <div className="wp-product-image-preview">
          <img src={preview} alt="" onError={(e) => { e.target.src = getDefaultImage(category); }} />
        </div>
        <div className="wp-product-image-actions">
          <button type="button" className="wp-button wp-button--link" onClick={pickFile} disabled={uploading}>
            {hasCustom ? 'Replace product image' : 'Set product image'}
          </button>
          {hasCustom ? (
            <button
              type="button"
              className="wp-button wp-button--link wp-product-link-danger"
              onClick={() => onImageChange(getDefaultImage(category))}
            >
              Remove product image
            </button>
          ) : null}
        </div>
        <input
          type="url"
          className="wp-product-image-url"
          placeholder="Image URL paste karein"
          value={String(image || '').startsWith('blob:') ? '' : (image || '')}
          onChange={(e) => onImageChange(e.target.value)}
        />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <p className="wp-product-hint">Featured photo — gallery mein 2 aur add karein (3 total).</p>
        {uploading ? <p className="wp-product-hint">Uploading…</p> : null}
      </div>
    </div>
  );
}
