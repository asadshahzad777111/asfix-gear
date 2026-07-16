import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCategoryThumb, DEFAULT_IMAGES } from '../../config/products';
import { api } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';

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

function resolveImage(category, overrides) {
  const custom = overrides?.[category];
  if (custom) return custom;
  return getCategoryThumb(category, 200) || DEFAULT_IMAGES[category] || DEFAULT_IMAGES.Accessories;
}

export default function TrendingCollections() {
  const { t } = useTranslation();
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    api
      .getStorefrontImages()
      .then((data) => {
        if (data?.category_images) setOverrides(data.category_images);
      })
      .catch(() => {});
  }, []);

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
                <img src={resolveImage(item.category, overrides)} alt="" loading="lazy" />
              </span>
              <span className="pc-trending-label">{t(item.labelKey)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
