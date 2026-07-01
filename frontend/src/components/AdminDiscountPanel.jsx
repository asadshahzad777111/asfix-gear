import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DiscountPicker from './DiscountPicker';
import { hasDiscount } from '../utils/pricing';

export default function AdminDiscountPanel({ product, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(hasDiscount(product));
  const [percent, setPercent] = useState(product.discount_percent || 0);

  useEffect(() => {
    setEnabled(hasDiscount(product));
    setPercent(product.discount_percent || 0);
  }, [product.id, product.discount_percent]);

  const save = async (newEnabled, newPercent) => {
    const prevEnabled = enabled;
    const prevPercent = percent;
    setSaving(true);
    try {
      const discount = newEnabled ? newPercent : 0;
      const updated = await api.setProductDiscount(product.id, discount);
      onUpdated(updated);
    } catch (err) {
      setEnabled(prevEnabled);
      setPercent(prevPercent);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (on) => {
    setEnabled(on);
    if (!on) {
      setPercent(0);
      await save(false, 0);
    }
  };

  const handleChange = (pct) => {
    setPercent(pct);
    setEnabled(true);
  };

  const applyDiscount = (pct) => save(true, pct ?? percent);

  return (
    <div className="admin-discount-wrap">
      <button
        type="button"
        className={`btn-discount-admin ${hasDiscount(product) ? 'has-sale' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        🏷️ {hasDiscount(product) ? `${product.discount_percent}% OFF` : 'Discount'}
      </button>

      {open && (
        <div className="admin-discount-panel">
          <DiscountPicker
            enabled={enabled}
            percent={percent}
            price={product.price}
            onToggle={handleToggle}
            onChange={handleChange}
            onApply={applyDiscount}
          />
          {saving && <p className="field-hint">Saving...</p>}
        </div>
      )}
    </div>
  );
}
