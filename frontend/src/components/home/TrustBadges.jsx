import { useTranslation } from '../../context/LanguageContext';
import TextParticle from '../motion/TextParticle';

const BADGES = [
  { key: 'trustWarranty' },
  { key: 'trustGenuine' },
  { key: 'trustFastService' },
  { key: 'trustExpert' },
];

export default function TrustBadges() {
  const { t } = useTranslation();

  return (
    <section className="home-section home-trust" aria-label={t('home.trustEyebrow')}>
      <div className="container">
        <div className="home-trust-row" role="list">
          {BADGES.map(({ key }) => (
            <div key={key} className="home-trust-badge" role="listitem">
              <TextParticle
                as="span"
                className="home-trust-label"
                text={t(`home.${key}`)}
                gap={2}
                particleSize={1.35}
                mouseRadius={36}
                maxParticles={720}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
