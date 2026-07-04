import { useState } from 'react';
import { SHOP_BRANDS } from '../../../config/products';
import ModelMultiPicker from '../../ModelMultiPicker';

const CUSTOM_VALUE = '__custom__';

export default function ProductBrandPanel({ brand, compatibleModels, onBrandChange, onCompatibleModelsChange }) {
  const knownIds = new Set(SHOP_BRANDS.map((b) => b.id));
  const isCustom = brand && !knownIds.has(brand);
  const selectValue = isCustom ? CUSTOM_VALUE : brand || '';

  const [customBrand, setCustomBrand] = useState(isCustom ? brand : '');

  const handleSelect = (value) => {
    if (value === CUSTOM_VALUE) {
      onBrandChange(customBrand.trim());
      return;
    }
    onBrandChange(value);
    if (value !== brand) setCustomBrand('');
  };

  const handleCustomChange = (value) => {
    setCustomBrand(value);
    onBrandChange(value.trim());
  };

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head">Brand &amp; compatibility</div>
      <div className="wp-postbox-body">
        <div className="form-group">
          <label htmlFor="product-brand">Device / brand (OEM)</label>
          <select
            id="product-brand"
            value={selectValue}
            onChange={(e) => handleSelect(e.target.value)}
            className="category-select"
          >
            <option value="">Universal / not brand-specific</option>
            {SHOP_BRANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.icon} {b.label}
              </option>
            ))}
            <option value={CUSTOM_VALUE}>Other brand (custom)…</option>
          </select>
          <p className="wp-product-hint">
            Phone OEM brands (iPhone, Samsung, etc.) — used for shop filters. Not the accessory manufacturer.
          </p>
        </div>

        {selectValue === CUSTOM_VALUE && (
          <div className="form-group">
            <label htmlFor="product-brand-custom">Custom brand name</label>
            <input
              id="product-brand-custom"
              type="text"
              value={customBrand}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="e.g. Anker, Baseus, Spigen"
            />
          </div>
        )}

        <div className="form-group">
          <label>Compatible model(s)</label>
          <ModelMultiPicker
            brand={knownIds.has(brand) ? brand : ''}
            value={compatibleModels}
            onChange={onCompatibleModelsChange}
          />
        </div>
      </div>
    </div>
  );
}
