import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductCardImages } from '../utils/productImages';

const HOVER_DELAY_MS = 120;
const TAP_FLASH_MS = 380;

function deviceHasHover() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Shop-card image swap — main + gallery[0] as second image on hover (desktop) or tap flash (mobile).
 */
export default function useProductCardImage(product, { popping = false } = {}) {
  const { main: mainImage, images } = getProductCardImages(product);
  const hoverImage = images[1] || null;
  const thirdImage = images[2] || null;
  const hasGallery = images.length > 1;
  const [imageIndex, setImageIndex] = useState(0);
  const hoverTimer = useRef(null);
  const tapTimer = useRef(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  const clearTapTimer = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
  }, []);

  const resetIndex = useCallback(() => setImageIndex(0), []);

  useEffect(() => {
    resetIndex();
    clearHoverTimer();
    clearTapTimer();
  }, [mainImage, images.join('|'), clearHoverTimer, clearTapTimer, resetIndex]);

  useEffect(() => {
    if (popping && hasGallery) {
      setImageIndex(1);
      clearTapTimer();
    }
  }, [popping, hasGallery, clearTapTimer]);

  const showAltImage = useCallback(() => {
    if (!hasGallery) return;
    setImageIndex(1);
  }, [hasGallery]);

  const onMouseEnter = useCallback(() => {
    if (!hasGallery || !deviceHasHover()) return;
    clearHoverTimer();
    if (prefersReducedMotion()) {
      showAltImage();
      return;
    }
    hoverTimer.current = window.setTimeout(showAltImage, HOVER_DELAY_MS);
  }, [hasGallery, clearHoverTimer, showAltImage]);

  const onMouseLeave = useCallback(() => {
    if (!deviceHasHover()) return;
    clearHoverTimer();
    if (!popping) resetIndex();
  }, [popping, clearHoverTimer, resetIndex]);

  /** Mobile tap flash — brief 2nd image, not sticky */
  const onTouchStart = useCallback(() => {
    if (!hasGallery || deviceHasHover()) return;
    clearTapTimer();
    showAltImage();
  }, [hasGallery, clearTapTimer, showAltImage]);

  const onTouchEnd = useCallback(() => {
    if (!hasGallery || deviceHasHover() || popping) return;
    clearTapTimer();
    tapTimer.current = window.setTimeout(resetIndex, TAP_FLASH_MS);
  }, [hasGallery, popping, clearTapTimer, resetIndex]);

  const onPointerDown = useCallback(() => {
    /* noop — image swap handled by hover / touch; keep for API compat */
  }, []);

  const onPointerUp = useCallback(() => {
    if (popping || !hasGallery || deviceHasHover()) return;
    clearTapTimer();
    tapTimer.current = window.setTimeout(resetIndex, TAP_FLASH_MS);
  }, [popping, hasGallery, clearTapTimer, resetIndex]);

  const onPointerLeave = useCallback(() => {
    clearHoverTimer();
    if (!popping && !deviceHasHover()) {
      clearTapTimer();
      resetIndex();
    }
  }, [popping, clearHoverTimer, clearTapTimer, resetIndex]);

  const showAlt = imageIndex > 0;

  return {
    displayImage: images[imageIndex] || mainImage,
    mainImage,
    hoverImage,
    thirdImage,
    altSrc: hoverImage,
    thirdSrc: thirdImage,
    imageIndex,
    showAlt,
    images,
    hasHoverImage: hasGallery,
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  };
}
