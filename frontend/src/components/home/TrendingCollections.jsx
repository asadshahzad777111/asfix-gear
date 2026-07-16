import { Link } from 'react-router-dom';
import { getCategoryThumb } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';

/** PhoneCase-style “Other Trending Collections” circular tiles */
const TRENDING = [
  { category: 'Power Banks', labelKey: 'home.trendPowerBanks' },
  { category: 'Chargers', labelKey: 'home.trendWireless' },
  { category: 'Cables', labelKey: 'home.trendCables' },
  { category: 'Accessories', labelKey: 'home.trendTripods' },
  { category: 'Audio', labelKey: 'home.trendEarphones' },
  { category: 'Cases', labelKey: 'home.trendCases' },
  { category: 'Screen Guards', labelKey: 'home.trendGuards' },
  { category: 'Back Covers', labelKey: 'home.trendCovers' },
];

export default function TrendingCollections() {
  const { t } = useTranslation();

  return (
    <section className="home-section pc-trending">
      <div className="container">
        <div className="home-section-head">
          <h2 className="section-title pc-trending-title">{t('home.trendingTitle')}</h2>
        </div>
        <div className="pc-trending-grid">
          {TRENDING.map((item) => (
            <Link
              key={item.category}
              to={`/shop?category=${encodeURIComponent(item.category)}`}
              className="pc-trending-item"
            >
              <span className="pc-trending-circle">
                <img
                  src={getCategoryThumb(item.category, 160) || getCategoryThumb('Accessories', 160)}
                  alt=""
                  loading="lazy"
                />
              </span>
              <span className="pc-trending-label">{t(item.labelKey)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
