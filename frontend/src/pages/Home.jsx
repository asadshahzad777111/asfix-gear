import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { readProductsCache, writeProductsCache } from '../utils/productCache';
import { filterPublishedProducts } from '../utils/productStatus';
import HomeHero from '../components/home/HomeHero';
import TrustBadges from '../components/home/TrustBadges';
import Marquee from '../components/Marquee';
import CollectionGrid from '../components/home/CollectionGrid';
import BrandGrid from '../components/home/BrandGrid';
import ProductCarousel from '../components/home/ProductCarousel';
import LocationSection from '../components/LocationSection';
import Testimonials from '../components/Testimonials';
import ConnectReveal from '../components/motion/ConnectReveal';
import TextParticle from '../components/motion/TextParticle';
import { HomeProductsSkeleton } from '../components/skeleton/ContentSkeletons';
import { useTranslation } from '../context/LanguageContext';
import { SHOP } from '../config/shop';
import DocumentHead from '../components/seo/DocumentHead';
import { LocalBusinessJsonLd } from '../components/seo/JsonLd';

function filterShopProducts(products) {
  return filterPublishedProducts(products).filter((p) => p.category !== 'Gaming');
}

export default function Home() {
  const { t } = useTranslation();
  const [topSelling, setTopSelling] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const applyProducts = (all) => {
    const shop = filterShopProducts(all);
    const featured = shop.filter((p) => p.featured);

    setTopSelling((featured.length ? featured : shop).slice(0, 8));
    setNewArrivals([...shop].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 8));
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
      <DocumentHead
        title={null}
        description={`AsFix & Gear Lahore — expert mobile repair, accessories, and gaming gear. WhatsApp ${SHOP.phone}.`}
        path="/"
      />
      <LocalBusinessJsonLd />
      <HomeHero />
      <TrustBadges />
      <Marquee />
      <BrandGrid />
      <CollectionGrid />

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

      <section
        className="home-section home-reviews"
        data-section-strap={t('home.reviewsTitle')}
        id="home-reviews"
      >
        <div className="container">
          <ConnectReveal className="home-section-head" from="line">
            <span className="eyebrow">{t('home.reviewsEyebrow')}</span>
            <TextParticle
              as="h2"
              className="section-title"
              text={t('home.reviewsTitle')}
              gap={3}
              mouseRadius={56}
              maxParticles={720}
            />
          </ConnectReveal>
          <ConnectReveal delay={80} from="up">
            <Testimonials />
          </ConnectReveal>
        </div>
      </section>

      <LocationSection />
    </>
  );
}
