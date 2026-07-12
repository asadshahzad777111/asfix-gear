import { slugify, productPermalinkPreview } from '../../../utils/slug';

export default function ProductPermalinkPanel({ slug, name, productId, onSlugChange, onSlugTouched }) {
  const preview = productPermalinkPreview(slug || slugify(name), productId);

  return (
    <div className="wp-postbox wp-product-permalink">
      <div className="wp-postbox-head">Permalink</div>
      <div className="wp-postbox-body">
        <p className="wp-product-permalink-preview">
          <span className="wp-product-permalink-base">/shop/p/</span>
          <span className="wp-product-permalink-slug">{slugify(slug || name) || 'your-product-slug'}</span>
        </p>
        <p className="wp-product-hint wp-product-hint--muted">
          Pretty URL: {preview}. Numeric URL still works: {productId ? `/shop/${productId}` : 'save product first'}.
        </p>
        <label htmlFor="product-slug" className="wp-product-permalink-label">
          URL slug
        </label>
        <input
          id="product-slug"
          type="text"
          className="wp-product-permalink-input"
          value={slug}
          onChange={(e) => {
            onSlugTouched?.();
            onSlugChange(slugify(e.target.value));
          }}
          placeholder={slugify(name) || 'auto-from-name'}
          spellCheck={false}
          autoComplete="off"
        />
        <p className="wp-product-hint">
          Preview: <code>{preview}</code>
        </p>
      </div>
    </div>
  );
}
