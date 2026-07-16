import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { SHOP } from '../config/shop';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProductReviewCard({
  name,
  city,
  rating = 5,
  comment,
  verified = true,
  productId,
  productName,
  className = '',
  as: Tag = 'article',
  ...rest
}) {
  const { t } = useTranslation();
  const stars = Math.max(0, Math.min(5, Number(rating) || 0));
  const location = city || SHOP.city || 'Lahore';

  const inner = (
    <>
      <header className="review-card-header">
        <div className="review-card-avatar" aria-hidden="true">
          {initials(name)}
        </div>
        <div className="review-card-meta">
          <strong className="review-card-name">{name || 'Customer'}</strong>
          <span className="review-card-city">{location}</span>
        </div>
        {verified && (
          <span className="review-card-verified">{t('reviews.verifiedBuyer')}</span>
        )}
      </header>
      <div className="review-card-stars" aria-label={`${stars} stars`}>
        {'★'.repeat(stars)}
        {'☆'.repeat(5 - stars)}
      </div>
      <p className="review-card-text">&ldquo;{comment}&rdquo;</p>
      {productId && productName ? (
        <footer className="review-card-product">
          <Link to={`/shop/${productId}`} className="review-card-product-link">
            {productName}
          </Link>
        </footer>
      ) : null}
    </>
  );

  if (Tag === Link) {
    return (
      <Link className={`review-card ${className}`.trim()} {...rest}>
        {inner}
      </Link>
    );
  }

  return (
    <Tag className={`review-card ${className}`.trim()} {...rest}>
      {inner}
    </Tag>
  );
}
