import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';

export default function FlyToCart() {
  const { fly, completeFly } = useCart();
  const [to, setTo] = useState(null);

  useEffect(() => {
    if (!fly) {
      setTo(null);
      return undefined;
    }
    const cartEl = document.querySelector('[data-cart-target]');
    if (!cartEl || !fly.fromRect) {
      completeFly(fly.product);
      return undefined;
    }
    const rect = cartEl.getBoundingClientRect();
    setTo({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    return undefined;
  }, [fly, completeFly]);

  if (!fly || !to) return null;

  const { fromRect, product, id } = fly;
  const fromX = fromRect.left + fromRect.width / 2;
  const fromY = fromRect.top + fromRect.height / 2;
  const midX = (fromX + to.x) / 2;
  const midY = Math.min(fromY, to.y) - 90;

  return (
    <AnimatePresence>
      <motion.div
        key={id}
        className="fly-to-cart"
        initial={{ x: fromX, y: fromY, scale: 1, opacity: 1, rotate: 0 }}
        animate={{
          x: [fromX, midX, to.x],
          y: [fromY, midY, to.y],
          scale: [1, 0.55, 0.12],
          rotate: [0, 180, 360],
          opacity: [1, 1, 0.9],
        }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{
          duration: 0.75,
          times: [0, 0.45, 1],
          ease: [0.34, 1.56, 0.64, 1],
        }}
        onAnimationComplete={() => {
          document.querySelector('[data-cart-target]')?.classList.add('cart-landed');
          setTimeout(() => {
            document.querySelector('[data-cart-target]')?.classList.remove('cart-landed');
          }, 500);
          completeFly(product);
        }}
      >
        <img src={product.image} alt="" />
      </motion.div>
    </AnimatePresence>
  );
}
