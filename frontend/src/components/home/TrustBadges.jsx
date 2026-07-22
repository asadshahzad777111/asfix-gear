import { useTranslation } from '../../context/LanguageContext';

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
              <span className="home-trust-label">{t(`home.${key}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
