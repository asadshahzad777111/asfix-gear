import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { getDefaultImage } from '../config/products';
import { getSalePrice, hasDiscount } from '../utils/pricing';
import { useWishlistIds } from '../hooks/useWishlist';
import { useTranslation } from '../context/LanguageContext';
import DocumentHead from '../components/seo/DocumentHead';

export default function Wishlist() {
  const { t } = useTranslation();
  const { ids, count, remove } = useWishlistIds();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <DocumentHead title={t('wishlist.pageTitle')} path="/wishlist" />
      <div className="pc-wishlist-banner">
        <h1>{t('wishlist.banner')}</h1>
      </div>
      <section className="section">
        <div className="container pc-wishlist">
          {loading ? (
            <p className="section-subtitle">{t('common.loading')}</p>
          ) : count === 0 || products.length === 0 ? (
            <div className="pc-wishlist-empty">
              <div className="pc-wishlist-empty-icon" aria-hidden="true">
                ♡
              </div>
              <h2>{t('wishlist.emptyTitle')}</h2>
              <p>{t('wishlist.emptySub')}</p>
              <Link to="/shop" className="btn btn-primary">
                {t('wishlist.shopCta')}
              </Link>
            </div>
          ) : (
            <div className="pc-wishlist-grid">
              {products.map((p) => {
                const sale = getSalePrice(p);
                const img = p.image || getDefaultImage(p.category);
                return (
                  <article key={p.id} className="pc-wishlist-card">
                    <Link to={`/shop/${p.id}`} className="pc-wishlist-card-media">
                      <img src={img} alt={p.name} loading="lazy" />
                    </Link>
                    <div className="pc-wishlist-card-body">
                      <Link to={`/shop/${p.id}`}>
                        <h3>{p.name}</h3>
                      </Link>
                      <p className="pc-wishlist-price">
                        {hasDiscount(p) && (
                          <span className="pc-wishlist-was">{formatPrice(p.price)}</span>
                        )}
                        <strong>{formatPrice(sale)}</strong>
                      </p>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(p.id)}>
                        {t('wishlist.remove')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
