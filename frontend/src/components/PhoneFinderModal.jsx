import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { SHOP_BRANDS } from '../config/products';
import { getSeriesForShopBrand, SHOP_BRAND_TO_REPAIR_BRAND } from '../config/repairModels';
import { useTranslation } from '../context/LanguageContext';
import useModalBehavior from '../hooks/useModalBehavior';
import SearchBrandIcon from './nav/SearchBrandIcon';
import ModelThumb from './ModelThumb';

/**
 * Guided "which company? → which model?" picker for model-specific
 * accessories (cases, back covers, screen guards). Opened instead of
 * navigating straight to the shop listing when a customer taps one of
 * these categories, so they land on accessories that actually fit their
 * phone instead of scrolling through every brand's inventory.
 */
export default function PhoneFinderModal({ open, category, onClose, onNavigate }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [brand, setBrand] = useState(null);
  const panelRef = useRef(null);
  const brandGridRef = useRef(null);
  const overlayRef = useRef(null);

  const { closeWithoutHistoryBack } = useModalBehavior(open, onClose);

  useEffect(() => {
    if (!open) {
      setBrand(null);
      return;
    }
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const grid = brandGridRef.current;
    if (overlay) overlay.scrollTop = 0;
    if (panel) panel.scrollTop = 0;
    if (grid) grid.scrollTop = 0;
  }, [open, category]);

  if (!open) return null;

  const series = brand ? getSeriesForShopBrand(brand.id) : [];

  const goToShop = (params) => {
    const search = new URLSearchParams({ category, ...params });
    // Tell the modal-behavior hook we're navigating away, not just closing
    // in place — otherwise its cleanup calls history.back() and cancels
    // this very navigation, bouncing the user back to where they started.
    closeWithoutHistoryBack();
    navigate(`/shop?${search.toString()}`);
    onNavigate?.();
    onClose();
  };

  const handleClose = () => {
    setBrand(null);
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay modal-overlay--phone-finder"
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={panelRef}
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
            brandGridRef={brandGridRef}
            t={t}
          />
        ) : (
          <PhoneFinderModelStep
            key={brand.id}
            brand={brand}
            series={series}
            onBack={() => setBrand(null)}
            onSelectModel={(model) => goToShop({ brand: brand.id, search: model })}
            onViewAllBrand={() => goToShop({ brand: brand.id })}
            t={t}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

function PhoneFinderBrandStep({ category, onSelectBrand, onSkip, t, brandGridRef }) {
  return (
    <div className="phone-finder-step">
      <p className="phone-finder-eyebrow">{t('phoneFinder.eyebrow', { category })}</p>
      <h2 className="phone-finder-title">{t('phoneFinder.brandQuestion')}</h2>
      <p className="phone-finder-sub">{t('phoneFinder.brandSub')}</p>

      <div className="phone-finder-brand-grid" ref={brandGridRef}>
        {SHOP_BRANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className="phone-finder-brand-btn"
            onClick={() => onSelectBrand(b)}
          >
            <span className="phone-finder-brand-icon" aria-hidden="true">
              <SearchBrandIcon brandId={b.id} />
            </span>
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

      <p className="phone-finder-eyebrow phone-finder-eyebrow--brand">
        <SearchBrandIcon brandId={brand.id} />
        <span>{brand.label}</span>
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
                    <ModelThumb brand={SHOP_BRAND_TO_REPAIR_BRAND[brand.id]} model={model} />
                    <span>{model}</span>
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
