import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductCardImages } from '../utils/productImages';

const HOVER_DELAY_MS = 150;
const TAP_FLASH_MS = 220;
const CYCLE_MS = 900;

function deviceHasHover() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Shop-card image cycle — main + up to 2 gallery photos on hover (desktop) or tap (mobile).
 */
export default function useProductCardImage(product, { popping = false } = {}) {
  const { main: mainImage, images } = getProductCardImages(product);
  const hoverImage = images[1] || null;
  const thirdImage = images[2] || null;
  const hasGallery = images.length > 1;
  const [imageIndex, setImageIndex] = useState(0);
  const hoverTimer = useRef(null);
  const tapTimer = useRef(null);
  const cycleTimer = useRef(null);

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

  const clearCycleTimer = useCallback(() => {
    if (cycleTimer.current) {
      clearInterval(cycleTimer.current);
      cycleTimer.current = null;
    }
  }, []);

  const resetIndex = useCallback(() => setImageIndex(0), []);

  useEffect(() => {
    resetIndex();
    clearHoverTimer();
    clearTapTimer();
    clearCycleTimer();
  }, [mainImage, images.join('|'), clearHoverTimer, clearTapTimer, clearCycleTimer, resetIndex]);

  useEffect(() => {
    if (popping && hasGallery) {
      setImageIndex(1);
      clearTapTimer();
    }
  }, [popping, hasGallery, clearTapTimer]);

  const startCycle = useCallback(() => {
    if (!hasGallery || prefersReducedMotion()) return;
    clearCycleTimer();
    cycleTimer.current = window.setInterval(() => {
      setImageIndex((prev) => (prev + 1) % images.length);
    }, CYCLE_MS);
  }, [clearCycleTimer, hasGallery, images.length]);

  const onMouseEnter = useCallback(() => {
    if (!hasGallery || !deviceHasHover()) return;
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => {
      setImageIndex(1);
      if (images.length > 2) startCycle();
    }, HOVER_DELAY_MS);
  }, [hasGallery, images.length, clearHoverTimer, startCycle]);

  const onMouseLeave = useCallback(() => {
    if (!deviceHasHover()) return;
    clearHoverTimer();
    clearCycleTimer();
    if (!popping) resetIndex();
  }, [popping, clearHoverTimer, clearCycleTimer, resetIndex]);

  const onPointerDown = useCallback(() => {
    if (!hasGallery) return;
    clearHoverTimer();
    setImageIndex((prev) => (prev + 1) % images.length);
  }, [hasGallery, images.length, clearHoverTimer]);

  const onPointerUp = useCallback(() => {
    if (popping || !hasGallery || deviceHasHover()) return;
    clearTapTimer();
    tapTimer.current = window.setTimeout(resetIndex, TAP_FLASH_MS);
  }, [popping, hasGallery, clearTapTimer, resetIndex]);

  const onPointerLeave = useCallback(() => {
    clearHoverTimer();
    clearCycleTimer();
    if (!popping) {
      clearTapTimer();
      resetIndex();
    }
  }, [popping, clearHoverTimer, clearCycleTimer, clearTapTimer, resetIndex]);

  const showAlt = imageIndex > 0;
  const displayImage = images[imageIndex] || mainImage;
  const altSrc = images[1] || null;
  const thirdSrc = images[2] || null;

  return {
    displayImage,
    mainImage,
    hoverImage,
    thirdImage,
    altSrc,
    thirdSrc,
    imageIndex,
    showAlt,
    images,
    hasHoverImage: hasGallery,
    onMouseEnter,
    onMouseLeave,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  };
}
