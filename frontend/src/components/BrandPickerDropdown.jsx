import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SearchBrandIcon from './nav/SearchBrandIcon';

const OPEN_GUARD_MS = 450;
const PANEL_GAP_PX = 6;

function getNavbarBottom() {
  if (typeof document === 'undefined') return 0;
  const nav = document.querySelector('.navbar');
  return nav ? nav.getBoundingClientRect().bottom : 0;
}

/**
 * Custom brand dropdown with SearchBrandIcon — replaces native <select> where
 * brand logos are needed (Shop filter, repair intake).
 *
 * options: [{ value, label, brandId? }] — brandId drives SearchBrandIcon
 * allOption: optional { value, label } prepended to the list (e.g. "All Brands")
 */
export default function BrandPickerDropdown({
  value,
  onChange,
  options = [],
  allOption = null,
  placeholder = '',
  ariaLabel = '',
  triggerClassName = 'filter-btn',
  activeWhen = null,
  variant = 'filter',
  id,
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState(null);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const openedAtRef = useRef(0);
  const [openToken, setOpenToken] = useState(0);

  const listItems = useMemo(() => {
    const items = [];
    if (allOption) items.push({ ...allOption, brandId: '' });
    items.push(...options);
    return items;
  }, [allOption, options]);

  const selectedItem = useMemo(() => {
    if (allOption && value === allOption.value) return allOption;
    return options.find((o) => o.value === value) || null;
  }, [allOption, options, value]);

  const triggerLabel = selectedItem?.label || placeholder;
  const triggerBrandId = selectedItem?.brandId || '';
  const isActive = activeWhen != null ? activeWhen : Boolean(selectedItem && selectedItem !== allOption);

  const updatePanelPos = useCallback(() => {
    const trigger = wrapRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPad = 12;
    const minWidth = variant === 'form' ? Math.max(rect.width, 260) : 240;
    const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - viewportPad * 2);
    let left = rect.left;
    if (left + width > window.innerWidth - viewportPad) {
      left = Math.max(viewportPad, window.innerWidth - viewportPad - width);
    }
    const navBottom = getNavbarBottom();
    const top = Math.max(rect.bottom + PANEL_GAP_PX, navBottom + PANEL_GAP_PX);
    const maxHeight = Math.max(240, window.innerHeight - top - viewportPad);
    setPanelPos({ top, left, width, maxHeight });
  }, [variant]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setPanelPos(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    if (!open) {
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
  }, [open, openToken, updatePanelPos]);

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
    openedAtRef.current = Date.now();
    updatePanelPos();
    setOpenToken((token) => token + 1);
    setOpen(true);
  };

  const pick = (itemValue) => {
    onChange(itemValue);
    closePanel();
  };

  const panelBody =
    open && panelPos ? (
      <div
        className="brand-picker-panel shop-model-picker-panel"
        ref={panelRef}
        style={{
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxHeight,
        }}
        role="listbox"
        aria-label={ariaLabel}
      >
        <ul className="nav-mega-brand-list brand-picker-list" ref={scrollRef}>
          {listItems.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                role="option"
                aria-selected={value === item.value}
                className={`nav-mega-brand-item brand-picker-item ${value === item.value ? 'is-selected' : ''}`}
                onClick={() => pick(item.value)}
              >
                {item.brandId ? (
                  <SearchBrandIcon brandId={item.brandId} />
                ) : (
                  <span className="brand-picker-item-spacer" aria-hidden="true" />
                )}
                <span className="nav-mega-brand-item-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const portaledPanel =
    panelBody && typeof document !== 'undefined' ? createPortal(panelBody, document.body) : null;

  const triggerClasses = [
    'brand-picker-dropdown',
    variant === 'form' ? 'brand-picker-dropdown--form' : 'brand-picker-dropdown--filter',
    triggerClassName,
    isActive ? 'active has-value' : '',
    open ? 'is-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="brand-picker-wrap" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className={triggerClasses}
        onClick={() => (open ? dismiss() : openPanel())}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        <span className="brand-picker-trigger-label">
          {triggerBrandId ? <SearchBrandIcon brandId={triggerBrandId} /> : null}
          <span className={!selectedItem ? 'brand-picker-placeholder' : ''}>{triggerLabel}</span>
        </span>
        <span className="brand-picker-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {portaledPanel}
    </div>
  );
}
