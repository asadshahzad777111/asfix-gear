import { DISCOUNT_PRESETS, getSalePrice, hasDiscount } from '../utils/pricing';
import { formatPrice } from '../api/client';

export default function DiscountPicker({ enabled, percent, onToggle, onChange, onApply, price }) {
  const salePrice = price ? getSalePrice({ price: Number(price), discount_percent: percent }) : 0;

  return (
    <div className={`discount-picker ${enabled ? 'is-active' : ''}`}>
      <button
        type="button"
        className={`discount-toggle ${enabled ? 'on' : ''}`}
        onClick={() => onToggle(!enabled)}
      >
        <span className="discount-toggle-icon">🏷️</span>
        <span className="discount-toggle-text">
          <strong>{enabled ? 'Discount ON' : 'Discount Lagayein?'}</strong>
          <small>Kisi bhi product par sale laga sakte hain</small>
        </span>
        <span className={`discount-toggle-switch ${enabled ? 'on' : ''}`}>
          <span className="discount-toggle-knob" />
        </span>
      </button>

      {enabled && (
        <div className="discount-picker-body">
          <p className="discount-picker-label">Discount % choose karein</p>
          <div className="discount-presets">
            {DISCOUNT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`discount-preset ${Number(percent) === p ? 'active' : ''}`}
                onClick={() => {
                  onChange(p);
                  onApply?.(p);
                }}
              >
                {p}%
              </button>
            ))}
          </div>
          <div className="discount-custom">
            <label>Custom %</label>
            <div className="discount-custom-row">
              <div className="discount-custom-input">
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={percent || ''}
                  onChange={(e) => onChange(Math.min(90, Math.max(0, Number(e.target.value) || 0)))}
                  placeholder="0"
                />
                <span>% OFF</span>
              </div>
              {onApply && (
                <button type="button" className="btn-discount-apply" onClick={onApply}>
                  Apply
                </button>
              )}
            </div>
          </div>
          {price > 0 && percent > 0 && (
            <div className="discount-preview-box">
              <span className="discount-preview-old">{formatPrice(Number(price))}</span>
              <span className="discount-preview-arrow">→</span>
              <span className="discount-preview-new">{formatPrice(salePrice)}</span>
              <span className="discount-preview-badge">-{percent}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DiscountRibbon({ percent, compact = false }) {
  if (!percent || percent <= 0) return null;
  return (
    <div className={`discount-ribbon ${compact ? 'discount-ribbon--compact' : ''}`}>
      <span>SALE</span>
      <strong>{percent}% OFF</strong>
    </div>
  );
}

export function ProductPrice({ product, size = 'md' }) {
  if (!hasDiscount(product)) {
    return <span className={`price-single price-${size}`}>{formatPrice(product.price)}</span>;
  }

  return (
    <div className={`price-discount-wrap price-${size}`}>
      <span className="price-original">{formatPrice(product.price)}</span>
      <div className="price-sale-line">
        <span className="price-sale">{formatPrice(getSalePrice(product))}</span>
        <span className="price-off-tag">-{product.discount_percent}%</span>
      </div>
    </div>
  );
}
