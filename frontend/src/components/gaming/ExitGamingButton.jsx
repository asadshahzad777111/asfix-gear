import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useGaming } from '../../context/GamingContext';
import { playButtonTap } from '../../utils/gamingSound';
import { motionProps, premiumClass, PremiumShimmer } from '../premium/motionUtils';
import GamingLogo from './GamingLogo';

function spawnRipple(e, btn) {
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple btn-ripple--exit';
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

export default function ExitGamingButton() {
  const { exitGamingMode, transitioning, isGamingPage } = useGaming();
  const btnRef = useRef(null);

  if (!isGamingPage) return null;

  const handleClick = (e) => {
    if (btnRef.current) spawnRipple(e, btnRef.current);
    playButtonTap();
    exitGamingMode();
  };

  return (
    <motion.button
      ref={btnRef}
      type="button"
      className={`exit-gaming-btn btn-interactive ${premiumClass(false, true)} ${transitioning ? 'activating' : ''}`}
      onClick={handleClick}
      whileHover={{ scale: 1.04, x: -4 }}
      whileTap={{ scale: 0.9, y: 3 }}
      transition={motionProps.transition}
      data-magnetic
      aria-label="Exit Gaming Mode"
      title="Exit Gaming Mode"
    >
      <PremiumShimmer />
      <span className="exit-btn-shine" />
      <span className="exit-btn-ring exit-btn-ring--1" />
      <span className="exit-btn-ring exit-btn-ring--2" />
      <span className="exit-btn-core">
        <span className="exit-btn-x">✕</span>
        <GamingLogo size={36} animated={false} className="exit-btn-logo" />
      </span>
      <span className="exit-btn-label">
        <strong>EXIT</strong>
        <small>MODE</small>
      </span>
    </motion.button>
  );
}
