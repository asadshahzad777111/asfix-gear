import { useRef } from 'react';
import { MAX_GALLERY_IMAGES } from '../../../config/products';
import { uploadProductImageFile } from '../../../utils/productImageUpload';

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
      onMessage?.(`${batch.length} gallery image(s) added ✓`);
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
      <div className="wp-postbox-head">Product gallery</div>
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
          <p className="wp-product-hint">Main image alag hoti hai — yahan 2 extra photos add karein (total 3).</p>
        )}
        <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={addImages} disabled={uploading || atMax}>
          Add to gallery
        </button>
        <p className="wp-product-hint">{gallery.length}/{MAX_GALLERY_IMAGES} gallery · Main + 2 gallery = 3 photos</p>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      </div>
    </div>
  );
}
