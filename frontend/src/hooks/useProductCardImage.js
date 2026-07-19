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
 * Shop-card image swap — Pic 1 (main) + dedicated hover_image on hover/thumb.
 * Detail gallery photos are never used here.
 */
export default function useProductCardImage(product, { popping = false } = {}) {
  const { main: mainImage, hover: hoverImage, images } = getProductCardImages(product);
  const hasHoverImage = Boolean(hoverImage && hoverImage !== mainImage);
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
  }, [mainImage, hoverImage, clearHoverTimer, clearTapTimer, resetIndex]);

  useEffect(() => {
    if (popping && hasHoverImage) {
      setImageIndex(1);
      clearTapTimer();
    }
  }, [popping, hasHoverImage, clearTapTimer]);

  const showAltImage = useCallback(() => {
    if (!hasHoverImage) return;
    setImageIndex(1);
  }, [hasHoverImage]);

  const onMouseEnter = useCallback(() => {
    if (!hasHoverImage || !deviceHasHover()) return;
    clearHoverTimer();
    if (prefersReducedMotion()) {
      showAltImage();
      return;
    }
    hoverTimer.current = window.setTimeout(showAltImage, HOVER_DELAY_MS);
  }, [hasHoverImage, clearHoverTimer, showAltImage]);

  const onMouseLeave = useCallback(() => {
    if (!deviceHasHover()) return;
    clearHoverTimer();
    if (!popping) resetIndex();
  }, [popping, clearHoverTimer, resetIndex]);

  /** Mobile tap flash — brief hover image, not sticky */
  const onTouchStart = useCallback(() => {
    if (!hasHoverImage || deviceHasHover()) return;
    clearTapTimer();
    showAltImage();
  }, [hasHoverImage, clearTapTimer, showAltImage]);

  const onTouchEnd = useCallback(() => {
    if (!hasHoverImage || deviceHasHover() || popping) return;
    clearTapTimer();
    tapTimer.current = window.setTimeout(resetIndex, TAP_FLASH_MS);
  }, [hasHoverImage, popping, clearTapTimer, resetIndex]);

  const onPointerDown = useCallback(() => {
    /* noop — image swap handled by hover / touch; keep for API compat */
  }, []);

  const onPointerUp = useCallback(() => {
    if (popping || !hasHoverImage || deviceHasHover()) return;
    clearTapTimer();
    tapTimer.current = window.setTimeout(resetIndex, TAP_FLASH_MS);
  }, [popping, hasHoverImage, clearTapTimer, resetIndex]);

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
    thirdImage: null,
    altSrc: hoverImage,
    thirdSrc: null,
    imageIndex,
    showAlt,
    images,
    hasHoverImage,
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  };
}
