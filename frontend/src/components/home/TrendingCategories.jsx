import { Link } from 'react-router-dom';
import { SHOP_CATEGORIES } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';

const CATEGORY_ICONS = {
  Cases: '📱',
  Chargers: '🔌',
  Cables: '🔗',
  'Screen Guards': '🛡️',
  Audio: '🎧',
  'Power Banks': '🔋',
  Accessories: '✨',
};

export default function TrendingCategories() {
  const { t } = useTranslation();

  return (
    <section className="home-section">
      <div className="container">
        <div className="home-section-head">
          <span className="eyebrow">{t('home.trendingEyebrow')}</span>
          <h2 className="section-title">{t('home.trending')}</h2>
          <p className="section-subtitle">{t('home.trendingSub')}</p>
        </div>
        <div className="home-trending-row">
          {SHOP_CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`/shop?category=${encodeURIComponent(category)}`}
              className="home-trending-chip"
            >
              <span className="home-trending-circle" aria-hidden="true">
                {CATEGORY_ICONS[category] || '📦'}
              </span>
              <span className="home-trending-label">{category}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
