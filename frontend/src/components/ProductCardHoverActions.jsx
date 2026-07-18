import { useTranslation } from '../context/LanguageContext';

export default function ProductCardHoverActions({
  onQuickView,
  onToggleWishlist,
  wishlisted = false,
  className = '',
}) {
  const { t } = useTranslation();

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const bindStop = (handler) => (e) => {
    stop(e);
    handler?.();
  };

  return (
    <div
      className={`product-card-hover-actions ${className}`.trim()}
      aria-hidden="false"
      onClick={stop}
      onPointerDown={stop}
    >
      <button
        type="button"
        className={`product-card-action-btn product-card-action-btn--wish ${wishlisted ? 'is-active' : ''}`}
        aria-label={wishlisted ? t('product.removeWishlist') : t('product.addWishlist')}
        aria-pressed={wishlisted}
        onClick={bindStop(onToggleWishlist)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="currentColor"
          />
        </svg>
      </button>
      <button
        type="button"
        className="product-card-action-btn product-card-action-btn--view"
        aria-label={t('product.quickView')}
        onClick={bindStop(onQuickView)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );
}
