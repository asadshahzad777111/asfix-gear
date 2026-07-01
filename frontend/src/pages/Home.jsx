import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import Marquee from '../components/Marquee';
import RepairSteps from '../components/RepairSteps';
import LocationSection from '../components/LocationSection';
import { PremiumLink, PremiumAnchor } from '../components/premium/PremiumButton';
import { OpenBadgeLarge } from '../components/OpenBadge';
import RepairServiceCard from '../components/RepairServiceCard';
import { api } from '../api/client';
import { SHOP, generalWhatsAppMessage } from '../config/shop';
import { useTranslation } from '../context/LanguageContext';

export default function Home() {
  const { t } = useTranslation();
  const [featured, setFeatured] = useState([]);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  const features = [
    { icon: '🔧', title: t('home.feature1Title'), desc: t('home.feature1Desc') },
    { icon: '💎', title: t('home.feature2Title'), desc: t('home.feature2Desc') },
    { icon: '⚡', title: t('home.feature3Title'), desc: t('home.feature3Desc') },
    { icon: '🤝', title: t('home.feature4Title'), desc: t('home.feature4Desc') },
  ];

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [products, repairServices] = await Promise.all([
          api.getProducts({ featured: 'true' }),
          api.getRepairServices(),
        ]);
        if (cancelled) return;
        setFeatured(
          products.filter((p) => p.category !== 'Gaming').slice(0, 4)
        );
        setServices(repairServices.slice(0, 6));
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
          setServicesLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="hero section--hero">
        <div className="container">
          <div className="hero-bento">
            <div className="hero-main">
              <span className="hero-tag">⚡ {SHOP.owner} — {SHOP.name}</span>
              <h1 className="hero-title">
                {t('home.heroTitle1')}<br />
                <span className="grad">{t('home.heroTitle2')}</span>
              </h1>
              <p className="hero-desc">
                {t('home.heroDesc')}
                {' '}WhatsApp: <strong>{SHOP.phone}</strong> · {t('shop.hours')}
              </p>
              <div className="hero-actions">
                <PremiumLink to="/shop" className="btn btn-primary">{t('home.shopGear')}</PremiumLink>
                <PremiumAnchor
                  href={generalWhatsAppMessage()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-whatsapp"
                >
                  {t('nav.whatsapp')}
                </PremiumAnchor>
              </div>
              <OpenBadgeLarge />
            </div>

            <div className="glass-card hero-bento-card">
              <div className="bento-stat-num">500+</div>
              <div className="bento-stat-label">{t('home.repairsDone')}</div>
            </div>

            <div className="glass-card bento-phone">
              <div className="phone-mock">
                <span className="phone-mock-icon">📱</span>
                <span className="phone-mock-text">ASFIX READY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Marquee />

      <section className="section section--features">
        <div className="container">
          <div className="bento-features">
            {features.map((f) => (
              <div key={f.title} className="glass-card bento-feature">
                <span className="bento-feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--steps">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t('home.howItWorks')}</span>
            <h2 className="section-title">{t('home.stepsTitle')}</h2>
            <p className="section-subtitle">{t('home.stepsSub')}</p>
          </div>
          <RepairSteps />
        </div>
      </section>

      <section className="section section--services">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t('home.servicesEyebrow')}</span>
            <h2 className="section-title">{t('home.servicesTitle')}</h2>
            <p className="section-subtitle">{t('home.servicesSub')}</p>
          </div>
          {servicesLoading ? (
            <div className="loading">{t('home.loadingServices')}</div>
          ) : (
            <div className="services-grid">
              {services.map((service) => (
                <RepairServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section section--shop" id="featured-shop">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t('nav.shop')}</span>
            <h2 className="section-title">{t('home.featured')}</h2>
            <p className="section-subtitle">{t('home.featuredSub')}</p>
          </div>
          {productsLoading ? (
            <div className="loading">{t('shop.loadingProducts')}</div>
          ) : (
            <div className="products-grid products-grid--reveal">
              {featured.map((product, index) => (
                <ProductCard key={product.id} product={product} inGrid revealIndex={index} />
              ))}
            </div>
          )}
          <div className="text-center mt-2">
            <Link to="/shop" className="btn btn-primary">{t('home.viewAll')} →</Link>
          </div>
        </div>
      </section>

      <LocationSection />

      <section className="cta-section section--cta">
        <div className="container">
          <div className="cta-card glass-card">
            <h2>{t('home.ctaTitle')}</h2>
            <p>{t('home.ctaDesc', { owner: SHOP.owner })}</p>
            <div className="cta-actions">
              <a href={generalWhatsAppMessage()} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                💬 {t('nav.whatsapp')} {SHOP.phone}
              </a>
              <PremiumLink to="/shop" className="btn btn-outline">{t('home.shopGear')}</PremiumLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
