import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SHOP_BRANDS, SHOP_CATEGORIES } from '../../config/products';
import { getModelsForShopBrand } from '../../config/repairModels';
import { useTranslation } from '../../context/LanguageContext';

const HOVER_CLOSE_MS = 220;

export default function ShopMegaMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeBrand, setActiveBrand] = useState(SHOP_BRANDS[0]?.id || null);
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_MS);
  }, [clearCloseTimer]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        clearCloseTimer();
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        clearCloseTimer();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const activeBrandData = SHOP_BRANDS.find((b) => b.id === activeBrand) || SHOP_BRANDS[0];
  const activeModels = activeBrandData ? getModelsForShopBrand(activeBrandData.id) : [];

  return (
    <div
      className={`nav-mega-wrap ${open ? 'is-open' : ''}`}
      ref={wrapRef}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="nav-mega-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          clearCloseTimer();
          // Hover already opens the panel on desktop — clicking must never
          // toggle it closed (that raced with hover-open and made the menu
          // vanish the instant the mouse moved toward it). Click always
          // opens; closing stays owned by mouseleave / outside-click / ESC.
          setOpen(true);
        }}
      >
        🛍️ {t('nav.shop')}
        <span className="nav-mega-chevron" aria-hidden="true">▾</span>
      </button>

      <div className="nav-mega-panel" hidden={!open} onMouseEnter={openMenu}>
        <div className="nav-mega-panel-body nav-mega-panel-body--shop">
          <div className="nav-mega-col">
            <p className="nav-mega-label">{t('nav.categories')}</p>
            <ul className="nav-mega-list">
              <li>
                <Link to="/shop" onClick={() => setOpen(false)}>
                  {t('nav.shopAll')}
                </Link>
              </li>
              {SHOP_CATEGORIES.map((cat) => (
                <li key={cat}>
                  <Link
                    to={`/shop?category=${encodeURIComponent(cat)}`}
                    onClick={() => setOpen(false)}
                  >
                    {cat}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="nav-mega-col nav-mega-col--brands">
            <p className="nav-mega-label">{t('nav.topPicks')}</p>
            <ul className="nav-mega-brand-list">
              {SHOP_BRANDS.map((brand) => (
                <li key={brand.id}>
                  <button
                    type="button"
                    className={`nav-mega-brand-item ${activeBrand === brand.id ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveBrand(brand.id)}
                    onFocus={() => setActiveBrand(brand.id)}
                    onClick={() => setActiveBrand(brand.id)}
                  >
                    <span aria-hidden="true">{brand.icon}</span>
                    <span className="nav-mega-brand-item-label">{brand.label}</span>
                    <span className="nav-mega-brand-arrow" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="nav-mega-col nav-mega-col--models">
            {activeBrandData && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeBrandData.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  <p className="nav-mega-label">
                    {activeBrandData.icon} {activeBrandData.label}
                  </p>
                  <p className="nav-mega-models-sub">{t('home.chooseModelSub')}</p>
                  <div className="nav-mega-model-chips">
                    {activeModels.map((model) => (
                      <Link
                        key={model}
                        to={`/shop?search=${encodeURIComponent(model)}`}
                        className="nav-mega-model-chip"
                        onClick={() => setOpen(false)}
                      >
                        {model}
                      </Link>
                    ))}
                  </div>
                  <Link
                    to={`/shop?search=${encodeURIComponent(activeBrandData.search)}`}
                    className="nav-mega-view-all"
                    onClick={() => setOpen(false)}
                  >
                    {t('nav.viewAllBrand', { brand: activeBrandData.label })}
                  </Link>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
