import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { SHOP_BRANDS, SHOP_CATEGORIES } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';

const HOVER_CLOSE_MS = 220;

export default function ShopMegaMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [topProducts, setTopProducts] = useState([]);
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProducts({ featured: 'true' })
      .then((items) => {
        if (!cancelled) {
          setTopProducts(items.filter((p) => p.category !== 'Gaming').slice(0, 4));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
        <div className="nav-mega-panel-body">
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
        <div className="nav-mega-col">
          <p className="nav-mega-label">{t('nav.topPicks')}</p>
          <ul className="nav-mega-list nav-mega-list--brands">
            {SHOP_BRANDS.slice(0, 4).map((brand) => (
              <li key={brand.id}>
                <Link
                  to={`/shop?search=${encodeURIComponent(brand.search)}`}
                  onClick={() => setOpen(false)}
                >
                  {brand.icon} {brand.label}
                </Link>
              </li>
            ))}
          </ul>
          {topProducts.length > 0 && (
            <>
              <p className="nav-mega-label nav-mega-label--sub">{t('nav.featuredProducts')}</p>
              <ul className="nav-mega-products">
                {topProducts.map((p) => (
                  <li key={p.id}>
                    <Link to={`/shop/${p.id}`} onClick={() => setOpen(false)}>
                      <img src={p.image} alt="" loading="lazy" />
                      <span>{p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
