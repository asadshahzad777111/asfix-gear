import { useRef } from 'react';
import { isDefaultProductImage } from '../../../config/products';
import { uploadProductImageFile } from '../../../utils/productImageUpload';

/**
 * Reusable single-image picker for Pic 1 (main) or Hover image.
 */
export default function ProductImagePanel({
  image,
  uploading,
  onUploadingChange,
  onImageChange,
  onMessage,
  title = 'Pic 1 — Card / Ad',
  emptyText = 'No image yet — yeh photo ads & shop cards pe dikhegi',
  hint = 'Default photo — hamesha card / ad pe pehli nazar aati hai.',
  setLabel = 'Set main image',
  replaceLabel = 'Replace main image',
  removeLabel = 'Remove main image',
}) {
  const fileRef = useRef(null);
  const customImage = !isDefaultProductImage(image) ? String(image || '').trim() : '';
  const hasCustom = Boolean(customImage);

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    onUploadingChange(true);
    onMessage?.('');
    try {
      const url = await uploadProductImageFile(picked, { onPreview: onImageChange });
      onImageChange(url);
      onMessage?.(`${title} set ✓ Save Changes dabayein.`);
    } catch (err) {
      onMessage?.(err.message || 'Upload failed');
    } finally {
      onUploadingChange(false);
      e.target.value = '';
    }
  };

  return (
    <div className="wp-postbox wp-product-image">
      <div className="wp-postbox-head">{title}</div>
      <div className="wp-postbox-body">
        <div className={`wp-product-image-preview${hasCustom ? '' : ' is-empty'}`}>
          {hasCustom ? (
            <img src={customImage} alt="" />
          ) : (
            <span className="wp-product-image-empty">{emptyText}</span>
          )}
        </div>
        <div className="wp-product-image-actions">
          <button type="button" className="wp-button wp-button--link" onClick={pickFile} disabled={uploading}>
            {hasCustom ? replaceLabel : setLabel}
          </button>
          {hasCustom ? (
            <button
              type="button"
              className="wp-button wp-button--link wp-product-link-danger"
              onClick={() => onImageChange('')}
            >
              {removeLabel}
            </button>
          ) : null}
        </div>
        <input
          type="url"
          className="wp-product-image-url"
          placeholder="Image URL paste karein (optional)"
          value={String(customImage).startsWith('blob:') ? '' : customImage}
          onChange={(e) => onImageChange(e.target.value)}
        />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <p className="wp-product-hint">{hint}</p>
        {uploading ? <p className="wp-product-hint">Uploading…</p> : null}
      </div>
    </div>
  );
}
