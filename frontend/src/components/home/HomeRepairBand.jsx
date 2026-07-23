import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { PremiumLink } from '../premium/PremiumButton';
import ConnectReveal from '../motion/ConnectReveal';

/**
 * Mid-page CTA band — flat/minimal, orange brand (21st CTA pattern, no purple glass).
 * One job: push Repair + Shop without card clutter.
 */
export default function HomeRepairBand() {
  const { t } = useTranslation();

  return (
    <section
      className="home-section home-repair-band"
      data-section-strap={t('home.repairBandTitle')}
      id="home-repair-cta"
      aria-labelledby="home-repair-band-title"
    >
      <div className="container">
        <ConnectReveal className="home-repair-band__inner" from="up">
          <div className="home-repair-band__copy">
            <span className="eyebrow">{t('home.repairBandEyebrow')}</span>
            <h2 id="home-repair-band-title" className="home-repair-band__title">
              {t('home.repairBandTitle')}
            </h2>
            <p className="home-repair-band__sub">{t('home.repairBandSub')}</p>
          </div>
          <div className="home-repair-band__actions">
            <PremiumLink to="/repair" className="btn btn-primary home-repair-band__cta">
              {t('home.bookRepairNow')}
            </PremiumLink>
            <Link to="/shop" className="btn btn-outline home-repair-band__cta">
              {t('home.repairBandShop')}
            </Link>
          </div>
        </ConnectReveal>
      </div>
    </section>
  );
}
