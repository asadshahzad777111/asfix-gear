import { useEffect } from 'react';
import { playButtonTap, playActionTap } from '../utils/gamingSound';

function spawnRipple(e) {
  const btn = e.currentTarget;
  if (!btn || btn.disabled) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  const size = Math.max(rect.width, rect.height) * 1.2;
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

export default function ButtonEffects() {
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse) return undefined;

    const handler = (e) => {
      const target = e.target.closest(
        '.btn, .filter-btn, .fab-add, .nav-add-product, .category-chip, .discount-preset, .btn-gaming-primary, .btn-gaming-outline, .product-wa-btn, .gaming-product-order, .whatsapp-float, .nav-links a'
      );
      if (!target || target.classList.contains('gaming-mode-btn') || target.classList.contains('shop-mode-btn') || target.classList.contains('exit-gaming-btn')) return;

      spawnRipple({ currentTarget: target, clientX: e.clientX, clientY: e.clientY });

      if (
        target.classList.contains('btn-whatsapp') ||
        target.classList.contains('whatsapp-float') ||
        target.classList.contains('product-wa-btn')
      ) {
        playActionTap();
      } else if (target.classList.contains('btn-primary') || target.classList.contains('btn-gaming-primary')) {
        playActionTap();
      } else {
        playButtonTap();
      }
    };

    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return null;
}
