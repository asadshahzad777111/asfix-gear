import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, formatPrice } from '../api/client';
import { orderProductOnWhatsApp } from '../config/shop';
import { useCart } from '../context/CartContext';
import { useTranslation } from '../context/LanguageContext';
import { useShopGate } from '../hooks/useShopGate';
import ShopLoginPrompt from '../components/ShopLoginPrompt';
import CustomerLoginModal from '../components/CustomerLoginModal';
import { getProductAnimKind } from '../utils/productAnimation';
import CasePreviewer from '../components/premium/CasePreviewer';
import PremiumButton, { PremiumLink, PremiumAnchor } from '../components/premium/PremiumButton';
import { DiscountRibbon, ProductPrice } from '../components/DiscountPicker';
import { getSavings, hasDiscount } from '../utils/pricing';
import { getStockStatus } from '../utils/stock';

export default function ProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
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
    api.getProduct(id).then(setProduct).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [id]);

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
              <img src={product.image} alt={product.name} />
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
            <p className="product-detail-desc">{product.description}</p>
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
              <PremiumAnchor href={orderProductOnWhatsApp(product)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                {t('product.orderWhatsApp')}
              </PremiumAnchor>
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
