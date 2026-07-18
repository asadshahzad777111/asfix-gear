import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { SHOP_BRANDS, SHOP_CATEGORIES, MODEL_SPECIFIC_CATEGORIES } from '../../config/products';
import { getSeriesForShopBrand, SHOP_BRAND_TO_REPAIR_BRAND } from '../../config/repairModels';
import { useTranslation } from '../../context/LanguageContext';
import PhoneFinderModal from '../PhoneFinderModal';
import SearchBrandIcon from './SearchBrandIcon';
import ModelThumb from '../ModelThumb';

const PANEL_GAP_PX = 12;

function getNavbarBottom() {
  if (typeof document === 'undefined') return 0;
  const nav = document.querySelector('.navbar');
  return nav ? nav.getBoundingClientRect().bottom : 0;
}

/** Click-only levels: 1 categories → 2 brands → 3 models */
export default function ShopMegaMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(1);
  const [activeBrand, setActiveBrand] = useState(SHOP_BRANDS[0]?.id || null);
  const [finderCategory, setFinderCategory] = useState(null);
  const [panelPos, setPanelPos] = useState(null);
  const [openToken, setOpenToken] = useState(0);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const modelScrollRef = useRef(null);

  const resetMenuState = useCallback(() => {
    setLevel(1);
    setActiveBrand(SHOP_BRANDS[0]?.id || null);
    setPanelPos(null);
    if (modelScrollRef.current) modelScrollRef.current.scrollTop = 0;
  }, []);

  const updatePanelPos = useCallback(() => {
    const trigger = wrapRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPad = 12;
    const panelWidth = window.innerWidth >= 1024 ? 400 : 320;
    const width = Math.min(panelWidth, window.innerWidth - viewportPad * 2);
    let left = rect.left;
    if (left + width > window.innerWidth - viewportPad) {
      left = Math.max(viewportPad, window.innerWidth - viewportPad - width);
    }
    const navBottom = getNavbarBottom();
    const anchorBottom = navBottom > 0 ? navBottom : rect.bottom;
    const top = anchorBottom + PANEL_GAP_PX;
    const maxHeight = Math.max(240, window.innerHeight - top - viewportPad);
    setPanelPos({ top, left, width, maxHeight });
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    resetMenuState();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [resetMenuState]);

  const toggleOpen = useCallback(() => {
    setOpen((was) => {
      if (was) {
        resetMenuState();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return false;
      }
      resetMenuState();
      setOpenToken((token) => token + 1);
      return true;
    });
  }, [resetMenuState]);

  useLayoutEffect(() => {
    if (!open) {
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
  }, [open, level, updatePanelPos]);

  useEffect(() => {
    const isInside = (target) =>
      (wrapRef.current && wrapRef.current.contains(target)) ||
      (panelRef.current && panelRef.current.contains(target));
    const onDocClick = (e) => {
      if (!isInside(e.target)) closeMenu();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return;
    const panelBody = panelRef.current?.querySelector('.nav-mega-panel-body--stepped');
    if (panelBody) panelBody.scrollTop = 0;
    if (level !== 3) return;
    const scrollEl = modelScrollRef.current;
    if (scrollEl) scrollEl.scrollTop = 0;
  }, [open, level, activeBrand]);

  const activeBrandData = SHOP_BRANDS.find((b) => b.id === activeBrand) || SHOP_BRANDS[0];
  const activeSeries = activeBrandData ? getSeriesForShopBrand(activeBrandData.id) : [];

  const handleCategoryClick = (cat) => {
    if (MODEL_SPECIFIC_CATEGORIES.includes(cat)) {
      closeMenu();
      setFinderCategory(cat);
    }
  };

  const panelBody = (
    <div className="nav-mega-panel-body nav-mega-panel-body--shop nav-mega-panel-body--stepped">
      {level > 1 && (
        <button
          type="button"
          className="nav-mega-back"
          onClick={() => setLevel((l) => Math.max(1, l - 1))}
        >
          ← {level === 2 ? t('nav.categories') : t('nav.topPicks')}
        </button>
      )}

      {level === 1 && (
        <div className="nav-mega-step nav-mega-step--categories">
          <p className="nav-mega-label">{t('nav.categories')}</p>
          <ul className="nav-mega-list">
            <li>
              <Link to="/shop" onClick={closeMenu}>
                {t('nav.shopAll')}
              </Link>
            </li>
            {SHOP_CATEGORIES.map((cat) => (
              <li key={cat}>
                {MODEL_SPECIFIC_CATEGORIES.includes(cat) ? (
                  <button
                    type="button"
                    className="nav-mega-list-btn"
                    onClick={() => handleCategoryClick(cat)}
                  >
                    {cat}
                  </button>
                ) : (
                  <Link
                    to={`/shop?category=${encodeURIComponent(cat)}`}
                    onClick={closeMenu}
                  >
                    {cat}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="nav-mega-next" onClick={() => setLevel(2)}>
            {t('nav.topPicks')} →
          </button>
        </div>
      )}

      {level === 2 && (
        <div className="nav-mega-step nav-mega-step--brands">
          <p className="nav-mega-label">{t('nav.topPicks')}</p>
          <ul className="nav-mega-brand-list">
            {SHOP_BRANDS.map((brand) => (
              <li key={brand.id}>
                <button
                  type="button"
                  className="nav-mega-brand-item"
                  onClick={() => {
                    setActiveBrand(brand.id);
                    setLevel(3);
                  }}
                >
                  <SearchBrandIcon brandId={brand.id} />
                  <span className="nav-mega-brand-item-label">{brand.label}</span>
                  <span className="nav-mega-brand-arrow" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {level === 3 && activeBrandData && (
        <div key={`${activeBrand}-models`} className="nav-mega-step nav-mega-step--models">
          <p className="nav-mega-label nav-mega-label--brand">
            <SearchBrandIcon brandId={activeBrandData.id} />
            <span>{activeBrandData.label}</span>
          </p>
          <p className="nav-mega-models-sub">{t('home.chooseModelSub')}</p>
          <div className="nav-mega-model-series-scroll" ref={modelScrollRef}>
            {activeSeries.map((series) => (
              <div key={series.name} className="nav-mega-model-series">
                <p className="nav-mega-model-series-name">{series.name}</p>
                <div className="nav-mega-model-chips">
                  {series.models.map((model) => (
                    <Link
                      key={model}
                      to={`/shop?brand=${encodeURIComponent(activeBrandData.id)}&search=${encodeURIComponent(model)}`}
                      className="nav-mega-model-chip"
                      onClick={closeMenu}
                    >
                      <ModelThumb
                        brand={SHOP_BRAND_TO_REPAIR_BRAND[activeBrandData.id]}
                        model={model}
                      />
                      <span>{model}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link
            to={`/shop?brand=${encodeURIComponent(activeBrandData.id)}`}
            className="nav-mega-view-all"
            onClick={closeMenu}
          >
            {t('nav.viewAllBrand', { brand: activeBrandData.label })}
          </Link>
        </div>
      )}
    </div>
  );

  const portaledPanel =
    open && panelPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            key={openToken}
            ref={panelRef}
            className="nav-mega-panel nav-mega-panel--solid nav-mega-panel--fixed"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: panelPos.maxHeight,
            }}
            role="menu"
          >
            {panelBody}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className={`nav-mega-wrap nav-mega-wrap--click ${open ? 'is-open' : ''}`} ref={wrapRef}>
        <button
          type="button"
          className="nav-mega-trigger"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={toggleOpen}
        >
          {t('nav.shop')}
          <span className="nav-mega-chevron" aria-hidden="true">▾</span>
        </button>
      </div>

      {portaledPanel}

      <PhoneFinderModal
        open={Boolean(finderCategory)}
        category={finderCategory}
        onClose={() => setFinderCategory(null)}
      />
    </>
  );
}
