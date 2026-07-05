import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getProductCardImages } from '../utils/productImages';
import { useTranslation } from '../context/LanguageContext';

function deviceHasHover() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Premium 3-photo viewer — main + up to 2 gallery images with crossfade / slide.
 */
export default function ProductDetailGallery({
  product,
  activeImage,
  onSelect,
  onSale,
  animKind,
  DiscountRibbon,
}) {
  const { t } = useTranslation();
  const { main, images } = useMemo(() => getProductCardImages(product), [product]);
  const [hoverIndex, setHoverIndex] = useState(0);
  const [tapIndex, setTapIndex] = useState(0);
  const cycleTimer = useRef(null);
  const canHover = deviceHasHover();
  const reducedMotion = prefersReducedMotion();

  const displayImages = images.length ? images : [main];
  const selectedIndex = Math.max(0, displayImages.indexOf(activeImage || main));
  const previewIndex = canHover ? hoverIndex : tapIndex;
  const showIndex = activeImage && displayImages.includes(activeImage) ? selectedIndex : previewIndex;
  const currentSrc = displayImages[showIndex] || main;
  const hasMultiple = displayImages.length > 1;
  const onThird = showIndex === 2 && displayImages.length >= 3;

  const clearCycle = useCallback(() => {
    if (cycleTimer.current) {
      clearInterval(cycleTimer.current);
      cycleTimer.current = null;
    }
  }, []);

  const startCycle = useCallback(() => {
    if (!hasMultiple || reducedMotion) return;
    clearCycle();
    cycleTimer.current = window.setInterval(() => {
      setHoverIndex((prev) => (prev + 1) % displayImages.length);
    }, 1400);
  }, [clearCycle, displayImages.length, hasMultiple, reducedMotion]);

  useEffect(() => () => clearCycle(), [clearCycle]);

  const handleEnter = () => {
    if (!canHover || !hasMultiple) return;
    setHoverIndex(selectedIndex);
    startCycle();
  };

  const handleLeave = () => {
    clearCycle();
    setHoverIndex(selectedIndex);
  };

  const handleTapCycle = () => {
    if (canHover || !hasMultiple) return;
    setTapIndex((prev) => {
      const next = (prev + 1) % displayImages.length;
      onSelect?.(displayImages[next]);
      return next;
    });
  };

  return (
    <div className={`product-detail-gallery-view ${hasMultiple ? 'has-gallery' : ''} ${onThird ? 'is-third' : ''}`}>
      <div
        className={`product-detail-image premium-product ${animKind}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleTapCycle}
        role={hasMultiple && !canHover ? 'button' : undefined}
        tabIndex={hasMultiple && !canHover ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTapCycle();
          }
        }}
        aria-label={hasMultiple ? t('product.cyclePhotos') : undefined}
      >
        {onSale && DiscountRibbon ? <DiscountRibbon percent={product.discount_percent} /> : null}
        {animKind === 'gaming' && <span className="premium-rgb-wave premium-rgb-wave--gaming" />}
        {animKind === 'charger' && <span className="premium-charge-ring premium-charge-ring--lg" />}

        <div className="product-detail-image-stack">
          {displayImages.map((url, index) => (
            <img
              key={url}
              src={url}
              alt={index === showIndex ? product.name : ''}
              aria-hidden={index !== showIndex}
              className={`product-detail-stack-img ${index === showIndex ? 'is-active' : ''}`}
            />
          ))}
        </div>

        {onThird && (
          <span className="product-detail-third-badge" aria-hidden="true">
            ✦ {t('product.premiumFinish')}
          </span>
        )}

        {hasMultiple && !canHover && (
          <span className="product-detail-tap-hint">{t('product.tapForPhotos')}</span>
        )}
      </div>

      {displayImages.length > 1 ? (
        <div className="product-detail-gallery">
          {displayImages.map((url) => (
            <button
              key={url}
              type="button"
              className={`product-detail-gallery-thumb ${activeImage === url || (!activeImage && url === main) ? 'is-active' : ''}`}
              onClick={() => {
                clearCycle();
                onSelect?.(url);
                const idx = displayImages.indexOf(url);
                setHoverIndex(idx);
                setTapIndex(idx);
              }}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
