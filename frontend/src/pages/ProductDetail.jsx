import { useEffect, useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, formatPrice } from '../api/client';
import { orderProductContactPath, restockInquiryContactPath } from '../config/shop';
import { useCart } from '../context/CartContext';
import { useTranslation } from '../context/LanguageContext';
import { useShopGate } from '../hooks/useShopGate';
import { isPublishedProduct } from '../utils/productStatus';
import ShopLoginPrompt from '../components/ShopLoginPrompt';
import CustomerLoginModal from '../components/CustomerLoginModal';
import BackButton from '../components/BackButton';
import ProductDetailGallery from '../components/ProductDetailGallery';
import ProductCard from '../components/ProductCard';
import { getProductAnimKind } from '../utils/productAnimation';
import PremiumButton, { PremiumLink } from '../components/premium/PremiumButton';
import CasePreviewer from '../components/premium/CasePreviewer';
import { DiscountRibbon, ProductPrice } from '../components/DiscountPicker';
import { getSavings, hasDiscount } from '../utils/pricing';
import { getStockStatus, isInStock, normalizeStock } from '../utils/stock';
import { getProductCardImages } from '../utils/productImages';
import DocumentHead from '../components/seo/DocumentHead';
import { ProductJsonLd } from '../components/seo/JsonLd';
import { productPath } from '../utils/slug';

export default function ProductDetail() {
  const { t } = useTranslation();
  const { id, slug } = useParams();
  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
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
    setLoading(true);
    setError('');
    const fetcher = slug
      ? api.getProductBySlug(slug)
      : api.getProduct(id);
    fetcher
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
  }, [id, slug, t]);

  useEffect(() => {
    if (!product?.id) {
      setReviews([]);
      setRelated([]);
      return undefined;
    }
    let cancelled = false;
    api.getPublishedReviews({ product_id: product.id })
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setReviews(data);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });

    const params = {};
    if (product.category) params.category = product.category;
    api.getProducts(params)
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        const others = list
          .filter((p) => isPublishedProduct(p) && Number(p.id) !== Number(product.id))
          .slice(0, 4);
        if (others.length >= 2 || !product.brand) {
          setRelated(others);
          return;
        }
        return api.getProducts({ brand: product.brand }).then((brandList) => {
          if (cancelled || !Array.isArray(brandList)) return;
          const byBrand = brandList
            .filter((p) => isPublishedProduct(p) && Number(p.id) !== Number(product.id))
            .slice(0, 4);
          setRelated(byBrand.length ? byBrand : others);
        });
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });

    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category, product?.brand]);

  if (loading) return <div className="loading container">{t('product.loading')}</div>;

  if (error || !product) {
    return (
      <div className="container section">
        <BackButton to="/shop" label={t('product.backToShop')} className="back-nav-btn--spaced" />
        <div className="alert alert-error">{error || t('product.notFound')}</div>
      </div>
    );
  }

  // Prefer canonical slug URL when product has a slug but visitor used /shop/:id
  if (!slug && product.slug && String(id) === String(product.id)) {
    return <Navigate to={productPath(product)} replace />;
  }

  const canonicalPath = productPath(product);
  const onSale = hasDiscount(product);
  const animKind = getProductAnimKind(product.category);
  const stockCount = normalizeStock(product.stock);
  const stockStatus = getStockStatus(product.stock);
  const inStock = isInStock(product.stock);
  const stockMessage =
    stockStatus === 'out'
      ? t('product.outOfStock')
      : stockStatus === 'low'
        ? t('product.onlyLeft', { count: stockCount })
        : t('product.inStock', { count: stockCount });
  const { images: galleryImages } = getProductCardImages(product);

  const handleAdd = (e) => {
    const btn = e.currentTarget;
    requireCustomer(() => {
      const rect = btn.getBoundingClientRect();
      addItem(product, rect);
    });
  };

  return (
    <>
    <DocumentHead
      title={product.name}
      description={String(product.description || `${product.name} — AsFix & Gear Lahore`).slice(0, 155)}
      path={canonicalPath}
    />
    <ProductJsonLd product={product} path={canonicalPath} />
    <motion.section
      className="product-detail"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="container">
        <BackButton to="/shop" label={t('product.backToShop')} className="back-nav-btn--spaced" />

        <div className={`product-detail-grid ${onSale ? 'on-sale' : ''}`}>
          {animKind === 'case' ? (
            <>
              <CasePreviewer product={{ ...product, image: activeImage || product.image }} />
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
            </>
          ) : (
            <ProductDetailGallery
              product={product}
              activeImage={activeImage}
              onSelect={setActiveImage}
              onSale={onSale}
              animKind={animKind}
              DiscountRibbon={DiscountRibbon}
            />
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
                disabled={!inStock}
                onClick={handleAdd}
              >
                {t('product.addToCart')}
              </PremiumButton>
              {inStock ? (
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

        <section className="product-detail-reviews" aria-labelledby="product-reviews-heading">
          <h2 id="product-reviews-heading">{t('product.reviewsTitle')}</h2>
          {reviews.length === 0 ? (
            <p className="product-detail-reviews-empty">{t('product.reviewsEmpty')}</p>
          ) : (
            <ul className="product-detail-reviews-list">
              {reviews.map((r) => (
                <li key={r.order_ref || r.order_id || `${r.customer_name}-${r.submitted_at}`} className="product-detail-review">
                  <div className="product-detail-review-stars" aria-label={`${r.rating} stars`}>
                    {'★'.repeat(Number(r.rating) || 0)}
                  </div>
                  <p>{r.comment || t('feedback.thanks')}</p>
                  <footer>— {r.customer_name || 'Customer'}</footer>
                </li>
              ))}
            </ul>
          )}
        </section>

        {related.length > 0 ? (
          <section className="product-detail-related" aria-labelledby="related-products-heading">
            <h2 id="related-products-heading">{t('product.relatedTitle')}</h2>
            <div className="products-grid">
              {related.map((p, idx) => (
                <ProductCard key={p.id} product={p} inGrid revealIndex={idx} />
              ))}
            </div>
            <p className="product-detail-related-more">
              <Link to="/shop">{t('product.backToShop')}</Link>
            </p>
          </section>
        ) : null}
      </div>
    </motion.section>
    <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
    <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
