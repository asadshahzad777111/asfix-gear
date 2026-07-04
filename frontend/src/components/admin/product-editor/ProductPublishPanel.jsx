import { Link } from 'react-router-dom';

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

export default function ProductPublishPanel({ status, onStatusChange, productId }) {
  const current = status || 'published';

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head">Publish</div>
      <div className="wp-postbox-body">
        <div className="form-group">
          <label htmlFor="product-status">Status</label>
          <select
            id="product-status"
            value={current}
            onChange={(e) => onStatusChange(e.target.value)}
            className="category-select"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {productId && current === 'published' ? (
          <p className="wp-product-hint">
            <Link to={`/shop/${productId}`} target="_blank" rel="noreferrer">
              View product
            </Link>
          </p>
        ) : productId && current === 'draft' ? (
          <p className="wp-product-hint wp-product-hint--muted">
            Draft products are hidden from the public shop.
          </p>
        ) : (
          <p className="wp-product-hint">
            Click <strong>Save Changes</strong> to save this product.
          </p>
        )}
      </div>
    </div>
  );
}
