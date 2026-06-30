import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const motionProps = {
  whileHover: { scale: 1.03, y: -2 },
  whileTap: { scale: 0.94, y: 2 },
  transition: { type: 'spring', stiffness: 420, damping: 22 },
};

export const MotionLink = motion.create(Link);
export const MotionButton = motion.button;
export const MotionA = motion.a;

export function premiumClass(neon = false, liquid = true) {
  return [
    'premium-btn',
    liquid ? 'premium-btn--liquid' : '',
    neon ? 'premium-btn--neon' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function PremiumShimmer() {
  return <span className="premium-btn-shimmer" aria-hidden="true" />;
}

export { motionProps };
