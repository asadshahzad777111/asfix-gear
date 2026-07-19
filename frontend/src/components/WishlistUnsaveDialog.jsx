import { useEffect, useRef } from 'react';
import { useTranslation } from '../context/LanguageContext';
import useModalBehavior from '../hooks/useModalBehavior';
import './wishlist-unsave-dialog.css';

/**
 * Professional confirm before removing a saved wishlist item.
 * Yes = unsave · Keep = stay on wishlist.
 */
export default function WishlistUnsaveDialog({
  open,
  product,
  image,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const confirmRef = useRef(null);
  useModalBehavior(open, onCancel);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    // Focus primary keep action — safer default
    window.setTimeout(() => confirmRef.current?.focus?.(), 40);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !product) return null;

  const name = product.name || t('wishlist.unsaveFallbackName');
  const thumb = image || product.image || '';

  return (
    <div className="modal-overlay wl-unsave-overlay" onClick={onCancel} role="presentation">
      <div
        className="wl-unsave-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wl-unsave-title"
        aria-describedby="wl-unsave-desc"
      >
        <div className="wl-unsave-glow" aria-hidden="true" />

        <div className="wl-unsave-media">
          {thumb ? (
            <img src={thumb} alt="" />
          ) : (
            <span className="wl-unsave-media-fallback" aria-hidden="true">♡</span>
          )}
          <span className="wl-unsave-heart" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                d="M12 21s-6.2-4.35-9.33-8.22C.7 10.2.9 6.9 3.4 5.05A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.6-1.05c2.5 1.85 2.7 5.15.73 7.73C18.2 16.65 12 21 12 21z"
                fill="currentColor"
              />
            </svg>
          </span>
        </div>

        <p className="wl-unsave-eyebrow">{t('wishlist.unsaveEyebrow')}</p>
        <h2 id="wl-unsave-title">{t('wishlist.unsaveTitle')}</h2>
        <p id="wl-unsave-desc" className="wl-unsave-desc">
          {t('wishlist.unsaveBody', { name })}
        </p>

        <div className="wl-unsave-actions">
          <button
            ref={confirmRef}
            type="button"
            className="wl-unsave-btn wl-unsave-btn--keep"
            onClick={onCancel}
          >
            {t('wishlist.unsaveKeep')}
          </button>
          <button
            type="button"
            className="wl-unsave-btn wl-unsave-btn--remove"
            onClick={onConfirm}
          >
            {t('wishlist.unsaveYes')}
          </button>
        </div>
      </div>
    </div>
  );
}
