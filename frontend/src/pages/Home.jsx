import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { hasDiscount } from '../utils/pricing';
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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const all = await api.getProducts();
        if (cancelled) return;

        const shop = filterShopProducts(all);
        const featured = shop.filter((p) => p.featured);
        const onSale = shop.filter((p) => hasDiscount(p));

        setHeroProduct(featured[0] || shop[0] || null);
        setTopSelling((featured.length ? featured : shop).slice(0, 8));
        setNewArrivals(
          [...shop].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 8)
        );
        setSaleProducts(onSale.slice(0, 2));
      } catch (err) {
        console.error(err);
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
      {loading ? (
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
