import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderProductOnWhatsApp } from '../../config/shop';
import { useCart } from '../../context/CartContext';
import { playProductJump } from '../../utils/gamingSound';
import { DiscountRibbon, ProductPrice } from '../DiscountPicker';
import { hasDiscount } from '../../utils/pricing';
import { useShopGate } from '../../hooks/useShopGate';
import ShopLoginPrompt from '../ShopLoginPrompt';
import CustomerLoginModal from '../CustomerLoginModal';
import { useTranslation } from '../../context/LanguageContext';
import { getStockStatus } from '../../utils/stock';

export default function GamingProductCard({ product, index }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const addRef = useRef(null);
  const waLink = orderProductOnWhatsApp(product);
  const onSale = hasDiscount(product);
  const { addItem } = useCart();
  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.classList.add('jumped');
            playProductJump(index);
          }, index * 120);
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  const stockStatus = getStockStatus(product.stock);
  const cartLabel =
    stockStatus === 'out'
      ? t('product.soldOut')
      : stockStatus === 'low'
        ? t('product.onlyLeft', { count: product.stock })
        : '+ CART';

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    requireCustomer(() => {
      const rect = addRef.current?.getBoundingClientRect();
      if (rect) addItem(product, rect);
    });
  };

  return (
    <>
    <motion.article
      ref={ref}
      className={`gaming-product-card premium-gaming-card ${onSale ? 'on-sale' : ''} ${hovered ? 'is-hovered' : ''}`}
      style={{ '--jump-delay': `${index * 0.12}s` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -6, scale: 1.02 }}
      data-magnetic
    >
      <Link to={`/shop/${product.id}`} className="gaming-product-inner">
        <div className="gaming-product-img">
          {onSale && <DiscountRibbon percent={product.discount_percent} />}
          <div className="gaming-product-scan" />
          <span className="premium-rgb-wave premium-rgb-wave--gaming" />
          <span className="premium-particle premium-particle--1" />
          <span className="premium-particle premium-particle--2" />
          <span className="premium-particle premium-particle--3" />
          <img src={product.image} alt={product.name} loading="lazy" />
          <span className="gaming-product-index">#{String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="gaming-product-body">
          <span className="gaming-product-tag">{product.category}</span>
          <h3>{product.name}</h3>
          <ProductPrice product={product} size="sm" />
        </div>
      </Link>
      <button
        ref={addRef}
        type="button"
        className="gaming-product-order gaming-product-add"
        onClick={handleAdd}
        disabled={product.stock <= 0}
      >
        {cartLabel}
      </button>
      <a href={waLink} target="_blank" rel="noopener noreferrer" className="gaming-product-order gaming-product-wa">
        ⚡ ORDER
      </a>
    </motion.article>
    <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
    <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
