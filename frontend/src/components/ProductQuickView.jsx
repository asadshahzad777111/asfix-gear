import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import useModalBehavior from '../hooks/useModalBehavior';
import { useCart } from '../context/CartContext';
import { useTranslation } from '../context/LanguageContext';
import { useShopGate } from '../hooks/useShopGate';
import useWishlist from '../hooks/useWishlist';
import { ProductPrice } from './DiscountPicker';
import { getProductDetailImages } from '../utils/productImages';
import { isInStock, maxCartQty } from '../utils/stock';
import { productPath as buildProductPath } from '../utils/slug';
import ShopLoginPrompt from './ShopLoginPrompt';
import CustomerLoginModal from './CustomerLoginModal';

export default function ProductQuickView({ product, open, onClose }) {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const addRef = useRef(null);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist(product?.id);

  useModalBehavior(open, onClose);

  useEffect(() => {
    if (!open) return;
    setQty(1);
    setImageIndex(0);
  }, [open, product?.id]);

  if (!open || !product || typeof document === 'undefined') return null;

  const inStock = isInStock(product.stock);
  const { main, images } = getProductDetailImages(product);
  const gallery = images.length ? images : (main ? [main] : []);
  const displayImage = gallery[imageIndex] || main;
  const productPath = buildProductPath(product);
  const maxQty = maxCartQty(product);

  const handleAdd = (e) => {
    e.preventDefault();
    requireCustomer(() => {
      const rect = addRef.current?.getBoundingClientRect();
      if (rect) addItem(product, rect, qty);
    });
  };

  return createPortal(
    <>
      <div className="modal-overlay shop-quickview-overlay" onClick={onClose} role="presentation">
        <div
          className="modal-panel shop-quickview-panel"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('product.quickView')}
        >
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('product.closeQuickView')}>
            ✕
          </button>
          <div className="shop-quickview-grid">
            <div className="shop-quickview-media">
              <div className="shop-quickview-image">
                <img src={displayImage} alt={product.name} />
              </div>
              {gallery.length > 1 ? (
                <div className="shop-quickview-thumbs" role="list">
                  {gallery.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      role="listitem"
                      className={`shop-quickview-thumb ${i === imageIndex ? 'is-active' : ''}`}
                      aria-label={`Photo ${i + 1}`}
                      onClick={() => setImageIndex(i)}
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="shop-quickview-info">
              <span className="shop-quickview-category">{product.category}</span>
              <h2>{product.name}</h2>
              <ProductPrice product={product} size="lg" />
              <p className={`shop-quickview-stock ${inStock ? 'in' : 'out'}`}>
                {inStock ? t('product.inStockShort') : t('product.soldOut')}
              </p>
              <div className="shop-quickview-buy-row">
                <div className="product-qty-selector" aria-label={t('product.quantity')}>
                  <button
                    type="button"
                    className="product-qty-btn"
                    disabled={qty <= 1}
                    aria-label={t('product.decreaseQty')}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    -
                  </button>
                  <span className="product-qty-value">{qty}</span>
                  <button
                    type="button"
                    className="product-qty-btn"
                    disabled={!inStock || qty >= maxQty}
                    aria-label={t('product.increaseQty')}
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className={`product-detail-wishlist-btn ${isWishlisted ? 'is-active' : ''}`}
                  aria-label={isWishlisted ? t('product.removeWishlist') : t('product.addWishlist')}
                  aria-pressed={isWishlisted}
                  onClick={toggleWishlist}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
              <div className="shop-quickview-actions">
                <button
                  ref={addRef}
                  type="button"
                  className="btn shop-add-to-cart-btn"
                  disabled={!inStock}
                  onClick={handleAdd}
                >
                  {t('product.addToCart')}
                </button>
                <Link to={productPath} className="btn btn-outline shop-quickview-details" onClick={onClose}>
                  {t('product.viewDetails')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>,
    document.body
  );
}
