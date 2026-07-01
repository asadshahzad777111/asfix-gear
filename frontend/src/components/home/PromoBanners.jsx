import { Link } from 'react-router-dom';
import { ProductPrice } from '../DiscountPicker';
import { getDefaultImage } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';

export default function PromoBanners({ products = [] }) {
  const { t } = useTranslation();

  if (products.length === 0) return null;

  return (
    <section className="home-section">
      <div className="container">
        <div className="home-section-head">
          <span className="eyebrow">{t('home.promoEyebrow')}</span>
          <h2 className="section-title">{t('home.promoTitle')}</h2>
        </div>
        <div className="home-promo-row">
          {products.slice(0, 2).map((product) => (
            <Link
              key={product.id}
              to={`/shop/${product.id}`}
              className="home-promo-banner on-sale"
            >
              <img
                src={product.image}
                alt={product.name}
                className="home-promo-img"
                loading="lazy"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = getDefaultImage(product.category);
                }}
              />
              <div className="home-promo-body">
                <span className="home-promo-tag">
                  {t('home.promoSave', { percent: product.discount_percent })}
                </span>
                <h3>{product.name}</h3>
                <ProductPrice product={product} size="sm" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
