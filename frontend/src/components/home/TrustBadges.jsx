import { useTranslation } from '../../context/LanguageContext';
import TextParticle from '../motion/TextParticle';

const BADGES = [
  { key: 'trustWarranty' },
  { key: 'trustGenuine' },
  { key: 'trustFastService' },
  { key: 'trustExpert' },
];

/**
 * Compact trust rail — static labels stay LEGIBLE; particles only on desktop hover
 * (same pattern as the marquee). Avoids TextParticle height blowout.
 */
export default function TrustBadges() {
  const { t } = useTranslation();

  return (
    <section className="home-section home-trust" aria-label={t('home.trustEyebrow')}>
      <div className="container">
        <div className="home-trust-row" role="list">
          {BADGES.map(({ key }) => {
            const label = t(`home.${key}`);
            return (
              <div key={key} className="home-trust-badge" role="listitem">
                <span className="home-trust-stack">
                  <span className="home-trust-label-static">{label}</span>
                  <TextParticle
                    as="span"
                    className="home-trust-label"
                    text={label}
                    gap={2}
                    particleSize={1.35}
                    mouseRadius={36}
                    maxParticles={720}
                    aria-hidden
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
