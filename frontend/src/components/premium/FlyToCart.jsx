import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';

function getCartTarget() {
  return (
    document.querySelector('[data-cart-target="header"]')
    || document.querySelector('[data-cart-target]')
  );
}

function pulseCartTarget() {
  getCartTarget()?.classList.add('cart-landed');
  window.setTimeout(() => {
    getCartTarget()?.classList.remove('cart-landed');
  }, 520);
}

export default function FlyToCart() {
  const { fly, completeFly } = useCart();
  const [to, setTo] = useState(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!fly) {
      setTo(null);
      return undefined;
    }
    const cartEl = getCartTarget();
    if (!cartEl || !fly.fromRect) {
      completeFly(fly.product);
      return undefined;
    }
    if (reduceMotion) {
      pulseCartTarget();
      completeFly(fly.product);
      return undefined;
    }
    const rect = cartEl.getBoundingClientRect();
    setTo({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    return undefined;
  }, [fly, completeFly, reduceMotion]);

  if (!fly || !to || reduceMotion) return null;

  const { fromRect, product, id } = fly;
  const fromX = fromRect.left + fromRect.width / 2;
  const fromY = fromRect.top + fromRect.height / 2;
  const lift = Math.max(72, Math.abs(fromY - to.y) * 0.35);
  const midX = fromX + (to.x - fromX) * 0.35;
  const midY = Math.min(fromY, to.y) - lift;

  return (
    <AnimatePresence>
      <motion.div
        key={id}
        className="fly-to-cart fly-to-cart--header"
        initial={{ x: fromX, y: fromY, scale: 1, opacity: 1 }}
        animate={{
          x: [fromX, midX, to.x],
          y: [fromY, midY, to.y],
          scale: [1, 0.72, 0.18],
          opacity: [1, 0.95, 0.85],
        }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{
          duration: 0.68,
          times: [0, 0.42, 1],
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={() => {
          pulseCartTarget();
          completeFly(product);
        }}
      >
        <span className="fly-to-cart-trail" aria-hidden="true" />
        <img src={product.image} alt="" />
      </motion.div>
    </AnimatePresence>
  );
}
