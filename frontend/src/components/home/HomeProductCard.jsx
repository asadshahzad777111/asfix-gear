import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDefaultImage } from '../../config/products';
import { useCart } from '../../context/CartContext';
import { useShopGate } from '../../hooks/useShopGate';
import useProductPop from '../../hooks/useProductPop';
import useProductCardImage from '../../hooks/useProductCardImage';
import useWishlist from '../../hooks/useWishlist';
import ProductCardImageStack from '../ProductCardImageStack';
import ProductCardHoverActions from '../ProductCardHoverActions';
import ProductQuickView from '../ProductQuickView';
import { useTranslation } from '../../context/LanguageContext';
import { DiscountRibbon, ProductPrice } from '../DiscountPicker';
import { hasDiscount } from '../../utils/pricing';
import { getStockStatus, isInStock, normalizeStock } from '../../utils/stock';
import ShopLoginPrompt from '../ShopLoginPrompt';
import CustomerLoginModal from '../CustomerLoginModal';
import { productPath as buildProductPath } from '../../utils/slug';

export default function HomeProductCard({ product }) {
  const { t } = useTranslation();
  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();
  const { popClass, popping, handleProductLinkClick, linkPopHandlers } = useProductPop();
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const { isWishlisted, toggle: toggleWishlist } = useWishlist(product?.id);
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
  const { addItem } = useCart();
  const addRef = useRef(null);
  const onSale = hasDiscount(product);
  const stockCount = normalizeStock(product.stock);
  const stockStatus = getStockStatus(product.stock);
  const inStock = isInStock(product.stock);
  const stockLabel =
    stockStatus === 'out'
      ? t('product.soldOut')
      : stockStatus === 'low'
        ? t('product.onlyLeft', { count: stockCount })
        : t('product.inStockShort');

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    requireCustomer(() => {
      const rect = addRef.current?.getBoundingClientRect();
      if (rect) addItem(product, rect);
    });
  };

  const handleImgError = (e) => {
    e.target.onerror = null;
    e.target.src = getDefaultImage(product.category);
  };

  const cardImageHandlers = {
    ...linkPopHandlers,
    onTouchStart: () => onCardImageTouchStart(),
    onTouchEnd: () => onCardImageTouchEnd(),
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

  return (
    <>
      <article
        className={`home-product-card ${onSale ? 'on-sale' : ''} ${popClass}`}
        onMouseEnter={onCardImageEnter}
        onMouseLeave={onCardImageLeave}
      >
        <Link
          to={productPath}
          className="home-product-link"
          {...cardImageHandlers}
          onClick={(e) => handleProductLinkClick(e, productPath)}
        >
          <div className="home-product-img-wrap">
            {onSale && <DiscountRibbon percent={product.discount_percent} compact />}
            <ProductCardImageStack
              mainSrc={mainImage}
              altSrc={hoverImage}
              thirdSrc={thirdSrc}
              images={images}
              imageIndex={imageIndex}
              alt={product.name}
              showAlt={showAlt}
              onError={handleImgError}
            />
          </div>
          <div className="home-product-body">
            <h3 className="home-product-name">{product.name}</h3>
            <div className="home-product-footer">
              <ProductPrice product={product} size="sm" />
              <span className={`stock-dot ${stockStatus}`}>{stockLabel}</span>
            </div>
          </div>
        </Link>
        <ProductCardHoverActions
          wishlisted={isWishlisted}
          onToggleWishlist={toggleWishlist}
          onQuickView={() => setQuickViewOpen(true)}
        />
        <div className="home-product-actions">
          <button
            ref={addRef}
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!inStock}
            onClick={handleAdd}
          >
            {t('product.addCartShort')}
          </button>
        </div>
      </article>
      <ProductQuickView product={product} open={quickViewOpen} onClose={() => setQuickViewOpen(false)} />
      <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
