import { Link } from 'react-router-dom';
import { SHOP_BRANDS } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';

export default function BrandGrid() {
  const { t } = useTranslation();

  return (
    <section className="home-section">
      <div className="container">
        <div className="home-section-head">
          <span className="eyebrow">{t('home.brandsEyebrow')}</span>
          <h2 className="section-title">{t('home.selectBrand')}</h2>
          <p className="section-subtitle">{t('home.selectBrandSub')}</p>
        </div>
        <div className="home-brand-grid">
          {SHOP_BRANDS.map((brand) => (
            <Link
              key={brand.id}
              to={`/shop?search=${encodeURIComponent(brand.search)}`}
              className="home-brand-card"
            >
              <span className="home-brand-icon" aria-hidden="true">{brand.icon}</span>
              <span className="home-brand-label">{brand.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
