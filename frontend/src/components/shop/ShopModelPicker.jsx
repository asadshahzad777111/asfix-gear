import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSeriesForShopBrand } from '../../config/repairModels';
import { useTranslation } from '../../context/LanguageContext';

const OPEN_GUARD_MS = 450;
const PANEL_GAP_PX = 6;

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
    const maxHeight = Math.max(180, window.innerHeight - rect.bottom - PANEL_GAP_PX - viewportPad);
    setPanelPos({ top: rect.bottom + PANEL_GAP_PX, left, width, maxHeight });
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    setQuery('');
    setPanelPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!open || !brand) {
      setPanelPos(null);
      return undefined;
    }
    updatePanelPos();
    const sync = () => updatePanelPos();
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [open, brand, updatePanelPos]);

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

  const label = selectedModel
    ? selectedModel
    : t('phoneFinder.modelSearchPlaceholder');

  const panelBody =
    open && brand && panelPos ? (
      <div
        key={openToken}
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
        <input
          ref={searchRef}
          type="search"
          className="phone-finder-model-search"
          placeholder={t('phoneFinder.modelSearchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="phone-finder-model-scroll shop-model-picker-scroll">
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
                      {model}
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
        {brand.icon} {label} <span aria-hidden="true">▾</span>
      </button>
      {portaledPanel}
    </div>
  );
}
