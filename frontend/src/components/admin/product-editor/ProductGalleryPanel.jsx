import { useRef } from 'react';
import { MAX_GALLERY_IMAGES } from '../../../config/products';
import { uploadProductImageFile } from '../../../utils/productImageUpload';

/** Extra photos for the product detail page only (not card hover). */
export default function ProductGalleryPanel({
  gallery = [],
  uploading,
  onUploadingChange,
  onGalleryChange,
  onMessage,
}) {
  const fileRef = useRef(null);
  const atMax = gallery.length >= MAX_GALLERY_IMAGES;

  const addImages = () => {
    if (atMax) return;
    fileRef.current?.click();
  };

  const handleFiles = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;

    const remaining = MAX_GALLERY_IMAGES - gallery.length;
    const batch = files.slice(0, remaining);
    onUploadingChange(true);
    onMessage?.('');

    try {
      const next = [...gallery];
      for (const file of batch) {
        const url = await uploadProductImageFile(file);
        next.push(url);
      }
      onGalleryChange(next);
      onMessage?.(`${batch.length} detail gallery image(s) added ✓`);
    } catch (err) {
      onMessage?.(err.message || 'Gallery upload failed');
    } finally {
      onUploadingChange(false);
      e.target.value = '';
    }
  };

  const removeAt = (index) => {
    onGalleryChange(gallery.filter((_, i) => i !== index));
  };

  return (
    <div className="wp-postbox wp-product-gallery">
      <div className="wp-postbox-head">Detail gallery</div>
      <div className="wp-postbox-body">
        {gallery.length > 0 ? (
          <ul className="wp-product-gallery-grid">
            {gallery.map((url, index) => (
              <li key={`${url}-${index}`}>
                <img src={url} alt="" />
                <button type="button" className="wp-product-gallery-remove" onClick={() => removeAt(index)} aria-label="Remove">
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-product-hint">
            Detail page ki extra photos yahan — product open hone par yeh dikhengi (hover wali nahi).
          </p>
        )}
        <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={addImages} disabled={uploading || atMax}>
          Add detail photos
        </button>
        <p className="wp-product-hint">{gallery.length}/{MAX_GALLERY_IMAGES} detail photos</p>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      </div>
    </div>
  );
}
