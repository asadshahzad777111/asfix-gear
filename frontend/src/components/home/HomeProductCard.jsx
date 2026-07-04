import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { getDefaultImage } from '../../config/products';
import { useCart } from '../../context/CartContext';
import { useShopGate } from '../../hooks/useShopGate';
import useProductPop from '../../hooks/useProductPop';
import useProductCardImage from '../../hooks/useProductCardImage';
import { useTranslation } from '../../context/LanguageContext';
import { DiscountRibbon, ProductPrice } from '../DiscountPicker';
import { hasDiscount } from '../../utils/pricing';
import { getStockStatus } from '../../utils/stock';
import ShopLoginPrompt from '../ShopLoginPrompt';
import CustomerLoginModal from '../CustomerLoginModal';

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
  const {
    displayImage,
    hasHoverImage,
    onMouseEnter: onCardImageEnter,
    onMouseLeave: onCardImageLeave,
    onPointerDown: onCardImagePointerDown,
    onPointerUp: onCardImagePointerUp,
    onPointerLeave: onCardImagePointerLeave,
  } = useProductCardImage(product, { popping });
  const productPath = `/shop/${product.id}`;
  const { addItem } = useCart();
  const addRef = useRef(null);
  const onSale = hasDiscount(product);
  const stockStatus = getStockStatus(product.stock);
  const stockLabel =
    stockStatus === 'out'
      ? t('product.soldOut')
      : stockStatus === 'low'
        ? t('product.onlyLeft', { count: product.stock })
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
            <img
              src={displayImage}
              alt={product.name}
              loading="lazy"
              onError={handleImgError}
              className={hasHoverImage ? 'product-card-img-swap' : undefined}
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
        <div className="home-product-actions">
          <button
            ref={addRef}
            type="button"
            className="btn btn-primary btn-sm"
            disabled={product.stock <= 0}
            onClick={handleAdd}
          >
            {t('product.addCartShort')}
          </button>
        </div>
      </article>
      <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
