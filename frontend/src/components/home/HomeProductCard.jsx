import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDefaultImage } from '../../config/products';
import { useCart } from '../../context/CartContext';
import { useShopGate } from '../../hooks/useShopGate';
import { useTranslation } from '../../context/LanguageContext';
import { DiscountRibbon, ProductPrice } from '../DiscountPicker';
import { hasDiscount } from '../../utils/pricing';
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
  const { addItem } = useCart();
  const addRef = useRef(null);
  const onSale = hasDiscount(product);

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

  return (
    <>
      <article className={`home-product-card ${onSale ? 'on-sale' : ''}`}>
        <Link to={`/shop/${product.id}`} className="home-product-link">
          <div className="home-product-img-wrap">
            {onSale && <DiscountRibbon percent={product.discount_percent} compact />}
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              onError={handleImgError}
            />
          </div>
          <div className="home-product-body">
            <h3 className="home-product-name">{product.name}</h3>
            <div className="home-product-footer">
              <ProductPrice product={product} size="sm" />
              <span className={`stock-dot ${product.stock > 0 ? 'in' : 'out'}`}>
                {product.stock > 0 ? t('product.inStockShort') : t('product.soldOut')}
              </span>
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
