import { useTranslation } from '../../context/LanguageContext';

const BADGES = [
  { key: 'trustWarranty', icon: '01' },
  { key: 'trustGenuine', icon: '02' },
  { key: 'trustFastService', icon: '03' },
  { key: 'trustExpert', icon: '04' },
];

export default function TrustBadges() {
  const { t } = useTranslation();

  return (
    <section className="home-section home-trust" aria-label={t('home.trustEyebrow')}>
      <div className="container">
        <div className="home-trust-row">
          {BADGES.map(({ key, icon }) => (
            <div key={key} className="home-trust-badge">
              <span className="home-trust-icon" aria-hidden="true">{icon}</span>
              <span className="home-trust-label">{t(`home.${key}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
