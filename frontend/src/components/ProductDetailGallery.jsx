import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getProductDetailImages } from '../utils/productImages';
import { useTranslation } from '../context/LanguageContext';
import { lightboxBackdrop, lightboxImage, PAGE_EASE } from './motion/pageMotion';

function deviceHasHover() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

const ZOOM_SCALE = 2.2;
const SWIPE_THRESHOLD = 40;

/**
 * Product detail gallery — thumbnails, sale badge, hover zoom lens, fullscreen, mobile swipe.
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
  const { main, images } = useMemo(() => getProductDetailImages(product), [product]);
  const displayImages = images.length ? images : (main ? [main] : []);
  const selectedIndex = Math.max(0, displayImages.indexOf(activeImage || main));
  const [slideIndex, setSlideIndex] = useState(selectedIndex);
  const [fullscreen, setFullscreen] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0, bgX: 0, bgY: 0 });
  const [imgReady, setImgReady] = useState(false);
  const touchStartX = useRef(null);
  const imageWrapRef = useRef(null);
  const canHover = deviceHasHover();
  const reducedMotion = useReducedMotion();

  const selectSlide = useCallback((index) => {
    const idx = Math.max(0, Math.min(index, displayImages.length - 1));
    setSlideIndex(idx);
    onSelect?.(displayImages[idx]);
  }, [displayImages, onSelect]);

  useEffect(() => {
    setSlideIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    setImgReady(false);
  }, [slideIndex, product?.id]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'ArrowRight' && displayImages.length > 1) {
        selectSlide(slideIndex + 1);
      }
      if (e.key === 'ArrowLeft' && displayImages.length > 1) {
        selectSlide(slideIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen, slideIndex, displayImages.length, selectSlide]);

  const currentSrc = displayImages[slideIndex] || main;
  const hasMultiple = displayImages.length > 1;

  const handleMouseMove = (e) => {
    if (!canHover || reducedMotion) return;
    const wrap = imageWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lensSize = 140;
    const bgX = -(x * ZOOM_SCALE - lensSize / 2);
    const bgY = -(y * ZOOM_SCALE - lensSize / 2);
    setLensPos({
      x: Math.max(0, Math.min(x - lensSize / 2, rect.width - lensSize)),
      y: Math.max(0, Math.min(y - lensSize / 2, rect.height - lensSize)),
      bgX,
      bgY,
    });
  };

  const handleTouchStart = (e) => {
    if (canHover || !hasMultiple) return;
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e) => {
    if (canHover || !hasMultiple || touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      selectSlide(slideIndex + (delta < 0 ? 1 : -1));
    }
    touchStartX.current = null;
  };

  return (
    <div className={`product-detail-gallery-view ${hasMultiple ? 'has-gallery' : ''}`}>
      <div
        ref={imageWrapRef}
        className={`product-detail-image premium-product ${animKind} ${zooming ? 'is-zooming' : ''} ${imgReady ? 'is-img-ready' : ''}`}
        onMouseEnter={() => canHover && !reducedMotion && setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {onSale && (
          <>
            {DiscountRibbon ? <DiscountRibbon percent={product.discount_percent} /> : null}
            <span className="product-detail-sale-badge">-{product.discount_percent}%</span>
          </>
        )}
        {animKind === 'gaming' && <span className="premium-rgb-wave premium-rgb-wave--gaming" />}
        {animKind === 'charger' && <span className="premium-charge-ring premium-charge-ring--lg" />}

        {canHover && !reducedMotion ? (
          <div className="product-detail-image-stack">
            <img
              src={currentSrc}
              alt={product.name}
              className={`product-detail-stack-img is-active ${imgReady ? 'is-loaded' : ''}`}
              onLoad={() => setImgReady(true)}
            />
            {zooming && (
              <div
                className="product-detail-zoom-lens"
                style={{
                  left: lensPos.x,
                  top: lensPos.y,
                  backgroundImage: `url(${currentSrc})`,
                  backgroundSize: `${imageWrapRef.current?.offsetWidth * ZOOM_SCALE}px ${imageWrapRef.current?.offsetHeight * ZOOM_SCALE}px`,
                  backgroundPosition: `${lensPos.bgX}px ${lensPos.bgY}px`,
                }}
              />
            )}
          </div>
        ) : (
          <div
            className="product-detail-swipe-track"
            style={{ transform: `translateX(-${slideIndex * 100}%)` }}
          >
            {displayImages.map((url) => (
              <div key={url} className="product-detail-swipe-slide">
                <img
                  src={url}
                  alt={product.name}
                  className={imgReady ? 'is-loaded' : ''}
                  onLoad={() => setImgReady(true)}
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="product-detail-expand-btn"
          aria-label={t('product.expandImage')}
          onClick={() => setFullscreen(true)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>

        {hasMultiple && !canHover && (
          <>
            <span className="product-detail-tap-hint">{t('product.swipePhotos')}</span>
            <div className="product-detail-swipe-dots">
              {displayImages.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  className={`product-detail-swipe-dot ${i === slideIndex ? 'is-active' : ''}`}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => selectSlide(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {displayImages.length > 1 ? (
        <div className="product-detail-gallery">
          {displayImages.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`product-detail-gallery-thumb ${slideIndex === i ? 'is-active' : ''}`}
              onClick={() => selectSlide(i)}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      ) : null}

      <AnimatePresence>
        {fullscreen && (
          <motion.div
            className="product-detail-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            onClick={() => setFullscreen(false)}
            initial={lightboxBackdrop.initial}
            animate={lightboxBackdrop.animate}
            exit={lightboxBackdrop.exit}
            transition={{ duration: 0.22, ease: PAGE_EASE }}
          >
            <button
              type="button"
              className="product-detail-fullscreen-close"
              aria-label={t('product.closeQuickView')}
              onClick={() => setFullscreen(false)}
            >
              ✕
            </button>
            {hasMultiple && (
              <>
                <button
                  type="button"
                  className="product-detail-fullscreen-nav product-detail-fullscreen-nav--prev"
                  aria-label="Previous photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSlide(slideIndex - 1);
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="product-detail-fullscreen-nav product-detail-fullscreen-nav--next"
                  aria-label="Next photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSlide(slideIndex + 1);
                  }}
                >
                  ›
                </button>
              </>
            )}
            <motion.img
              key={currentSrc}
              src={currentSrc}
              alt={product.name}
              onClick={(e) => e.stopPropagation()}
              initial={reducedMotion ? false : lightboxImage.initial}
              animate={lightboxImage.animate}
              exit={lightboxImage.exit}
              transition={{ duration: 0.28, ease: PAGE_EASE }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
