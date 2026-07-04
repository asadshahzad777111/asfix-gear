import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, formatPrice } from '../api/client';
import { orderProductContactPath, restockInquiryContactPath } from '../config/shop';
import { useCart } from '../context/CartContext';
import { useTranslation } from '../context/LanguageContext';
import { useShopGate } from '../hooks/useShopGate';
import { isPublishedProduct } from '../utils/productStatus';
import ShopLoginPrompt from '../components/ShopLoginPrompt';
import CustomerLoginModal from '../components/CustomerLoginModal';
import { getProductAnimKind } from '../utils/productAnimation';
import CasePreviewer from '../components/premium/CasePreviewer';
import PremiumButton, { PremiumLink } from '../components/premium/PremiumButton';
import { DiscountRibbon, ProductPrice } from '../components/DiscountPicker';
import { getSavings, hasDiscount } from '../utils/pricing';
import { getStockStatus } from '../utils/stock';

export default function ProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addItem } = useCart();
  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();

  useEffect(() => {
    api.getProduct(id)
      .then((data) => {
        if (!isPublishedProduct(data)) {
          setError(t('product.notFound'));
          setProduct(null);
          return;
        }
        setProduct(data);
        setActiveImage(data.image);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const extra = Array.isArray(product.gallery) ? product.gallery : [];
    return [product.image, ...extra.filter((url) => url && url !== product.image)];
  }, [product]);

  if (loading) return <div className="loading container">{t('product.loading')}</div>;

  if (error || !product) {
    return (
      <div className="container section">
        <div className="alert alert-error">{error || t('product.notFound')}</div>
        <Link to="/shop" className="btn btn-outline">{t('product.backToShop')}</Link>
      </div>
    );
  }

  const onSale = hasDiscount(product);
  const animKind = getProductAnimKind(product.category);
  const showCasePreview = animKind === 'case';
  const stockStatus = getStockStatus(product.stock);
  const stockMessage =
    stockStatus === 'out'
      ? t('product.outOfStock')
      : stockStatus === 'low'
        ? t('product.onlyLeft', { count: product.stock })
        : t('product.inStock', { count: product.stock });

  const handleAdd = (e) => {
    const btn = e.currentTarget;
    requireCustomer(() => {
      const rect = btn.getBoundingClientRect();
      addItem(product, rect);
    });
  };

  return (
    <>
    <motion.section
      className="product-detail"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="container">
        <PremiumLink to="/shop" className="btn btn-outline" style={{ marginBottom: '1.5rem' }}>
          {t('product.backToShop')}
        </PremiumLink>

        <div className={`product-detail-grid ${onSale ? 'on-sale' : ''}`}>
          {showCasePreview ? (
            <CasePreviewer product={product} />
          ) : (
            <div className={`product-detail-image premium-product ${animKind}`}>
              {onSale && <DiscountRibbon percent={product.discount_percent} />}
              {animKind === 'gaming' && <span className="premium-rgb-wave premium-rgb-wave--gaming" />}
              {animKind === 'charger' && <span className="premium-charge-ring premium-charge-ring--lg" />}
              <img src={activeImage || product.image} alt={product.name} />
              {galleryImages.length > 1 ? (
                <div className="product-detail-gallery">
                  {galleryImages.map((url) => (
                    <button
                      key={url}
                      type="button"
                      className={`product-detail-gallery-thumb ${activeImage === url ? 'is-active' : ''}`}
                      onClick={() => setActiveImage(url)}
                    >
                      <img src={url} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="product-detail-info">
            <span className="eyebrow">{product.category}</span>
            {onSale && (
              <span className="detail-sale-banner">
                {t('product.limitedOffer', { percent: product.discount_percent })}
              </span>
            )}
            <h1>{product.name}</h1>
            <ProductPrice product={product} size="xl" />
            {onSale && (
              <p className="savings-line">{t('product.youSave', { amount: formatPrice(getSavings(product)) })}</p>
            )}
            {product.description && /<[a-z][\s\S]*>/i.test(product.description) ? (
              <div
                className="product-detail-desc product-detail-desc-html"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p className="product-detail-desc">{product.description}</p>
            )}
            {product.warranty ? (
              <p className="product-warranty-line">🛡️ {t('product.warranty', { text: product.warranty })}</p>
            ) : null}
            <p style={{ marginBottom: '1.5rem', color: stockStatus === 'out' ? '#fca5a5' : stockStatus === 'low' ? '#fcd34d' : '#86efac' }}>
              {stockMessage}
            </p>
            <div className="product-actions">
              <PremiumButton
                className="btn btn-primary"
                neon={animKind === 'gaming'}
                disabled={product.stock <= 0}
                onClick={handleAdd}
              >
                {t('product.addToCart')}
              </PremiumButton>
              {product.stock > 0 ? (
                <PremiumLink to={orderProductContactPath(product)} className="btn btn-whatsapp">
                  {t('product.orderWhatsApp')}
                </PremiumLink>
              ) : (
                <PremiumLink to={restockInquiryContactPath(product)} className="btn btn-whatsapp">
                  {t('product.requestItem')}
                </PremiumLink>
              )}
              <PremiumLink to="/contact" className="btn btn-outline">{t('product.contact')}</PremiumLink>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
    <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
    <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
