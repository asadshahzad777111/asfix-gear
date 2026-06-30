import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useGaming } from '../../context/GamingContext';
import { useTranslation } from '../../context/LanguageContext';
import { playShopHover, playShopTap } from '../../utils/gamingSound';
import { motionProps, premiumClass, PremiumShimmer } from '../premium/motionUtils';
import ShopLogo from './ShopLogo';

function spawnRipple(e, btn) {
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple btn-ripple--shop';
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

export default function ShopModeButton({ variant = 'trigger', onAfterClick }) {
  const { enterShopMode, transitioning, isShopPage } = useGaming();
  const { t } = useTranslation();
  const btnRef = useRef(null);
  const coarse =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const handleClick = (e) => {
    if (btnRef.current && !coarse) spawnRipple(e, btnRef.current);
    playShopTap();
    enterShopMode();
    onAfterClick?.();
  };

  if (isShopPage && variant === 'trigger') return null;

  const motionPropsForVariant = coarse || variant === 'nav'
    ? {}
    : {
        whileHover: { scale: 1.05, x: variant === 'trigger' ? -4 : 0 },
        whileTap: { scale: 0.92, y: 3 },
        transition: motionProps.transition,
      };

  return (
    <motion.button
      ref={btnRef}
      type="button"
      className={`shop-mode-btn shop-mode-btn--${variant} btn-interactive ${premiumClass(false, true)} ${transitioning ? 'activating' : ''} ${isShopPage ? 'active' : ''}${variant === 'nav' ? ' nav-drawer-item' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => playShopHover()}
      {...motionPropsForVariant}
      data-magnetic
      aria-label="Purchase Accessories — Shop Mode"
      title="Shop Accessories"
    >
      <PremiumShimmer />
      {variant === 'nav' && <span className="nav-drawer-item-glow" aria-hidden="true" />}
      <span className="shop-btn-shine" />
      <span className="shop-btn-ring shop-btn-ring--1" />
      <span className="shop-btn-ring shop-btn-ring--2" />
      <span className="shop-btn-ring shop-btn-ring--3" />
      <span className="shop-btn-core">
        <ShopLogo size={variant === 'nav' ? 34 : 44} animated />
      </span>
      {variant === 'trigger' && (
        <span className="shop-btn-label">
          <strong>SHOP</strong>
          <small>GEAR</small>
        </span>
      )}
      {variant === 'nav' && (
        <>
          <span className="shop-btn-nav-text">{t('nav.shop')}</span>
          <span className="nav-drawer-item-arrow" aria-hidden="true">›</span>
        </>
      )}
    </motion.button>
  );
}
