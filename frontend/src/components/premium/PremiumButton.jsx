import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { motionProps, premiumClass, PremiumShimmer } from './motionUtils';

const variants = {
  tap: { scale: 0.94, y: 2 },
  hover: { scale: 1.03, y: -2 },
};

const PremiumButton = forwardRef(function PremiumButton(
  { as: Component = motion.button, className = '', neon = false, liquid = true, children, ...props },
  ref
) {
  return (
    <Component
      ref={ref}
      className={`${premiumClass(neon, liquid)} ${className}`.trim()}
      data-magnetic
      whileHover={variants.hover}
      whileTap={variants.tap}
      transition={motionProps.transition}
      {...props}
    >
      {liquid && <PremiumShimmer />}
      {neon && <span className="premium-btn-neon-ring" aria-hidden="true" />}
      <span className="premium-btn-content">{children}</span>
    </Component>
  );
});

const MotionLink = motion.create(Link);

export function PremiumLink({ className = '', neon = false, liquid = true, children, ...props }) {
  return (
    <MotionLink
      className={`${premiumClass(neon, liquid)} ${className}`.trim()}
      data-magnetic
      whileHover={variants.hover}
      whileTap={variants.tap}
      transition={motionProps.transition}
      {...props}
    >
      {liquid && <PremiumShimmer />}
      {neon && <span className="premium-btn-neon-ring" aria-hidden="true" />}
      <span className="premium-btn-content">{children}</span>
    </MotionLink>
  );
}

const MotionA = motion.a;

export function PremiumAnchor({ className = '', neon = false, liquid = true, children, ...props }) {
  return (
    <MotionA
      className={`${premiumClass(neon, liquid)} ${className}`.trim()}
      data-magnetic
      whileHover={variants.hover}
      whileTap={variants.tap}
      transition={motionProps.transition}
      {...props}
    >
      {liquid && <PremiumShimmer />}
      {neon && <span className="premium-btn-neon-ring" aria-hidden="true" />}
      <span className="premium-btn-content">{children}</span>
    </MotionA>
  );
}

export default PremiumButton;
