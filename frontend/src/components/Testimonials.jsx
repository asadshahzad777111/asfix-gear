import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';

const FALLBACK = [
  { name: 'Ahmed K.', text: 'testimonials.r1', stars: 5 },
  { name: 'Fatima R.', text: 'testimonials.r2', stars: 5 },
  { name: 'Usman M.', text: 'testimonials.r3', stars: 5 },
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
        live: true,
      }))
    : FALLBACK.map((r) => ({ ...r, key: r.name, live: false, text: t(r.text) }));

  return (
    <div className="testimonials-grid">
      {items.map((r) => (
        <article key={r.key} className="testimonial-card">
          <div className="testimonial-stars" aria-label={`${r.stars} stars`}>
            {'★'.repeat(r.stars)}
          </div>
          <p>"{r.text}"</p>
          <footer>— {r.name}</footer>
        </article>
      ))}
    </div>
  );
}
