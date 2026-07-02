import { useEffect, useMemo, useRef, useState } from 'react';
import { getSeriesForShopBrand } from '../config/repairModels';

const MOBILE_QUERY = '(max-width: 768px)';
const OPEN_GUARD_MS = 450;

function parseModels(value) {
  return String(value || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * Model picker for Add/Edit Product — multi-select via chips.
 *
 * Mobile (≤768px): native `<select>` with `<optgroup>` rows, same UX as the
 * Brand field beside it. iOS/Android render the OS picker (scrollable list,
 * no typing). Each pick adds a chip; custom models via text field below.
 *
 * Desktop: searchable dropdown with series-grouped chips. On mobile the Add
 * Product form lives inside `.modal-panel` (`overflow-y: auto`), so a plain
 * absolute flyout gets clipped; desktop has enough room for the inline panel.
 */
export default function ModelMultiPicker({ brand, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const openedAtRef = useRef(0);

  const selected = useMemo(() => parseModels(value), [value]);
  const series = useMemo(() => (brand ? getSeriesForShopBrand(brand) : []), [brand]);

  const filteredSeries = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return series;
    return series
      .map((s) => ({ ...s, models: s.models.filter((m) => m.toLowerCase().includes(term)) }))
      .filter((s) => s.models.length > 0);
  }, [series, query]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const handleChange = (e) => {
      setIsMobile(e.matches);
      setOpen(false);
    };
    setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', handleChange);
    else mq.addListener(handleChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handleChange);
      else mq.removeListener(handleChange);
    };
  }, []);

  const canDismiss = () => Date.now() - openedAtRef.current > OPEN_GUARD_MS;

  const dismiss = () => {
    if (!canDismiss()) return;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const isInside = (target) =>
      (wrapRef.current && wrapRef.current.contains(target)) ||
      (panelRef.current && panelRef.current.contains(target));
    const onDocInteract = (e) => {
      if (!canDismiss()) return;
      if (!isInside(e.target)) setOpen(false);
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
  }, [open]);

  useEffect(() => {
    if (!brand) setOpen(false);
  }, [brand]);

  const commit = (nextList) => onChange(nextList.join(', '));

  const toggleModel = (model) => {
    commit(selected.includes(model) ? selected.filter((m) => m !== model) : [...selected, model]);
  };

  const removeModel = (model) => commit(selected.filter((m) => m !== model));

  const addCustom = () => {
    const clean = customInput.trim();
    if (!clean) return;
    if (!selected.includes(clean)) commit([...selected, clean]);
    setCustomInput('');
  };

  const addFromNativeSelect = (model) => {
    if (!model || selected.includes(model)) return;
    commit([...selected, model]);
  };

  const openDesktopPanel = (e) => {
    if (!brand) return;
    if (e?.pointerType === 'touch') e.preventDefault();
    openedAtRef.current = Date.now();
    setOpen(true);
  };

  const chips =
    selected.length > 0 ? (
      <div className="model-multi-picker-chips">
        {selected.map((m) => (
          <span key={m} className="model-multi-picker-selected-chip">
            {m}
            <button type="button" onClick={() => removeModel(m)} aria-label={`Remove ${m}`}>
              ✕
            </button>
          </span>
        ))}
      </div>
    ) : null;

  const customRow = (
    <div className="model-multi-picker-custom">
      <input
        value={customInput}
        onChange={(e) => setCustomInput(e.target.value)}
        placeholder="List mein nahi mila? Yahan type karein..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCustom();
          }
        }}
      />
      <button type="button" className="btn btn-outline btn-sm" onClick={addCustom}>
        + Add
      </button>
    </div>
  );

  /* ── Mobile: native select (same pattern as Brand) ── */
  if (isMobile) {
    return (
      <div className="model-multi-picker model-multi-picker--native">
        <select
          className="category-select model-multi-picker-native-select"
          value=""
          disabled={!brand}
          onChange={(e) => {
            addFromNativeSelect(e.target.value);
            e.target.value = '';
          }}
          aria-label="Compatible model select karein"
        >
          <option value="">
            {!brand
              ? 'Pehle brand select karein'
              : selected.length
              ? 'Aur model add karein...'
              : 'Model select karein (tap to open list)'}
          </option>
          {series.map((s) => (
            <optgroup key={s.name} label={s.name}>
              {s.models.map((m) => (
                <option key={m} value={m} disabled={selected.includes(m)}>
                  {selected.includes(m) ? `✓ ${m}` : m}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {chips}
        {customRow}
      </div>
    );
  }

  /* ── Desktop: searchable dropdown ── */
  const summary =
    selected.length === 0
      ? brand
        ? 'Model select karein (click to open)'
        : 'Pehle brand select karein'
      : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} models selected`;

  const panel = open && brand && (
    <div className="model-multi-picker-panel" ref={panelRef}>
      <input
        type="search"
        className="model-multi-picker-search"
        placeholder="Model search karein... e.g. iPhone 13"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <div className="model-multi-picker-scroll">
        {filteredSeries.length === 0 ? (
          <p className="field-hint">Koi model match nahi hua.</p>
        ) : (
          filteredSeries.map((s) => (
            <div key={s.name} className="model-multi-picker-series">
              <p className="model-multi-picker-series-name">{s.name}</p>
              <div className="model-multi-picker-options">
                {s.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`model-multi-picker-option ${selected.includes(m) ? 'is-selected' : ''}`}
                    onClick={() => toggleModel(m)}
                  >
                    {selected.includes(m) ? '✓ ' : ''}
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {customRow}

      <button type="button" className="model-multi-picker-done" onClick={dismiss}>
        ✓ Done
      </button>
    </div>
  );

  return (
    <div className="model-multi-picker" ref={wrapRef}>
      <button
        type="button"
        className={`model-multi-picker-trigger ${selected.length ? 'has-value' : ''}`}
        onPointerUp={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          if (open) dismiss();
          else openDesktopPanel(e);
        }}
        disabled={!brand}
        aria-expanded={open}
      >
        <span className="model-multi-picker-trigger-text">{summary}</span>
        <span className={`model-multi-picker-arrow ${open ? 'is-open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {chips}

      {panel}
    </div>
  );
}
