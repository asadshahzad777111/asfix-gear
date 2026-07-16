import { useState } from 'react';
import { SHOP_BRANDS } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import SearchBrandIcon from '../nav/SearchBrandIcon';
import BrandModelDrawer from '../BrandModelDrawer';

export default function BrandGrid() {
  const { t } = useTranslation();
  const [activeBrand, setActiveBrand] = useState(null);

  return (
    <section className="home-section">
      <div className="container">
        <div className="home-section-head">
          <span className="eyebrow">{t('home.brandsEyebrow')}</span>
          <h2 className="section-title">{t('home.selectBrand')}</h2>
          <p className="section-subtitle">{t('home.selectBrandSub')}</p>
        </div>
        <div className="home-brand-grid home-brand-grid--pc">
          {SHOP_BRANDS.map((brand) => (
            <button
              key={brand.id}
              type="button"
              className="home-brand-card home-brand-card--pc"
              onClick={() => setActiveBrand(brand)}
            >
              <span className="home-brand-icon" aria-hidden="true">
                <SearchBrandIcon brandId={brand.id} />
              </span>
              <span className="home-brand-label">{brand.label}</span>
            </button>
          ))}
        </div>
      </div>

      <BrandModelDrawer
        brand={activeBrand}
        open={Boolean(activeBrand)}
        onClose={() => setActiveBrand(null)}
      />
    </section>
  );
}
