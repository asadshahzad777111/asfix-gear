import { useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';

const RATINGS = [1, 2, 3, 4, 5];

export default function OrderFeedbackForm({ orderId, phone, existing, onSubmitted }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(Boolean(existing?.rating));

  if (done && existing?.rating) {
    return (
      <div className="order-feedback order-feedback--done glass-card">
        <p className="order-feedback-thanks">{t('feedback.thanks')}</p>
        <div className="order-feedback-stars" aria-label={t('feedback.yourRating')}>
          {RATINGS.map((n) => (
            <span key={n} className={n <= existing.rating ? 'on' : ''} aria-hidden="true">★</span>
          ))}
        </div>
        {existing.comment ? <p className="order-feedback-comment">{existing.comment}</p> : null}
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('feedback.ratingRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await api.submitOrderFeedback(orderId, {
        phone,
        rating,
        comment: comment.trim(),
      });
      setDone(true);
      onSubmitted?.(data.feedback);
    } catch (err) {
      setError(err.message || t('feedback.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="order-feedback glass-card" onSubmit={handleSubmit}>
      <h3>{t('feedback.title')}</h3>
      <p className="order-feedback-prompt">{t('feedback.prompt')}</p>

      <div className="order-feedback-stars" role="radiogroup" aria-label={t('feedback.ratingLabel')}>
        {RATINGS.map((n) => (
          <button
            key={n}
            type="button"
            className={`order-feedback-star ${n <= rating ? 'on' : ''}`}
            onClick={() => setRating(n)}
            aria-checked={rating === n}
            role="radio"
            aria-label={`${n} ${t('feedback.stars')}`}
          >
            ★
          </button>
        ))}
      </div>

      <div className="form-group">
        <label htmlFor="feedback-comment">{t('feedback.commentOptional')}</label>
        <textarea
          id="feedback-comment"
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('feedback.commentPlaceholder')}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
        {submitting ? t('common.saving') : t('feedback.submit')}
      </button>
    </form>
  );
}
