import { Link } from 'react-router-dom';
import { OpenBadgeLarge } from '../OpenBadge';
import { PremiumLink } from '../premium/PremiumButton';
import { getDefaultImage } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';

export default function HomeHero({ product }) {
  const { t } = useTranslation();
  const imageSrc = product?.image || getDefaultImage(product?.category || 'Cases');

  const handleImgError = (e) => {
    e.target.onerror = null;
    e.target.src = getDefaultImage(product?.category || 'Cases');
  };

  return (
    <section className="hero section--hero home-hero">
      <div className="container">
        <div className="hero-bento">
          <div className="hero-main">
            <span className="hero-tag">{t('home.heroTag')}</span>
            <h1 className="hero-title">
              {t('home.heroTitle1')}
              <br />
              <span className="grad">{t('home.heroTitle2')}</span>
            </h1>
            <p className="hero-promo">{t('home.heroPromo')}</p>
            <p className="hero-desc">{t('home.heroDesc')}</p>
            <div className="hero-actions">
              <PremiumLink to="/shop" className="btn btn-primary">
                {t('home.shopNow')}
              </PremiumLink>
            </div>
            <OpenBadgeLarge />
          </div>

          <div className="glass-card hero-bento-card">
            <div className="bento-stat-num">500+</div>
            <div className="bento-stat-label">{t('home.repairsDone')}</div>
          </div>

          <div className="glass-card bento-phone">
            {product ? (
              <img
                src={imageSrc}
                alt={product.name}
                className="bento-product-img"
                loading="eager"
                onError={handleImgError}
              />
            ) : (
              <div className="phone-mock">
                <span className="phone-mock-icon">📱</span>
                <span className="phone-mock-text">ASFIX READY</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
