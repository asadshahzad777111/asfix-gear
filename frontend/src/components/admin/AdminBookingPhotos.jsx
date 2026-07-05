import { useRef, useState } from 'react';
import { api } from '../../api/client';
import { uploadProductImageFile } from '../../utils/productImageUpload';

const MAX_PHOTOS = 4;

export default function AdminBookingPhotos({ booking, onUpdated }) {
  const beforeInput = useRef(null);
  const afterInput = useRef(null);
  const [uploading, setUploading] = useState({ before: false, after: false });
  const [error, setError] = useState('');

  const uploadKind = async (kind, file) => {
    if (!file) return;
    setError('');
    setUploading((prev) => ({ ...prev, [kind]: true }));
    try {
      const url = await uploadProductImageFile(file);
      const field = kind === 'before' ? 'photos_before' : 'photos_after';
      const existing = booking[field] || [];
      if (existing.length >= MAX_PHOTOS) {
        throw new Error(`Maximum ${MAX_PHOTOS} photos allowed`);
      }
      const updated = await api.updateBookingPhotos(booking.id, {
        [field]: [...existing, url],
      });
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [kind]: false }));
      if (kind === 'before' && beforeInput.current) beforeInput.current.value = '';
      if (kind === 'after' && afterInput.current) afterInput.current.value = '';
    }
  };

  const removePhoto = async (kind, url) => {
    setError('');
    const field = kind === 'before' ? 'photos_before' : 'photos_after';
    const next = (booking[field] || []).filter((item) => item !== url);
    try {
      const updated = await api.updateBookingPhotos(booking.id, { [field]: next });
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Could not remove photo');
    }
  };

  return (
    <div className="admin-booking-photos">
      <span className="admin-booking-label">Before / After Photos</span>
      {error && <p className="admin-booking-photo-error">{error}</p>}

      <div className="admin-booking-photo-section">
        <strong>Before</strong>
        <div className="admin-booking-photo-row">
          {(booking.photos_before || []).map((url) => (
            <div key={url} className="admin-booking-photo-thumb">
              <img src={url} alt="" loading="lazy" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePhoto('before', url)}>×</button>
            </div>
          ))}
          {(booking.photos_before || []).length < MAX_PHOTOS && (
            <>
              <input
                ref={beforeInput}
                type="file"
                accept="image/*"
                className="sr-only"
                id={`booking-before-${booking.id}`}
                onChange={(e) => uploadKind('before', e.target.files?.[0])}
              />
              <label htmlFor={`booking-before-${booking.id}`} className="btn btn-outline btn-sm">
                {uploading.before ? '…' : '+ Before'}
              </label>
            </>
          )}
        </div>
      </div>

      <div className="admin-booking-photo-section">
        <strong>After</strong>
        <div className="admin-booking-photo-row">
          {(booking.photos_after || []).map((url) => (
            <div key={url} className="admin-booking-photo-thumb">
              <img src={url} alt="" loading="lazy" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePhoto('after', url)}>×</button>
            </div>
          ))}
          {(booking.photos_after || []).length < MAX_PHOTOS && (
            <>
              <input
                ref={afterInput}
                type="file"
                accept="image/*"
                className="sr-only"
                id={`booking-after-${booking.id}`}
                onChange={(e) => uploadKind('after', e.target.files?.[0])}
              />
              <label htmlFor={`booking-after-${booking.id}`} className="btn btn-outline btn-sm">
                {uploading.after ? '…' : '+ After'}
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
