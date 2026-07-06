import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { getDefaultImage } from '../config/products';
import useScrollIntoView from '../hooks/useScrollIntoView';

const RATINGS = [1, 2, 3, 4, 5];

function orderProducts(items = []) {
  const seen = new Set();
  return items
    .filter((item) => {
      const id = Number(item.product_id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((item) => ({
      product_id: Number(item.product_id),
      name: item.name || `Product #${item.product_id}`,
      image: item.image || null,
      category: item.category || null,
    }));
}

function FeedbackDone({ rating, comment, productId, orderItems, t, scrollOnMount = false }) {
  const products = useMemo(() => orderProducts(orderItems), [orderItems]);
  const product = products.find((p) => p.product_id === productId) || products[0];
  const panelRef = useScrollIntoView(scrollOnMount);

  return (
    <div ref={panelRef} className="order-success-panel glass-card order-feedback order-feedback--done">
      <div className="order-success-icon-ring">
        <span className="order-success-icon">★</span>
      </div>
      <h3 className="order-feedback-thanks">{t('feedback.submittedTitle')}</h3>
      <p className="order-success-subtitle">{t('feedback.thanks')}</p>
      <p className="order-success-hint order-feedback-pending">{t('feedback.pendingNote')}</p>
      {product ? (
        <Link to={`/shop/${product.product_id}`} className="order-feedback-product">
          <img
            src={product.image || getDefaultImage(product.category || 'Cases')}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.target.src = getDefaultImage(product.category || 'Cases');
            }}
          />
          <span>{t('feedback.reviewedProduct', { name: product.name })}</span>
        </Link>
      ) : null}
      <div className="order-feedback-stars" aria-label={t('feedback.yourRating')}>
        {RATINGS.map((n) => (
          <span key={n} className={n <= rating ? 'on' : ''} aria-hidden="true">★</span>
        ))}
      </div>
      {comment ? <p className="order-feedback-comment">{comment}</p> : null}
    </div>
  );
}

function ProductPicker({ products, selectedId, onSelect, t }) {
  if (products.length <= 1) {
    const product = products[0];
    if (!product) return null;
    return (
      <div className="order-feedback-product order-feedback-product--static">
        <img
          src={product.image || getDefaultImage(product.category || 'Cases')}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.target.src = getDefaultImage(product.category || 'Cases');
          }}
        />
        <span>{t('feedback.reviewingProduct', { name: product.name })}</span>
      </div>
    );
  }

  return (
    <fieldset className="order-feedback-product-pick">
      <legend>{t('feedback.whichProduct')}</legend>
      <div className="order-feedback-product-options">
        {products.map((product) => (
          <label
            key={product.product_id}
            className={`order-feedback-product-option ${selectedId === product.product_id ? 'on' : ''}`}
          >
            <input
              type="radio"
              name="feedback-product"
              value={product.product_id}
              checked={selectedId === product.product_id}
              onChange={() => onSelect(product.product_id)}
            />
            <img
              src={product.image || getDefaultImage(product.category || 'Cases')}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.target.src = getDefaultImage(product.category || 'Cases');
              }}
            />
            <span>{product.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function OrderFeedbackForm({ orderId, phone, orderItems = [], existing, onSubmitted }) {
  const { t } = useTranslation();
  const products = useMemo(() => orderProducts(orderItems), [orderItems]);
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [productId, setProductId] = useState(
    existing?.product_id || products[0]?.product_id || null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);

  if (existing?.rating && !submitted) {
    return (
      <FeedbackDone
        rating={existing.rating}
        comment={existing.comment}
        productId={existing.product_id || products[0]?.product_id}
        orderItems={orderItems}
        t={t}
      />
    );
  }

  if (submitted?.rating) {
    return (
      <FeedbackDone
        rating={submitted.rating}
        comment={submitted.comment}
        productId={submitted.product_id || productId}
        orderItems={orderItems}
        t={t}
        scrollOnMount
      />
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('feedback.ratingRequired'));
      return;
    }
    if (products.length > 1 && !productId) {
      setError(t('feedback.productRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await api.submitOrderFeedback(orderId, {
        phone,
        rating,
        comment: comment.trim(),
        product_id: productId || products[0]?.product_id || undefined,
      });
      setSubmitted(data.feedback);
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

      {products.length > 0 ? (
        <ProductPicker
          products={products}
          selectedId={productId}
          onSelect={setProductId}
          t={t}
        />
      ) : null}

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
