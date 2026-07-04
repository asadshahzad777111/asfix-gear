import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductHoverImage } from '../utils/productImages';

const HOVER_DELAY_MS = 150;
const TAP_FLASH_MS = 220;

/**
 * Swap shop-card image to gallery[0] on hover (desktop) or tap/pop (mobile).
 */
export default function useProductCardImage(product, { popping = false } = {}) {
  const mainImage = product?.image || '';
  const hoverImage = getProductHoverImage(product);
  const [showAlt, setShowAlt] = useState(false);
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

  useEffect(() => {
    setShowAlt(false);
    clearHoverTimer();
    clearTapTimer();
  }, [mainImage, hoverImage, clearHoverTimer, clearTapTimer]);

  useEffect(() => {
    if (popping && hoverImage) {
      setShowAlt(true);
      clearTapTimer();
    }
  }, [popping, hoverImage, clearTapTimer]);

  const onMouseEnter = useCallback(() => {
    if (!hoverImage) return;
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setShowAlt(true), HOVER_DELAY_MS);
  }, [hoverImage, clearHoverTimer]);

  const onMouseLeave = useCallback(() => {
    clearHoverTimer();
    if (!popping) setShowAlt(false);
  }, [popping, clearHoverTimer]);

  const onPointerDown = useCallback(() => {
    if (!hoverImage) return;
    clearHoverTimer();
    setShowAlt(true);
  }, [hoverImage, clearHoverTimer]);

  const onPointerUp = useCallback(() => {
    if (popping || !hoverImage) return;
    clearTapTimer();
    tapTimer.current = window.setTimeout(() => setShowAlt(false), TAP_FLASH_MS);
  }, [popping, hoverImage, clearTapTimer]);

  const onPointerLeave = useCallback(() => {
    clearHoverTimer();
    if (!popping) {
      clearTapTimer();
      setShowAlt(false);
    }
  }, [popping, clearHoverTimer, clearTapTimer]);

  const displayImage = showAlt && hoverImage ? hoverImage : mainImage;

  return {
    displayImage,
    hasHoverImage: Boolean(hoverImage),
    onMouseEnter,
    onMouseLeave,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  };
}
