import { motion } from 'framer-motion';
import PremiumButton from '../components/premium/PremiumButton';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderProductContactPath, restockInquiryContactPath } from '../config/shop';
import { getDefaultImage } from '../config/products';
import { useCart } from '../context/CartContext';
import { getProductAnimKind } from '../utils/productAnimation';
import { DiscountRibbon, ProductPrice } from './DiscountPicker';
import { hasDiscount } from '../utils/pricing';
import { useTranslation } from '../context/LanguageContext';
import { useShopGate } from '../hooks/useShopGate';
import useScrollReveal from '../hooks/useScrollReveal';
import useProductPop from '../hooks/useProductPop';
import useProductCardImage from '../hooks/useProductCardImage';
import ProductCardImageStack from './ProductCardImageStack';
import { isInStock } from '../utils/stock';
import ShopLoginPrompt from './ShopLoginPrompt';
import CustomerLoginModal from './CustomerLoginModal';
import { productPath as buildProductPath } from '../utils/slug';
import ProductCardHoverActions from './ProductCardHoverActions';
import ProductQuickView from './ProductQuickView';
import useWishlist from '../hooks/useWishlist';

const TAP_POP = { scale: 1.06, y: -10, rotateX: -4, z: 40 };
const TAP_SPRING = { type: 'spring', stiffness: 420, damping: 26 };

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
  const inStock = isInStock(product.stock);
  const contactTo = inStock ? orderProductContactPath(product) : restockInquiryContactPath(product);
  const onSale = hasDiscount(product);
  const { addItem } = useCart();
  const addRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const { isWishlisted, toggle: toggleWishlist } = useWishlist(product?.id);
  const { ref: revealRef, revealClass } = useScrollReveal({
    threshold: 0.12,
    delay: revealIndex * 90,
    disabled: !inGrid || revealIndex < 0,
  });
  const { popClass, popping, handleProductLinkClick, linkPopHandlers } = useProductPop();
  const canHover = typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const {
    mainImage,
    hoverImage,
    thirdSrc,
    imageIndex,
    showAlt,
    images,
    onMouseEnter: onCardImageEnter,
    onMouseLeave: onCardImageLeave,
    onTouchStart: onCardImageTouchStart,
    onTouchEnd: onCardImageTouchEnd,
    onPointerDown: onCardImagePointerDown,
    onPointerUp: onCardImagePointerUp,
    onPointerLeave: onCardImagePointerLeave,
  } = useProductCardImage(product, { popping });
  const productPath = buildProductPath(product);

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

  const cardImageHandlers = {
    ...linkPopHandlers,
    onTouchStart: (e) => {
      onCardImageTouchStart();
    },
    onTouchEnd: () => {
      onCardImageTouchEnd();
    },
    onPointerDown: (e) => {
      linkPopHandlers.onPointerDown(e);
      onCardImagePointerDown();
    },
    onPointerUp: (e) => {
      linkPopHandlers.onPointerUp(e);
      onCardImagePointerUp();
    },
    onPointerLeave: (e) => {
      linkPopHandlers.onPointerLeave(e);
      onCardImagePointerLeave();
    },
  };

  const renderCardImage = (className = '') => (
    <ProductCardImageStack
      mainSrc={mainImage}
      altSrc={hoverImage}
      thirdSrc={thirdSrc}
      images={images}
      imageIndex={imageIndex}
      alt={product.name}
      showAlt={showAlt}
      className={className}
      onError={handleImgError}
    />
  );

  const cardClass = [
    'product-card-wrap',
    'premium-product',
    animKind,
    onSale ? 'on-sale' : '',
    hovered ? 'is-hovered' : '',
    selected ? 'is-selected' : '',
    inGrid ? 'product-card-wrap--grid' : '',
    popClass,
  ].filter(Boolean).join(' ');

  const inner = inGrid ? (
    <>
      <div className="product-card glass-card">
        <Link
          to={productPath}
          className="product-card-link"
          {...cardImageHandlers}
          onClick={(e) => handleProductLinkClick(e, productPath)}
        >
          <div className="product-image premium-product-image">
            {onSale && <DiscountRibbon percent={product.discount_percent} compact={inGrid} />}
            {renderCardImage('product-grid-img')}
            <span className="product-category-pill">{product.category}</span>
          </div>
          <div className="product-body">
            <h3 className="product-name">{product.name}</h3>
            {product.compatible_models && (
              <p className="product-compat-models">📱 {product.compatible_models}</p>
            )}
            <div className="product-footer">
              <div className="product-price-slot">
                <ProductPrice product={product} size="sm" />
              </div>
              <span className={`stock-dot ${inStock ? 'in' : 'out'}`}>
                {inStock ? t('product.inStockShort') : t('product.soldOut')}
              </span>
            </div>
          </div>
        </Link>
        <ProductCardHoverActions
          wishlisted={isWishlisted}
          onToggleWishlist={toggleWishlist}
          onQuickView={() => setQuickViewOpen(true)}
        />
      </div>

      <div className="product-card-actions">
        <PremiumButton
          ref={addRef}
          className="btn btn-primary btn-sm premium-add-cart"
          disabled={!inStock}
          onClick={handleAdd}
        >
          {t('product.addCartShort')}
        </PremiumButton>
        <Link
          to={contactTo}
          className={`product-wa-btn ${!inStock ? 'product-wa-btn--restock' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {inStock ? t('product.orderShort') : t('product.requestItem')}
        </Link>
      </div>
    </>
  ) : (
    <>
      <Link
        to={productPath}
        className="product-card glass-card"
        {...cardImageHandlers}
        onClick={(e) => handleProductLinkClick(e, productPath)}
      >
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
                {renderCardImage()}
              </div>
              <div className="premium-case-face premium-case-face--back">
                <span className="premium-case-back-plate" />
                <small>{t('product.premiumFinish')}</small>
              </div>
            </div>
          ) : (
            renderCardImage('product-grid-img')
          )}
          {!inGrid && animKind === 'charger' && hovered && (
            <span className="premium-charge-bolt">⚡</span>
          )}
          <span className="product-category-pill">{product.category}</span>
        </div>
        <div className="product-body">
          <h3 className="product-name">{product.name}</h3>
          {product.compatible_models && (
            <p className="product-compat-models">📱 {product.compatible_models}</p>
          )}
          <div className="product-footer">
            <div className="product-price-slot">
              <ProductPrice product={product} size="sm" />
            </div>
            <span className={`stock-dot ${inStock ? 'in' : 'out'}`}>
              {inStock ? t('product.inStockShort') : t('product.soldOut')}
            </span>
          </div>
        </div>
      </Link>

      <div className="product-card-actions">
        <PremiumButton
          ref={addRef}
          className="btn btn-primary btn-sm premium-add-cart"
          disabled={!inStock}
          onClick={handleAdd}
        >
          {t('product.addCartShort')}
        </PremiumButton>
        <Link
          to={contactTo}
          className={`product-wa-btn ${!inStock ? 'product-wa-btn--restock' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {inStock ? t('product.orderShort') : t('product.requestItem')}
        </Link>
      </div>
    </>
  );

  if (inGrid) {
    return (
      <>
        <article
          ref={revealRef}
          className={`${cardClass} scroll-reveal ${revealClass}`.trim()}
          onMouseEnter={() => {
            if (canHover) setHovered(true);
            onCardImageEnter();
          }}
          onMouseLeave={() => {
            if (canHover) setHovered(false);
            onCardImageLeave();
          }}
        >
          {inner}
        </article>
        <ProductQuickView product={product} open={quickViewOpen} onClose={() => setQuickViewOpen(false)} />
        <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
        <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  return (
    <>
      <motion.article
        className={cardClass}
        onMouseEnter={() => {
          if (canHover) setHovered(true);
          onCardImageEnter();
        }}
        onMouseLeave={() => {
          if (canHover) setHovered(false);
          onCardImageLeave();
        }}
        whileTap={TAP_POP}
        transition={TAP_SPRING}
        style={{ transformPerspective: 900 }}
        data-magnetic
      >
        {inner}
      </motion.article>
      <ProductQuickView product={product} open={quickViewOpen} onClose={() => setQuickViewOpen(false)} />
      <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
