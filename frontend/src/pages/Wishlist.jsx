import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { getDefaultImage } from '../config/products';
import { getSalePrice, getSavings, hasDiscount } from '../utils/pricing';
import { isInStock, getStockStatus, normalizeStock } from '../utils/stock';
import { getProductCardImages } from '../utils/productImages';
import { productPath as buildProductPath } from '../utils/slug';
import { useWishlistIds } from '../hooks/useWishlist';
import { useCart } from '../context/CartContext';
import { useTranslation } from '../context/LanguageContext';
import { useShopGate } from '../hooks/useShopGate';
import DocumentHead from '../components/seo/DocumentHead';
import ShopLoginPrompt from '../components/ShopLoginPrompt';
import CustomerLoginModal from '../components/CustomerLoginModal';

function HeartIcon({ filled = false, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21s-6.2-4.35-9.33-8.22C.7 10.2.9 6.9 3.4 5.05A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.6-1.05c2.5 1.85 2.7 5.15.73 7.73C18.2 16.65 12 21 12 21z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Wishlist() {
  const { t } = useTranslation();
  const { ids, count, remove } = useWishlistIds();
  const { addItem } = useCart();
  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const addRefs = useRef({});

  useEffect(() => {
    let cancelled = false;
    if (!ids.length) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    api
      .getProducts()
      .then((all) => {
        if (cancelled) return;
        const map = new Map(all.map((p) => [Number(p.id), p]));
        setProducts(ids.map((id) => map.get(id)).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const handleAdd = (product) => {
    requireCustomer(() => {
      const el = addRefs.current[product.id];
      const rect = el?.getBoundingClientRect();
      if (rect) addItem(product, rect);
    });
  };

  const showList = !loading && products.length > 0;

  return (
    <>
      <DocumentHead title={t('wishlist.pageTitle')} path="/wishlist" />

      <header className="wl-hero">
        <div className="wl-hero__glow" aria-hidden="true" />
        <div className="container wl-hero__inner">
          <p className="wl-hero__eyebrow">{t('wishlist.eyebrow')}</p>
          <h1 className="wl-hero__title">{t('wishlist.title')}</h1>
          <p className="wl-hero__sub">{t('wishlist.subtitle')}</p>
          {showList && (
            <p className="wl-hero__meta">
              {count === 1
                ? t('wishlist.countOne')
                : t('wishlist.countMany', { count })}
            </p>
          )}
        </div>
      </header>

      <section className="section wl-section">
        <div className="container pc-wishlist">
          {loading ? (
            <p className="section-subtitle wl-loading">{t('common.loading')}</p>
          ) : count === 0 || products.length === 0 ? (
            <div className="pc-wishlist-empty">
              <div className="pc-wishlist-empty-icon" aria-hidden="true">
                <HeartIcon size={48} />
              </div>
              <h2>{t('wishlist.emptyTitle')}</h2>
              <p>{t('wishlist.emptySub')}</p>
              <Link to="/shop" className="btn btn-primary">
                {t('wishlist.shopCta')}
              </Link>
            </div>
          ) : (
            <>
              <p className="wl-nudge">{t('wishlist.nudge')}</p>
              <div className="pc-wishlist-grid">
                {products.map((p) => {
                  const sale = getSalePrice(p);
                  const img = p.image || getDefaultImage(p.category);
                  const onSale = hasDiscount(p);
                  const stockStatus = getStockStatus(p.stock);
                  const stockQty = normalizeStock(p.stock);
                  const inStock = isInStock(p.stock);
                  const path = buildProductPath(p);
                  const savings = onSale ? getSavings(p) : 0;

                  return (
                    <article key={p.id} className="pc-wishlist-card">
                      <div className="pc-wishlist-card-media-wrap">
                        <Link to={path} className="pc-wishlist-card-media">
                          <img src={img} alt={p.name} loading="lazy" />
                        </Link>
                        {onSale && (
                          <span className="wl-badge wl-badge--sale">
                            -{Number(p.discount_percent)}%
                          </span>
                        )}
                        {!inStock && (
                          <span className="wl-badge wl-badge--oos">{t('product.soldOut')}</span>
                        )}
                        <button
                          type="button"
                          className="wl-remove"
                          onClick={() => remove(p.id)}
                          aria-label={t('wishlist.remove')}
                          title={t('wishlist.remove')}
                        >
                          <HeartIcon filled size={18} />
                        </button>
                      </div>

                      <div className="pc-wishlist-card-body">
                        <Link to={path} className="wl-card-title-link">
                          <h3>{p.name}</h3>
                        </Link>

                        <p className="pc-wishlist-price">
                          {onSale && (
                            <span className="pc-wishlist-was">{formatPrice(p.price)}</span>
                          )}
                          <strong>{formatPrice(sale)}</strong>
                        </p>

                        {onSale && savings > 0 && (
                          <p className="wl-save-line">{t('wishlist.youSave', { amount: formatPrice(savings) })}</p>
                        )}

                        <p
                          className={`wl-stock wl-stock--${stockStatus}`}
                        >
                          {stockStatus === 'out'
                            ? t('wishlist.stockOut')
                            : stockStatus === 'low'
                              ? t('wishlist.stockLow', { count: stockQty })
                              : t('wishlist.stockIn')}
                        </p>

                        <div className="wl-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm wl-add"
                            ref={(el) => {
                              addRefs.current[p.id] = el;
                            }}
                            disabled={!inStock}
                            onClick={() => handleAdd(p)}
                          >
                            {inStock ? t('product.addToCart') : t('product.soldOut')}
                          </button>
                          <Link to={path} className="btn btn-ghost btn-sm wl-view">
                            {t('wishlist.viewItem')}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="wl-footer-cta">
                <p>{t('wishlist.keepBrowsing')}</p>
                <Link to="/shop" className="btn btn-outline">
                  {t('wishlist.shopMore')}
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <ShopLoginPrompt
        open={promptOpen}
        onClose={closePrompt}
        onSignIn={openLoginFromPrompt}
      />
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
