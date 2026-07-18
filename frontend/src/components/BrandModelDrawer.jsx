import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  SHOP_BRAND_TO_REPAIR_BRAND,
  getModelsForShopBrand,
} from '../config/repairModels';
import { useTranslation } from '../context/LanguageContext';
import ModelThumb from './ModelThumb';

export default function BrandModelDrawer({ brand, open, onClose }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const repairBrand = brand ? SHOP_BRAND_TO_REPAIR_BRAND[brand.id] : null;
  const models = useMemo(() => {
    if (!brand) return [];
    const all = getModelsForShopBrand(brand.id);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((m) => m.toLowerCase().includes(q));
  }, [brand, query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open, brand?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined' || !open || !brand) return null;

  return createPortal(
    <>
      <div
        className="pc-drawer-scrim is-open"
        onClick={onClose}
        aria-hidden="false"
      />
      <aside
        className="pc-model-drawer is-open"
        role="dialog"
        aria-modal="true"
        aria-label={t('brandDrawer.title', { brand: brand.label })}
      >
        <div className="pc-model-drawer-handle" aria-hidden="true" />
        <div className="pc-model-drawer-head">
          <h2 className="pc-model-drawer-title">
            {t('brandDrawer.title', { brand: brand.label })}
          </h2>
          <button type="button" className="pc-model-drawer-close" onClick={onClose} aria-label={t('nav.closeMenu')}>
            ✕
          </button>
        </div>
        <label className="pc-model-drawer-search">
          <span className="sr-only">{t('brandDrawer.search')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('brandDrawer.searchPlaceholder')}
            autoComplete="off"
          />
        </label>
        <div className="pc-model-drawer-body">
          {models.length === 0 ? (
            <p className="section-subtitle" style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
              {t('brandDrawer.empty')}
            </p>
          ) : (
            <div className="pc-model-grid">
              {models.map((model) => (
                <Link
                  key={model}
                  to={`/shop?brand=${encodeURIComponent(brand.id)}&search=${encodeURIComponent(model)}`}
                  className="pc-model-item"
                  onClick={onClose}
                >
                  <ModelThumb brand={repairBrand} model={model} className="model-thumb" />
                  <span className="pc-model-item-name">{model}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="pc-model-drawer-foot">
          <Link
            to={`/shop?brand=${encodeURIComponent(brand.id)}`}
            className="btn btn-primary"
            onClick={onClose}
          >
            {t('nav.viewAllBrand', { brand: brand.label })}
          </Link>
          <Link
            to="/repair#supported-devices"
            className="btn btn-ghost"
            style={{ marginTop: '0.5rem' }}
            onClick={onClose}
          >
            {t('brandDrawer.repairCta')}
          </Link>
        </div>
      </aside>
    </>,
    document.body
  );
}
