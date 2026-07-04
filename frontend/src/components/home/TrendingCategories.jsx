import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCategoryThumb,
  MODEL_SPECIFIC_CATEGORIES,
  SHOP_CATEGORIES,
} from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import PhoneFinderModal from '../PhoneFinderModal';

const CATEGORY_ICONS = {
  Cables: '🔗',
  'Screen Guards': '🛡️',
  'Power Banks': '🔋',
  Accessories: '✨',
};

function scrollPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

export default function TrendingCategories() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [finderCategory, setFinderCategory] = useState(null);

  const handleClick = (category) => {
    if (MODEL_SPECIFIC_CATEGORIES.includes(category)) {
      setFinderCategory(category);
      return;
    }
    navigate(`/shop?category=${encodeURIComponent(category)}`);
    requestAnimationFrame(scrollPageTop);
  };

  const handleFinderClose = (didNavigate) => {
    setFinderCategory(null);
    if (didNavigate) requestAnimationFrame(scrollPageTop);
  };

  return (
    <section className="home-section home-section--trending">
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
              <span
                className={`home-trending-circle${getCategoryThumb(category) ? ' home-trending-circle--photo' : ''}`}
                aria-hidden="true"
              >
                {getCategoryThumb(category) ? (
                  <img src={getCategoryThumb(category)} alt="" loading="lazy" draggable={false} />
                ) : (
                  CATEGORY_ICONS[category] || '📦'
                )}
              </span>
              <span className="home-trending-label">{category}</span>
            </button>
          ))}
        </div>
      </div>

      <PhoneFinderModal
        open={Boolean(finderCategory)}
        category={finderCategory}
        onClose={() => handleFinderClose(false)}
        onNavigate={() => handleFinderClose(true)}
      />
    </section>
  );
}
