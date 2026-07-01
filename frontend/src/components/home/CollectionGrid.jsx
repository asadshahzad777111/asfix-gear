import { Link } from 'react-router-dom';
import { DEFAULT_IMAGES, HOME_COLLECTIONS } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';

const COLLECTION_HINTS = {
  Cases: 'home.collectionCases',
  Chargers: 'home.collectionChargers',
  'Screen Guards': 'home.collectionScreenGuards',
  Audio: 'home.collectionAudio',
};

export default function CollectionGrid() {
  const { t } = useTranslation();

  return (
    <section className="home-section">
      <div className="container">
        <div className="home-section-head">
          <span className="eyebrow">{t('home.collectionsEyebrow')}</span>
          <h2 className="section-title">{t('home.shopCollection')}</h2>
          <p className="section-subtitle">{t('home.shopCollectionSub')}</p>
        </div>
        <div className="home-collection-grid">
          {HOME_COLLECTIONS.map((category) => (
            <Link
              key={category}
              to={`/shop?category=${encodeURIComponent(category)}`}
              className="home-collection-card"
            >
              <img
                src={DEFAULT_IMAGES[category]}
                alt={category}
                loading="lazy"
              />
              <div className="home-collection-overlay">
                <strong>{category}</strong>
                <span>{t(COLLECTION_HINTS[category] || 'home.collectionDefault')}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
