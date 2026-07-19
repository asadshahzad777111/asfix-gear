import { useState } from 'react';
import { SHOP_BRANDS } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import SearchBrandIcon from '../nav/SearchBrandIcon';
import BrandModelDrawer from '../BrandModelDrawer';
import ConnectReveal from '../motion/ConnectReveal';

export default function BrandGrid() {
  const { t } = useTranslation();
  const [activeBrand, setActiveBrand] = useState(null);

  return (
    <section className="home-section" data-section-strap={t('home.selectBrand')} id="home-brands">
      <div className="container">
        <ConnectReveal className="home-section-head" from="line">
          <span className="eyebrow">{t('home.brandsEyebrow')}</span>
          <h2 className="section-title">{t('home.selectBrand')}</h2>
          <p className="section-subtitle">{t('home.selectBrandSub')}</p>
        </ConnectReveal>
        <div className="home-brand-grid home-brand-grid--pc">
          {SHOP_BRANDS.map((brand, i) => (
            <ConnectReveal
              key={brand.id}
              as="button"
              type="button"
              from={i % 2 === 0 ? 'left' : 'right'}
              delay={Math.min(i, 8) * 55}
              className="home-brand-card home-brand-card--pc"
              onClick={() => setActiveBrand(brand)}
            >
              <span className="home-brand-icon" aria-hidden="true">
                <SearchBrandIcon brandId={brand.id} />
              </span>
              <span className="home-brand-label">{brand.label}</span>
            </ConnectReveal>
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
