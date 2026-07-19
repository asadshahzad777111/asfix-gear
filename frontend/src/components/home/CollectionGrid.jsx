import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_IMAGES, HOME_COLLECTIONS, MODEL_SPECIFIC_CATEGORIES } from '../../config/products';
import { api } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';
import PhoneFinderModal from '../PhoneFinderModal';
import ConnectReveal from '../motion/ConnectReveal';
import TypeLine from '../motion/TypeLine';

const COLLECTION_HINTS = {
  Cases: 'home.collectionCases',
  Chargers: 'home.collectionChargers',
  'Screen Guards': 'home.collectionScreenGuards',
  Audio: 'home.collectionAudio',
};

export default function CollectionGrid() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [finderCategory, setFinderCategory] = useState(null);
  const [imageOverrides, setImageOverrides] = useState({});

  useEffect(() => {
    api
      .getStorefrontImages()
      .then((data) => {
        if (data?.category_images) setImageOverrides(data.category_images);
      })
      .catch(() => {});
  }, []);

  const handleClick = (category) => {
    if (MODEL_SPECIFIC_CATEGORIES.includes(category)) {
      setFinderCategory(category);
    } else {
      navigate(`/shop?category=${encodeURIComponent(category)}`);
    }
  };

  return (
    <section className="home-section" data-section-strap={t('home.shopCollection')} id="home-collections">
      <div className="container">
        <div className="home-section-head home-type-head">
          <TypeLine
            as="span"
            className="eyebrow type-line--block"
            text={t('home.collectionsEyebrow')}
            staggerMs={22}
          />
          <TypeLine
            as="h2"
            className="section-title type-line--block"
            text={t('home.shopCollection')}
            staggerMs={30}
            delay={80}
          />
          <TypeLine
            as="p"
            className="section-subtitle type-line--block"
            text={t('home.shopCollectionSub')}
            staggerMs={14}
            delay={220}
          />
        </div>
        <div className="home-collection-grid">
          {HOME_COLLECTIONS.map((category, i) => (
            <ConnectReveal
              key={category}
              as="button"
              type="button"
              from="type"
              delay={140 + Math.min(i, 8) * 85}
              onClick={() => handleClick(category)}
              className="home-collection-card"
            >
              <img
                src={imageOverrides[category] || DEFAULT_IMAGES[category]}
                alt={category}
                loading="lazy"
              />
              <div className="home-collection-overlay">
                <strong>{category}</strong>
                <span>{t(COLLECTION_HINTS[category] || 'home.collectionDefault')}</span>
              </div>
            </ConnectReveal>
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
