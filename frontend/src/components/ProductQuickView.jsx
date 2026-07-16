import { useRef } from 'react';
import { Link } from 'react-router-dom';
import useModalBehavior from '../hooks/useModalBehavior';
import { useCart } from '../context/CartContext';
import { useTranslation } from '../context/LanguageContext';
import { useShopGate } from '../hooks/useShopGate';
import { ProductPrice } from './DiscountPicker';
import { getProductCardImages } from '../utils/productImages';
import { isInStock } from '../utils/stock';
import { productPath as buildProductPath } from '../utils/slug';
import ShopLoginPrompt from './ShopLoginPrompt';
import CustomerLoginModal from './CustomerLoginModal';

export default function ProductQuickView({ product, open, onClose }) {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const addRef = useRef(null);
  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();

  useModalBehavior(open, onClose);

  if (!open || !product) return null;

  const inStock = isInStock(product.stock);
  const { main, images } = getProductCardImages(product);
  const displayImage = images[0] || main;
  const productPath = buildProductPath(product);

  const handleAdd = (e) => {
    e.preventDefault();
    requireCustomer(() => {
      const rect = addRef.current?.getBoundingClientRect();
      if (rect) addItem(product, rect);
    });
  };

  return (
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
            <div className="shop-quickview-image">
              <img src={displayImage} alt={product.name} />
            </div>
            <div className="shop-quickview-info">
              <span className="shop-quickview-category">{product.category}</span>
              <h2>{product.name}</h2>
              <ProductPrice product={product} size="lg" />
              <p className={`shop-quickview-stock ${inStock ? 'in' : 'out'}`}>
                {inStock ? t('product.inStockShort') : t('product.soldOut')}
              </p>
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
    </>
  );
}
