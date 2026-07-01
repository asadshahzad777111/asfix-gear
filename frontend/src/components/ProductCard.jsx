import { motion } from 'framer-motion';
import PremiumButton from '../components/premium/PremiumButton';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderProductOnWhatsApp } from '../config/shop';
import { getDefaultImage } from '../config/products';
import { useCart } from '../context/CartContext';
import { getProductAnimKind } from '../utils/productAnimation';
import { DiscountRibbon, ProductPrice } from './DiscountPicker';
import { hasDiscount } from '../utils/pricing';
import { useTranslation } from '../context/LanguageContext';
import { useShopGate } from '../hooks/useShopGate';
import useScrollReveal from '../hooks/useScrollReveal';
import ShopLoginPrompt from './ShopLoginPrompt';
import CustomerLoginModal from './CustomerLoginModal';

export default function ProductCard({ product, inGrid = false, revealIndex = 0 }) {
  const { t } = useTranslation();
  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();
  const waLink = orderProductOnWhatsApp(product);
  const onSale = hasDiscount(product);
  const { addItem } = useCart();
  const addRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);
  const revealRef = useScrollReveal({
    threshold: 0.12,
    delay: revealIndex * 90,
    disabled: !inGrid || revealIndex < 0,
  });

  const animKind = getProductAnimKind(product.category);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    requireCustomer(() => {
      const rect = addRef.current?.getBoundingClientRect();
      if (rect) addItem(product, rect);
      setSelected(true);
      setTimeout(() => setSelected(false), 600);
    });
  };

  const handleImgError = (e) => {
    e.target.onerror = null;
    e.target.src = getDefaultImage(product.category);
  };

  const cardClass = [
    'product-card-wrap',
    'premium-product',
    animKind,
    onSale ? 'on-sale' : '',
    hovered ? 'is-hovered' : '',
    selected ? 'is-selected' : '',
    inGrid ? 'product-card-wrap--grid' : '',
  ].filter(Boolean).join(' ');

  const inner = (
    <>
      <Link to={`/shop/${product.id}`} className="product-card glass-card">
        <div className="product-image premium-product-image">
          {onSale && <DiscountRibbon percent={product.discount_percent} compact={inGrid} />}
          {!inGrid && (
            <div className="premium-fx-layer" aria-hidden="true">
              {animKind === 'gaming' && (
                <>
                  <span className="premium-rgb-wave" />
                  <span className="premium-particle premium-particle--1" />
                  <span className="premium-particle premium-particle--2" />
                  <span className="premium-particle premium-particle--3" />
                </>
              )}
              {animKind === 'charger' && <span className="premium-charge-ring" />}
              {animKind === 'pouch' && <span className="premium-pouch-flap" />}
            </div>
          )}
          {animKind === 'case' && !inGrid ? (
            <div className={`premium-case-flip ${hovered || selected ? 'is-flipped' : ''}`}>
              <div className="premium-case-face premium-case-face--front">
                <img src={product.image} alt={product.name} loading="lazy" onError={handleImgError} />
              </div>
              <div className="premium-case-face premium-case-face--back">
                <span className="premium-case-back-plate" />
                <small>{t('product.premiumFinish')}</small>
              </div>
            </div>
          ) : (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              onError={handleImgError}
              className="product-grid-img"
            />
          )}
          {!inGrid && animKind === 'charger' && hovered && (
            <span className="premium-charge-bolt">⚡</span>
          )}
          <span className="product-category-pill">{product.category}</span>
        </div>
        <div className="product-body">
          <h3 className="product-name">{product.name}</h3>
          <div className="product-footer">
            <div className="product-price-slot">
              <ProductPrice product={product} size="sm" />
            </div>
            <span className={`stock-dot ${product.stock > 0 ? 'in' : 'out'}`}>
              {product.stock > 0 ? t('product.inStockShort') : t('product.soldOut')}
            </span>
          </div>
        </div>
      </Link>

      <div className="product-card-actions">
        <PremiumButton
          ref={addRef}
          className="btn btn-primary btn-sm premium-add-cart"
          disabled={product.stock <= 0}
          onClick={handleAdd}
        >
          {t('product.addCartShort')}
        </PremiumButton>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="product-wa-btn"
          onClick={(e) => e.stopPropagation()}
        >
          {t('product.orderShort')}
        </a>
      </div>
    </>
  );

  if (inGrid) {
    return (
      <>
        <article
          ref={revealRef}
          className={`${cardClass} scroll-reveal`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {inner}
        </article>
        <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
        <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  return (
    <>
      <motion.article
        className={cardClass}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-magnetic
      >
        {inner}
      </motion.article>
      <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
