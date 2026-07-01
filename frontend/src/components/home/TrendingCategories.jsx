import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODEL_SPECIFIC_CATEGORIES, SHOP_CATEGORIES } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import PhoneFinderModal from '../PhoneFinderModal';

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
  const navigate = useNavigate();
  const [finderCategory, setFinderCategory] = useState(null);

  const handleClick = (category) => {
    if (MODEL_SPECIFIC_CATEGORIES.includes(category)) {
      setFinderCategory(category);
    } else {
      navigate(`/shop?category=${encodeURIComponent(category)}`);
    }
  };

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
            <button
              key={category}
              type="button"
              onClick={() => handleClick(category)}
              className="home-trending-chip"
            >
              <span className="home-trending-circle" aria-hidden="true">
                {CATEGORY_ICONS[category] || '📦'}
              </span>
              <span className="home-trending-label">{category}</span>
            </button>
          ))}
        </div>
      </div>

      <PhoneFinderModal
        open={Boolean(finderCategory)}
        category={finderCategory}
        onClose={() => setFinderCategory(null)}
      />
    </section>
  );
}
