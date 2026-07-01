import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SHOP_BRANDS } from '../config/products';
import { getSeriesForShopBrand } from '../config/repairModels';
import { useTranslation } from '../context/LanguageContext';
import useModalBehavior from '../hooks/useModalBehavior';

/**
 * Guided "which company? → which model?" picker for model-specific
 * accessories (cases, back covers, screen guards). Opened instead of
 * navigating straight to the shop listing when a customer taps one of
 * these categories, so they land on accessories that actually fit their
 * phone instead of scrolling through every brand's inventory.
 */
export default function PhoneFinderModal({ open, category, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [brand, setBrand] = useState(null);

  useModalBehavior(open, onClose);

  if (!open) return null;

  const series = brand ? getSeriesForShopBrand(brand.id) : [];

  const goToShop = (params) => {
    const search = new URLSearchParams({ category, ...params });
    navigate(`/shop?${search.toString()}`);
    onClose();
  };

  const handleClose = () => {
    setBrand(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose} role="presentation">
      <div
        className="modal-panel phone-finder-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('phoneFinder.title', { category })}
      >
        <button type="button" className="modal-close" onClick={handleClose} aria-label={t('common.close')}>
          ✕
        </button>

        {!brand ? (
          <PhoneFinderBrandStep
            category={category}
            onSelectBrand={setBrand}
            onSkip={() => goToShop({})}
            t={t}
          />
        ) : (
          <PhoneFinderModelStep
            brand={brand}
            series={series}
            onBack={() => setBrand(null)}
            onSelectModel={(model) => goToShop({ brand: brand.id, search: model })}
            onViewAllBrand={() => goToShop({ brand: brand.id })}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function PhoneFinderBrandStep({ category, onSelectBrand, onSkip, t }) {
  return (
    <div className="phone-finder-step">
      <p className="phone-finder-eyebrow">{t('phoneFinder.eyebrow', { category })}</p>
      <h2 className="phone-finder-title">{t('phoneFinder.brandQuestion')}</h2>
      <p className="phone-finder-sub">{t('phoneFinder.brandSub')}</p>

      <div className="phone-finder-brand-grid">
        {SHOP_BRANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className="phone-finder-brand-btn"
            onClick={() => onSelectBrand(b)}
          >
            <span className="phone-finder-brand-icon" aria-hidden="true">{b.icon}</span>
            <span>{b.label}</span>
          </button>
        ))}
      </div>

      <button type="button" className="phone-finder-skip" onClick={onSkip}>
        {t('phoneFinder.skip')}
      </button>
    </div>
  );
}

function PhoneFinderModelStep({ brand, series, onBack, onSelectModel, onViewAllBrand, t }) {
  const [query, setQuery] = useState('');

  const filteredSeries = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return series;
    return series
      .map((s) => ({ ...s, models: s.models.filter((m) => m.toLowerCase().includes(term)) }))
      .filter((s) => s.models.length > 0);
  }, [series, query]);

  return (
    <div className="phone-finder-step">
      <button type="button" className="phone-finder-back" onClick={onBack}>
        ← {t('phoneFinder.changeBrand')}
      </button>

      <p className="phone-finder-eyebrow">
        {brand.icon} {brand.label}
      </p>
      <h2 className="phone-finder-title">{t('phoneFinder.modelQuestion')}</h2>

      <input
        type="search"
        className="phone-finder-model-search"
        placeholder={t('phoneFinder.modelSearchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <div className="phone-finder-model-scroll">
        {filteredSeries.length === 0 ? (
          <p className="phone-finder-no-match">{t('phoneFinder.noModelMatch')}</p>
        ) : (
          filteredSeries.map((s) => (
            <div key={s.name} className="phone-finder-series">
              <p className="phone-finder-series-name">{s.name}</p>
              <div className="phone-finder-model-chips">
                {s.models.map((model) => (
                  <button
                    key={model}
                    type="button"
                    className="phone-finder-model-chip"
                    onClick={() => onSelectModel(model)}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <button type="button" className="phone-finder-skip" onClick={onViewAllBrand}>
        {t('phoneFinder.viewAllBrand', { brand: brand.label })}
      </button>
    </div>
  );
}
