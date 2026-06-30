import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useGaming } from '../../context/GamingContext';
import { useTranslation } from '../../context/LanguageContext';
import { playGamingHover, playGamingTap } from '../../utils/gamingSound';
import { motionProps, premiumClass, PremiumShimmer } from '../premium/motionUtils';
import GamingLogo from './GamingLogo';

function spawnRipple(e, btn) {
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

export default function GamingModeButton({ variant = 'trigger', onAfterClick }) {
  const { enterGamingMode, transitioning, isGamingPage } = useGaming();
  const { t } = useTranslation();
  const btnRef = useRef(null);
  const coarse =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const handleClick = (e) => {
    if (btnRef.current && !coarse) spawnRipple(e, btnRef.current);
    playGamingTap();
    enterGamingMode();
    onAfterClick?.();
  };

  const motionPropsForVariant = coarse || variant === 'nav'
    ? {}
    : {
        whileHover: { scale: 1.05, x: variant === 'trigger' ? 4 : 0 },
        whileTap: { scale: 0.92, y: 3 },
        transition: motionProps.transition,
      };

  return (
    <motion.button
      ref={btnRef}
      type="button"
      className={`gaming-mode-btn gaming-mode-btn--${variant} btn-interactive ${premiumClass(true, true)} ${transitioning ? 'activating' : ''} ${isGamingPage ? 'active' : ''}${variant === 'nav' ? ' nav-drawer-item' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => playGamingHover()}
      {...motionPropsForVariant}
      data-magnetic
      aria-label={`${t('nav.gaming')} Mode`}
      title={t('nav.gaming')}
    >
      <PremiumShimmer />
      {variant === 'nav' && <span className="nav-drawer-item-glow" aria-hidden="true" />}
      <span className="premium-btn-neon-ring" aria-hidden="true" />
      <span className="gaming-btn-shine" />
      <span className="gaming-btn-ring gaming-btn-ring--1" />
      <span className="gaming-btn-ring gaming-btn-ring--2" />
      <span className="gaming-btn-ring gaming-btn-ring--3" />
      <span className="gaming-btn-core">
        <GamingLogo size={variant === 'nav' ? 34 : 44} animated />
      </span>
      {variant === 'trigger' && (
        <span className="gaming-btn-label">
          <strong>GAME</strong>
          <small>MODE</small>
        </span>
      )}
      {variant === 'nav' && (
        <>
          <span className="gaming-btn-nav-text">{t('nav.gaming')}</span>
          <span className="nav-drawer-item-arrow" aria-hidden="true">›</span>
        </>
      )}
    </motion.button>
  );
}
