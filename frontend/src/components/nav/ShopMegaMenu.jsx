import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SHOP_BRANDS, SHOP_CATEGORIES, MODEL_SPECIFIC_CATEGORIES } from '../../config/products';
import { getSeriesForShopBrand } from '../../config/repairModels';
import { useTranslation } from '../../context/LanguageContext';
import PhoneFinderModal from '../PhoneFinderModal';

/** Click-only levels: 1 categories → 2 brands → 3 models */
export default function ShopMegaMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(1);
  const [activeBrand, setActiveBrand] = useState(SHOP_BRANDS[0]?.id || null);
  const [finderCategory, setFinderCategory] = useState(null);
  const wrapRef = useRef(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setLevel(1);
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((was) => {
      if (was) {
        setLevel(1);
        return false;
      }
      return true;
    });
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        closeMenu();
      }
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

  const activeBrandData = SHOP_BRANDS.find((b) => b.id === activeBrand) || SHOP_BRANDS[0];
  const activeSeries = activeBrandData ? getSeriesForShopBrand(activeBrandData.id) : [];

  const handleCategoryClick = (cat) => {
    if (MODEL_SPECIFIC_CATEGORIES.includes(cat)) {
      closeMenu();
      setFinderCategory(cat);
    }
  };

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
          🛍️ {t('nav.shop')}
          <span className="nav-mega-chevron" aria-hidden="true">▾</span>
        </button>

        <div className="nav-mega-panel nav-mega-panel--solid" hidden={!open}>
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
                        <span aria-hidden="true">{brand.icon}</span>
                        <span className="nav-mega-brand-item-label">{brand.label}</span>
                        <span className="nav-mega-brand-arrow" aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {level === 3 && activeBrandData && (
              <div className="nav-mega-step nav-mega-step--models">
                <p className="nav-mega-label">
                  {activeBrandData.icon} {activeBrandData.label}
                </p>
                <p className="nav-mega-models-sub">{t('home.chooseModelSub')}</p>
                <div className="nav-mega-model-series-scroll">
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
                            {model}
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
        </div>
      </div>

      <PhoneFinderModal
        open={Boolean(finderCategory)}
        category={finderCategory}
        onClose={() => setFinderCategory(null)}
      />
    </>
  );
}
