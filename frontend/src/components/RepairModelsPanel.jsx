import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { REPAIR_DEVICE_BRANDS, generalRepairQuoteContactPath } from '../config/repairModels';
import { useTranslation } from '../context/LanguageContext';
import SearchBrandIcon from './nav/SearchBrandIcon';
import { getShopBrandIdFromRepairBrand } from '../utils/brandIcon';

/**
 * PhoneCase-style repair picker:
 * 1) Search / select company
 * 2) Then pick model by name only (no phone photos)
 */
export default function RepairModelsPanel() {
  const { t } = useTranslation();
  const [brandQuery, setBrandQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [modelQuery, setModelQuery] = useState('');

  const brands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return REPAIR_DEVICE_BRANDS;
    return REPAIR_DEVICE_BRANDS.filter((g) => g.brand.toLowerCase().includes(q));
  }, [brandQuery]);

  const models = useMemo(() => {
    if (!selectedBrand) return [];
    const all = selectedBrand.series.flatMap((s) => s.models);
    const q = modelQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((m) => m.toLowerCase().includes(q));
  }, [selectedBrand, modelQuery]);

  const clearBrand = () => {
    setSelectedBrand(null);
    setModelQuery('');
  };

  return (
    <div className="repair-models-panel repair-models-panel--pc">
      <div className="repair-models-head">
        <span className="eyebrow">{t('repair.modelsEyebrow')}</span>
        <h3>{t('repair.modelsHead')}</h3>
        <p>{t('repair.modelsDesc')}</p>
      </div>

      {!selectedBrand ? (
        <>
          <label className="repair-pc-search">
            <span className="sr-only">{t('repair.searchCompany')}</span>
            <input
              type="search"
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder={t('repair.searchCompanyPh')}
              autoComplete="off"
            />
          </label>
          <div className="repair-pc-brand-list">
            {brands.map((group) => (
              <button
                key={group.brand}
                type="button"
                className="repair-pc-brand-row"
                onClick={() => {
                  setSelectedBrand(group);
                  setModelQuery('');
                }}
              >
                <SearchBrandIcon brandId={getShopBrandIdFromRepairBrand(group.brand)} />
                <span className="repair-pc-brand-name">{group.brand}</span>
                <span className="repair-pc-brand-meta">
                  {group.series.flatMap((s) => s.models).length} {t('repair.modelsCount')}
                </span>
                <span className="repair-pc-brand-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
            {brands.length === 0 && (
              <p className="repair-pc-empty">{t('repair.noCompanyMatch')}</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="repair-pc-selected-bar">
            <button type="button" className="repair-pc-back" onClick={clearBrand}>
              ← {t('repair.changeCompany')}
            </button>
            <strong>{selectedBrand.brand}</strong>
          </div>
          <label className="repair-pc-search">
            <span className="sr-only">{t('repair.searchModel')}</span>
            <input
              type="search"
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              placeholder={t('repair.searchModelPh')}
              autoComplete="off"
            />
          </label>
          <div className="repair-pc-model-chips">
            {models.map((model) => (
              <Link
                key={model}
                to={generalRepairQuoteContactPath(`${selectedBrand.brand} ${model}`)}
                className="repair-pc-model-chip"
              >
                {model}
              </Link>
            ))}
            {models.length === 0 && (
              <p className="repair-pc-empty">{t('repair.noModelMatch')}</p>
            )}
          </div>
        </>
      )}

      <Link to={generalRepairQuoteContactPath()} className="btn btn-whatsapp btn-block">
        {t('repair.modelsWhatsApp')}
      </Link>
    </div>
  );
}
