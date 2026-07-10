import { PremiumLink } from '../premium/PremiumButton';
import { getDefaultImage } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import ScrambleText from '../motion/ScrambleText';

export default function HomeHero({ product }) {
  const { t } = useTranslation();
  const imageSrc = product?.image || getDefaultImage(product?.category || 'Cases');
  const productLabel = product?.name || t('home.heroVisualFallback');

  const handleImgError = (e) => {
    e.target.onerror = null;
    e.target.src = getDefaultImage(product?.category || 'Cases');
  };

  return (
    <section className="loco-hero" aria-label={t('home.heroAria')}>
      <div className="loco-hero__grain" aria-hidden="true" />

      <div className="loco-hero__inner">
        <div className="loco-hero__copy">
          <h1 className="loco-hero__brand">
            <ScrambleText text="AsFix" delay={80} duration={700} />
            {' '}
            <em>
              <ScrambleText text="& Gear" as="span" delay={220} duration={800} />
            </em>
          </h1>

          <p className="loco-hero__headline">
            <ScrambleText text={t('home.heroHeadline')} delay={400} duration={900} />
          </p>

          <p className="loco-hero__line">{t('home.heroDesc')}</p>

          <div className="loco-hero__actions">
            <PremiumLink to="/repair" className="btn btn-primary">
              {t('home.bookRepair')}
            </PremiumLink>
            <PremiumLink to="/shop" className="btn btn-outline">
              {t('home.shopGear')}
            </PremiumLink>
          </div>
        </div>

        <div className="loco-hero__visual">
          <div className="loco-hero__frame">
            <img
              src={imageSrc}
              alt={productLabel}
              loading="eager"
              onError={handleImgError}
            />
            <div className="loco-hero__frame-meta">
              <span>{t('home.heroVisualLabel')}</span>
              <span>Lahore</span>
            </div>
          </div>
        </div>
      </div>

      <div className="loco-hero__scroll" aria-hidden="true">
        <span className="loco-hero__scroll-line" />
        {t('home.scroll')}
      </div>
    </section>
  );
}
