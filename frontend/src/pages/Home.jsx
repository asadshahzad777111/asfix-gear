import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { hasDiscount } from '../utils/pricing';
import { readProductsCache, writeProductsCache } from '../utils/productCache';
import HomeHero from '../components/home/HomeHero';
import BrandGrid from '../components/home/BrandGrid';
import ModelGrid from '../components/home/ModelGrid';
import CollectionGrid from '../components/home/CollectionGrid';
import PromoBanners from '../components/home/PromoBanners';
import ProductCarousel from '../components/home/ProductCarousel';
import TrendingCategories from '../components/home/TrendingCategories';
import LocationSection from '../components/LocationSection';
import { useTranslation } from '../context/LanguageContext';

function filterShopProducts(products) {
  return products.filter((p) => p.category !== 'Gaming');
}

export default function Home() {
  const { t } = useTranslation();
  const [heroProduct, setHeroProduct] = useState(null);
  const [topSelling, setTopSelling] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [saleProducts, setSaleProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const applyProducts = (all) => {
    const shop = filterShopProducts(all);
    const featured = shop.filter((p) => p.featured);
    const onSale = shop.filter((p) => hasDiscount(p));

    setHeroProduct(featured[0] || shop[0] || null);
    setTopSelling((featured.length ? featured : shop).slice(0, 8));
    setNewArrivals([...shop].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 8));
    setSaleProducts(onSale.slice(0, 2));
  };

  useEffect(() => {
    let cancelled = false;
    const cacheKey = 'home_all';

    const load = async () => {
      const cached = readProductsCache(cacheKey);
      if (cached?.length) {
        applyProducts(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const all = await api.getProducts();
        if (cancelled) return;
        applyProducts(all);
        writeProductsCache(cacheKey, all);
        setLoadError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <HomeHero product={heroProduct} />
      <BrandGrid />
      <ModelGrid />
      <CollectionGrid />
      <PromoBanners products={saleProducts} />
      {loadError && !topSelling.length ? (
        <section className="home-section">
          <div className="container">
            <div className="empty-state">
              <p>{t('shop.serverStarting')}</p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '1rem' }}
                onClick={() => window.location.reload()}
              >
                {t('shop.retryLoad')}
              </button>
            </div>
          </div>
        </section>
      ) : loading && !topSelling.length ? (
        <section className="home-section">
          <div className="container">
            <div className="loading">{t('shop.loadingProducts')}</div>
          </div>
        </section>
      ) : (
        <>
          <ProductCarousel
            titleKey="home.topSelling"
            subtitleKey="home.topSellingSub"
            products={topSelling}
          />
          <ProductCarousel
            titleKey="home.newArrival"
            subtitleKey="home.newArrivalSub"
            products={newArrivals}
            viewAllTo="/shop"
          />
        </>
      )}
      <TrendingCategories />
      <LocationSection />
    </>
  );
}
