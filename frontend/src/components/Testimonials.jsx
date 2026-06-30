import { useTranslation } from '../context/LanguageContext';

const REVIEW_KEYS = [
  { name: 'Ahmed K.', text: 'testimonials.r1', stars: 5 },
  { name: 'Fatima R.', text: 'testimonials.r2', stars: 5 },
  { name: 'Usman M.', text: 'testimonials.r3', stars: 5 },
];

export default function Testimonials() {
  const { t } = useTranslation();

  return (
    <div className="testimonials-grid">
      {REVIEW_KEYS.map((r) => (
        <article key={r.name} className="testimonial-card">
          <div className="testimonial-stars">
            {'★'.repeat(r.stars)}
          </div>
          <p>"{t(r.text)}"</p>
          <footer>— {r.name}</footer>
        </article>
      ))}
    </div>
  );
}
