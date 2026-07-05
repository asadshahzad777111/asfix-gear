import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { getDefaultImage } from '../config/products';

const FALLBACK = [
  { name: 'Ahmed K.', text: 'testimonials.r1', stars: 5 },
  { name: 'Fatima R.', text: 'testimonials.r2', stars: 5 },
  { name: 'Usman M.', text: 'testimonials.r3', stars: 5 },
];

function ReviewProductChip({ product, t }) {
  if (!product?.product_id) return null;

  const imageSrc = product.product_image || getDefaultImage(product.product_category || 'Cases');
  const label = product.product_name || t('reviews.viewProduct');

  return (
    <Link
      to={`/shop/${product.product_id}`}
      className="testimonial-product"
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={imageSrc}
        alt=""
        className="testimonial-product-img"
        loading="lazy"
        onError={(e) => {
          e.target.src = getDefaultImage(product.product_category || 'Cases');
        }}
      />
      <span className="testimonial-product-name">{label}</span>
      <span className="testimonial-product-arrow" aria-hidden="true">→</span>
    </Link>
  );
}

function TestimonialCard({ item, t }) {
  const content = (
    <>
      <div className="testimonial-stars" aria-label={`${item.stars} stars`}>
        {'★'.repeat(item.stars)}
      </div>
      <p>"{item.text}"</p>
      <footer>— {item.name}</footer>
      {item.live && item.product_id ? (
        <ReviewProductChip product={item} t={t} />
      ) : null}
    </>
  );

  if (item.live && item.product_id) {
    return (
      <Link
        to={`/shop/${item.product_id}`}
        className="testimonial-card testimonial-card--linked"
        aria-label={`${item.name}: ${t('reviews.viewProduct')} — ${item.product_name || ''}`}
      >
        {content}
      </Link>
    );
  }

  return <article className="testimonial-card">{content}</article>;
}

export default function Testimonials() {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getPublishedReviews()
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setReviews(data);
        }
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = reviews?.length
    ? reviews.map((r) => ({
        key: r.order_ref || r.order_id,
        name: r.customer_name,
        text: r.comment || t('feedback.thanks'),
        stars: r.rating,
        live: true,
        product_id: r.product_id,
        product_name: r.product_name,
        product_image: r.product_image,
        product_category: r.product_category,
      }))
    : FALLBACK.map((r) => ({ ...r, key: r.name, live: false, text: t(r.text) }));

  return (
    <div className="testimonials-grid">
      {items.map((r) => (
        <TestimonialCard key={r.key} item={r} t={t} />
      ))}
    </div>
  );
}
