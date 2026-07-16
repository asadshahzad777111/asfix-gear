import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSeriesForShopBrand, SHOP_BRAND_TO_REPAIR_BRAND } from '../../config/repairModels';
import { useTranslation } from '../../context/LanguageContext';
import SearchBrandIcon from '../nav/SearchBrandIcon';
import ModelThumb from '../ModelThumb';

const OPEN_GUARD_MS = 450;
const PANEL_GAP_PX = 6;

function getNavbarBottom() {
  if (typeof document === 'undefined') return 0;
  const nav = document.querySelector('.navbar');
  return nav ? nav.getBoundingClientRect().bottom : 0;
}

/**
 * Shop filter model dropdown — same catalog + copy as PhoneFinder model step,
 * anchored under the trigger via a portalled fixed panel so every reopen
 * recalculates from getBoundingClientRect (no stale absolute coords after scroll).
 */
export default function ShopModelPicker({ brand, selectedModel, onSelectModel, onViewAllBrand }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelPos, setPanelPos] = useState(null);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const searchRef = useRef(null);
  const openedAtRef = useRef(0);
  const [openToken, setOpenToken] = useState(0);

  const series = useMemo(() => (brand ? getSeriesForShopBrand(brand.id) : []), [brand]);

  const filteredSeries = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return series;
    return series
      .map((s) => ({ ...s, models: s.models.filter((m) => m.toLowerCase().includes(term)) }))
      .filter((s) => s.models.length > 0);
  }, [series, query]);

  const updatePanelPos = useCallback(() => {
    const trigger = wrapRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPad = 12;
    const minWidth = 280;
    const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - viewportPad * 2);
    let left = rect.left;
    if (left + width > window.innerWidth - viewportPad) {
      left = Math.max(viewportPad, window.innerWidth - viewportPad - width);
    }
    const navBottom = getNavbarBottom();
    const top = Math.max(rect.bottom + PANEL_GAP_PX, navBottom + PANEL_GAP_PX);
    const maxHeight = Math.max(240, window.innerHeight - top - viewportPad);
    setPanelPos({ top, left, width, maxHeight });
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    setQuery('');
    setPanelPos(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    if (!open || !brand) {
      setPanelPos(null);
      return undefined;
    }
    updatePanelPos();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    const sync = () => updatePanelPos();
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [open, brand, openToken, updatePanelPos]);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, openToken]);

  useEffect(() => {
    if (!brand) closePanel();
  }, [brand, closePanel]);

  const canDismiss = () => Date.now() - openedAtRef.current > OPEN_GUARD_MS;

  const dismiss = () => {
    if (!canDismiss()) return;
    closePanel();
  };

  useEffect(() => {
    if (!open) return undefined;
    const isInside = (target) =>
      (wrapRef.current && wrapRef.current.contains(target)) ||
      (panelRef.current && panelRef.current.contains(target));
    const onDocInteract = (e) => {
      if (!canDismiss()) return;
      if (!isInside(e.target)) closePanel();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('mousedown', onDocInteract);
    document.addEventListener('touchstart', onDocInteract, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocInteract);
      document.removeEventListener('touchstart', onDocInteract);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, closePanel]);

  const openPanel = () => {
    if (!brand) return;
    openedAtRef.current = Date.now();
    updatePanelPos();
    setOpenToken((token) => token + 1);
    setOpen(true);
  };

  const pickModel = (model) => {
    onSelectModel(model);
    closePanel();
  };

  const label = (
    <span className="shop-model-picker-trigger-label">
      <SearchBrandIcon brandId={brand.id} />
      <span>{selectedModel || brand.label}</span>
    </span>
  );

  const panelBody =
    open && brand && panelPos ? (
      <div
        className="shop-model-picker-panel phone-finder-panel"
        ref={panelRef}
        style={{
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxHeight,
        }}
        role="dialog"
        aria-label={t('phoneFinder.modelQuestion')}
      >
        <p className="shop-model-picker-brand">
          <SearchBrandIcon brandId={brand.id} />
          <span>{brand.label}</span>
        </p>
        <input
          ref={searchRef}
          type="search"
          className="phone-finder-model-search"
          placeholder={t('phoneFinder.modelSearchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="phone-finder-model-scroll shop-model-picker-scroll" ref={scrollRef}>
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
                      className={`phone-finder-model-chip ${selectedModel === model ? 'is-selected' : ''}`}
                      onClick={() => pickModel(model)}
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

        <button
          type="button"
          className="phone-finder-skip"
          onClick={() => {
            onViewAllBrand();
            closePanel();
          }}
        >
          {t('phoneFinder.viewAllBrand', { brand: brand.label })}
        </button>
      </div>
    ) : null;

  const portaledPanel =
    panelBody && typeof document !== 'undefined' ? createPortal(panelBody, document.body) : null;

  if (!brand) return null;

  return (
    <div className="shop-model-picker" ref={wrapRef}>
      <button
        type="button"
        className={`filter-btn shop-model-picker-trigger ${selectedModel ? 'has-value' : ''}`}
        onClick={() => (open ? dismiss() : openPanel())}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      {portaledPanel}
    </div>
  );
}
