import { Link } from 'react-router-dom';

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

export default function ProductPublishPanel({
  status,
  onStatusChange,
  productId,
  onSaveDraft,
  onPublish,
  submitting = false,
  disabled = false,
}) {
  const current = status || 'published';
  const busy = submitting || disabled;
  const previewUrl = productId ? `/shop/${productId}` : null;

  return (
    <div className="wp-postbox wp-product-publish">
      <div className="wp-postbox-head">Publish</div>
      <div className="wp-postbox-body">
        <div className="form-group">
          <label htmlFor="product-status">Status</label>
          <select
            id="product-status"
            value={current}
            onChange={(e) => onStatusChange(e.target.value)}
            className="category-select"
            disabled={busy}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {current === 'draft' && (
          <p className="wp-product-hint wp-product-hint--muted">
            Draft products are hidden from the public shop.
          </p>
        )}

        <div className="wp-product-publish-actions">
          <button
            type="button"
            className="wp-button wp-button--secondary"
            disabled={busy}
            onClick={onSaveDraft}
          >
            {submitting && current === 'draft' ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            type="button"
            className="wp-button wp-button--primary"
            disabled={busy}
            onClick={onPublish}
          >
            {submitting && current === 'published' ? 'Publishing…' : 'Publish'}
          </button>
        </div>

        {previewUrl ? (
          <p className="wp-product-hint">
            {current === 'published' ? (
              <>
                <Link to={previewUrl} target="_blank" rel="noreferrer">
                  Preview product
                </Link>
                {' — visible on the shop.'}
              </>
            ) : (
              <>
                <Link to={previewUrl} target="_blank" rel="noreferrer">
                  Preview product
                </Link>
                {' — draft: only staff with the link can view if logged in; hidden from shop listing.'}
              </>
            )}
          </p>
        ) : (
          <p className="wp-product-hint">Save once to enable preview link.</p>
        )}
      </div>
    </div>
  );
}
