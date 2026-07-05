import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { hasDiscount } from '../utils/pricing';
import { readProductsCache, writeProductsCache } from '../utils/productCache';
import { filterPublishedProducts } from '../utils/productStatus';
import HomeHero from '../components/home/HomeHero';
import TrustBadges from '../components/home/TrustBadges';
import CollectionGrid from '../components/home/CollectionGrid';
import BrandGrid from '../components/home/BrandGrid';
import ModelGrid from '../components/home/ModelGrid';
import PromoBanners from '../components/home/PromoBanners';
import ProductCarousel from '../components/home/ProductCarousel';
import TrendingCategories from '../components/home/TrendingCategories';
import LocationSection from '../components/LocationSection';
import Testimonials from '../components/Testimonials';
import { HomeProductsSkeleton } from '../components/skeleton/ContentSkeletons';
import { useTranslation } from '../context/LanguageContext';

function filterShopProducts(products) {
  return filterPublishedProducts(products).filter((p) => p.category !== 'Gaming');
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
        const all = filterPublishedProducts(await api.getProducts());
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
      <TrustBadges />
      <CollectionGrid />
      <PromoBanners products={saleProducts} />
      {loadError && !topSelling.length ? (
        <HomeProductsSkeleton
          coldStart={t('shop.serverStarting')}
          onRetry={() => window.location.reload()}
          retryLabel={t('shop.retryLoad')}
        />
      ) : loading && !topSelling.length ? (
        <HomeProductsSkeleton />
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
      <BrandGrid />
      <ModelGrid />
      <section className="home-section home-reviews">
        <div className="container">
          <div className="home-section-head">
            <span className="eyebrow">{t('home.reviewsEyebrow')}</span>
            <h2 className="section-title">{t('home.reviewsTitle')}</h2>
          </div>
          <Testimonials />
        </div>
      </section>
      <LocationSection />
    </>
  );
}
