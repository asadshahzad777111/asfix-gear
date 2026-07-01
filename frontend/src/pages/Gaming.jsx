import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useGaming } from '../context/GamingContext';
import { useTranslation } from '../context/LanguageContext';
import GamingLogo from '../components/gaming/GamingLogo';
import GamingProductCard from '../components/gaming/GamingProductCard';
import { gamingContactPath, SHOP } from '../config/shop';
import { startVisibilityPoll } from '../utils/visibilityPoll';

const PUBG_TAGS = ['PUBG Mobile', 'Battle Royale', 'Triggers', 'Claw Grip', 'Low Latency', 'RGB Gear'];
const STOCK_POLL_MS = 20_000;

export default function Gaming() {
  const { isStaff } = useAuth();
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { exitGamingMode } = useGaming();

  useEffect(() => {
    const load = () => {
      api.getProducts({ category: 'Gaming' })
        .then(setProducts)
        .catch(console.error)
        .finally(() => setLoading(false));
    };
    // Gaming stock moves fast (walk-in + online sales) — keep it fresh with a
    // lightweight poll instead of only fetching once on mount, so shoppers
    // never see an out-of-date "in stock" badge for gear that just sold out.
    return startVisibilityPoll(load, STOCK_POLL_MS);
  }, []);

  return (
    <div className="gaming-page">
      <div className="gaming-page-bg">
        <div className="gaming-hex-grid" />
        <div className="gaming-page-glow gaming-page-glow--1" />
        <div className="gaming-page-glow gaming-page-glow--2" />
      </div>

      <section className="gaming-hero">
        <div className="container gaming-hero-inner">
          <div className="gaming-hero-badge">
            <GamingLogo size={36} />
            <span>{t('gaming.badge')}</span>
          </div>

          <h1 className="gaming-hero-title">
            <span className="gaming-glitch" data-text={t('gaming.titleBattle')}>{t('gaming.titleBattle')}</span>
            <span className="gaming-hero-accent">{t('gaming.titleAccent')}</span>
          </h1>

          <p className="gaming-hero-sub">
            {t('gaming.heroSub', { owner: SHOP.owner })}
          </p>

          <div className="gaming-tags">
            {PUBG_TAGS.map((tag) => (
              <span key={tag} className="gaming-tag">{tag}</span>
            ))}
          </div>

          <div className="gaming-hero-actions">
            <a href="#gaming-products" className="btn-gaming-primary">{t('gaming.shopGear')}</a>
            <Link to={gamingContactPath()} className="btn-gaming-outline">
              {t('gaming.whatsappOrder')}
            </Link>
            <button type="button" className="btn-gaming-outline btn-gaming-exit" onClick={exitGamingMode}>
              {t('gaming.exitMode')}
            </button>
          </div>

          <div className="gaming-stats">
            <div className="gaming-stat">
              <strong>{products.length || '10+'}</strong>
              <span>{t('gaming.statProducts')}</span>
            </div>
            <div className="gaming-stat">
              <strong>PUBG</strong>
              <span>{t('gaming.statTriggers')}</span>
            </div>
            <div className="gaming-stat">
              <strong>0ms</strong>
              <span>{t('gaming.statLatency')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="gaming-marquee" aria-hidden="true">
        <div className="gaming-marquee-track">
          {[...Array(2)].map((_, gi) => (
            <span key={gi}>
              {['PUBG TRIGGERS', 'THUMB GRIPS', 'COOLING FAN', 'FINGER SLEEVES', 'GAMING BUDS', 'CLAW SLEEVE', 'RGB CASE', '6-FINGER GRIP'].map((item) => (
                <span key={`${gi}-${item}`} className="gaming-marquee-item">{item} ◆ </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      <section id="gaming-products" className="gaming-products-section">
        <div className="container">
          <div className="gaming-section-head">
            <GamingLogo size={52} />
            <div>
              <span className="gaming-eyebrow">{t('gaming.sectionEyebrow')}</span>
              <h2>{t('gaming.sectionTitle')}</h2>
              <p>{t('gaming.sectionSub')}</p>
            </div>
          </div>

          {loading ? (
            <div className="gaming-loading">
              <GamingLogo size={64} className="gaming-loading-spin" />
              <p>{t('gaming.loading')}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="gaming-empty">
              <p>{t('gaming.empty')}</p>
              {isStaff && (
                <Link to="/admin?tab=add" className="btn-gaming-primary">{t('gaming.addProduct')}</Link>
              )}
            </div>
          ) : (
            <div className="gaming-products-grid">
              {products.map((product, i) => (
                <GamingProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="gaming-cta">
        <div className="container gaming-cta-inner">
          <GamingLogo size={60} />
          <h2>{t('gaming.ctaTitle')}</h2>
          <p>{t('gaming.ctaSub', { phone: SHOP.phone })}</p>
          <Link to={gamingContactPath()} className="btn-gaming-primary btn-gaming-lg">
            {t('gaming.ctaBtn', { phone: SHOP.phone })}
          </Link>
        </div>
      </section>
    </div>
  );
}
