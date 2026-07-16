import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { SHOP } from '../config/shop';
import ProductReviewCard from './ProductReviewCard';

const FALLBACK = [
  { name: 'Ahmed K.', text: 'testimonials.r1', stars: 5, city: 'Lahore' },
  { name: 'Fatima R.', text: 'testimonials.r2', stars: 5, city: 'Lahore' },
  { name: 'Usman M.', text: 'testimonials.r3', stars: 5, city: 'Lahore' },
];

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
        city: r.city || SHOP.city,
        live: true,
        product_id: r.product_id,
        product_name: r.product_name,
      }))
    : FALLBACK.map((r) => ({
        ...r,
        key: r.name,
        live: false,
        text: t(r.text),
      }));

  return (
    <div className="testimonials-grid">
      {items.map((r) => (
        <ProductReviewCard
          key={r.key}
          as={r.live && r.product_id ? 'article' : 'article'}
          name={r.name}
          city={r.city}
          rating={r.stars}
          comment={r.text}
          verified={r.live}
          productId={r.product_id}
          productName={r.product_name}
        />
      ))}
    </div>
  );
}
