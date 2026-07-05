import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { playProductJump } from '../../utils/gamingSound';
import { DiscountRibbon, ProductPrice } from '../DiscountPicker';
import { hasDiscount } from '../../utils/pricing';
import { useShopGate } from '../../hooks/useShopGate';
import ShopLoginPrompt from '../ShopLoginPrompt';
import CustomerLoginModal from '../CustomerLoginModal';
import { useTranslation } from '../../context/LanguageContext';
import { getStockStatus, isInStock, isOutOfStock, normalizeStock } from '../../utils/stock';
import useProductPop from '../../hooks/useProductPop';

const TAP_POP = { scale: 1.07, y: -12, rotateX: -4, z: 50 };
const TAP_SPRING = { type: 'spring', stiffness: 420, damping: 26 };

export default function GamingProductCard({ product, index }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const addRef = useRef(null);
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
  const { popClass, handleProductLinkClick, linkPopHandlers } = useProductPop();
  const productPath = `/shop/${product.id}`;
  const [hovered, setHovered] = useState(false);
  const [jumped, setJumped] = useState(false);
  const stockCount = normalizeStock(product.stock);
  const stockStatus = getStockStatus(product.stock);
  const inStock = isInStock(product.stock);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setJumped(true);
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

  const cartLabel = isOutOfStock(product.stock)
    ? t('product.soldOut')
    : t('product.addCartShort');

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
      className={`gaming-product-card premium-gaming-card ${jumped ? 'jumped' : ''} ${onSale ? 'on-sale' : ''} ${hovered ? 'is-hovered' : ''} ${popClass}`.trim()}
      style={{ '--jump-delay': `${index * 0.12}s`, transformPerspective: 900 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={TAP_POP}
      transition={TAP_SPRING}
      data-magnetic
    >
      <Link
        to={productPath}
        className="gaming-product-inner"
        {...linkPopHandlers}
        onClick={(e) => handleProductLinkClick(e, productPath)}
      >
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
          {inStock && stockStatus === 'low' && (
            <span className="gaming-product-stock gaming-product-stock--low">
              {t('product.onlyLeft', { count: stockCount })}
            </span>
          )}
          {isOutOfStock(product.stock) && (
            <span className="gaming-product-stock gaming-product-stock--out">
              {t('product.outOfStock')}
            </span>
          )}
        </div>
      </Link>
      <button
        ref={addRef}
        type="button"
        className="gaming-product-order gaming-product-add"
        onClick={handleAdd}
        disabled={!inStock}
        aria-label={t('product.addToCart')}
      >
        {cartLabel}
      </button>
    </motion.article>
    <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
    <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
