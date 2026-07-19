import { useState } from 'react';
import { SHOP_BRANDS } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import SearchBrandIcon from '../nav/SearchBrandIcon';
import BrandModelDrawer from '../BrandModelDrawer';
import ConnectReveal from '../motion/ConnectReveal';
import TypeLine from '../motion/TypeLine';

export default function BrandGrid() {
  const { t } = useTranslation();
  const [activeBrand, setActiveBrand] = useState(null);

  return (
    <section className="home-section" data-section-strap={t('home.selectBrand')} id="home-brands">
      <div className="container">
        <div className="home-section-head home-type-head">
          <TypeLine
            as="span"
            className="eyebrow type-line--block"
            text={t('home.brandsEyebrow')}
            staggerMs={18}
          />
          <TypeLine
            as="h2"
            className="section-title type-line--block"
            text={t('home.selectBrand')}
            staggerMs={24}
            delay={60}
          />
          <TypeLine
            as="p"
            className="section-subtitle type-line--block"
            text={t('home.selectBrandSub')}
            mode="words"
            staggerMs={36}
            delay={160}
          />
        </div>
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
