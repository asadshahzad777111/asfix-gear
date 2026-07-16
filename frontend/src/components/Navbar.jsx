import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { generalContactPath } from '../config/shop';
import { MODEL_SPECIFIC_CATEGORIES, SHOP_BRANDS, SHOP_CATEGORIES } from '../config/products';
import { getSeriesForShopBrand, SHOP_BRAND_TO_REPAIR_BRAND } from '../config/repairModels';
import SearchBrandIcon from './nav/SearchBrandIcon';
import ModelThumb from './ModelThumb';
import { useAuth } from '../context/AuthContext';
import useNavDrawerThumb from '../hooks/useNavDrawerThumb';
import OpenBadge from './OpenBadge';
import Logo from './Logo';
import AddProductModal from './AddProductModal';
import AccountMenu from './AccountMenu';
import CustomerLoginModal from './CustomerLoginModal';
import PhoneFinderModal from './PhoneFinderModal';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import NavSearch from './nav/NavSearch';
import ShopMegaMenu from './nav/ShopMegaMenu';
import {
  NavDrawerAdminLink,
  NavDrawerButton,
  NavDrawerLink,
} from './NavDrawerItem';
import { useTranslation } from '../context/LanguageContext';

export default function Navbar() {
  const { isStaff, isCustomer, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopAccordionOpen, setShopAccordionOpen] = useState(false);
  const [shopMobileLevel, setShopMobileLevel] = useState(1);
  const [shopMobileBrand, setShopMobileBrand] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [finderCategory, setFinderCategory] = useState(null);

  const closeMenu = () => setMenuOpen(false);

  const openLoginModal = () => {
    closeMenu();
    setLoginOpen(true);
  };

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/');
  };

  useNavDrawerThumb(menuOpen);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setShopAccordionOpen(false);
      setShopMobileLevel(1);
      setShopMobileBrand(null);
    }
  }, [menuOpen]);

  const resetShopMobileNav = () => {
    setShopMobileLevel(1);
    setShopMobileBrand(null);
  };

  const toggleShopAccordion = (e) => {
    e?.currentTarget?.blur();
    const drawer = document.getElementById('main-nav');
    const scrollTop = drawer?.scrollTop ?? 0;
    setShopAccordionOpen((open) => {
      if (open) resetShopMobileNav();
      return !open;
    });
    // Double rAF: some mobile browsers (esp. iOS Safari) re-apply their own
    // focus/layout-driven scroll adjustment one frame after ours, so we
    // pin scrollTop again after that frame too — prevents the drawer from
    // jumping back to the top when the accordion expands/collapses.
    requestAnimationFrame(() => {
      if (drawer) drawer.scrollTop = scrollTop;
      requestAnimationFrame(() => {
        if (drawer) drawer.scrollTop = scrollTop;
      });
    });
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <header className="navbar navbar--mobile-pro navbar--pc">
        <div className="container navbar-inner">
          <LogoLink onNavigate={closeMenu} />

          <NavSearch className="navbar-search--desktop" />

          <div className="nav-desktop-bar">
            <Link to="/" className="nav-desktop-link">{t('nav.home')}</Link>
            <ShopMegaMenu />
            <NavLink
              to="/gaming"
              className={({ isActive }) =>
                `nav-desktop-link nav-desktop-link--gaming${isActive ? ' nav-desktop-link--active' : ''}`
              }
            >
              {t('nav.gamingAccessories')}
            </NavLink>
            <Link to="/repair" className="nav-desktop-link nav-desktop-link--repair-text">
              {t('nav.repair')}
            </Link>
            <Link to="/contact" className="nav-desktop-link">{t('nav.contact')}</Link>
            {isCustomer ? (
              <Link to="/account" className="nav-desktop-link nav-desktop-link--orders">{t('nav.myOrders')}</Link>
            ) : (
              <Link to="/track" className="nav-desktop-link nav-desktop-link--track">{t('nav.track')}</Link>
            )}
          </div>

          <nav
            id="main-nav"
            className={`nav-links nav-drawer ${menuOpen ? 'open' : ''}`}
            aria-hidden={!menuOpen}
          >
            <div className="nav-drawer-head">
              <div className="nav-drawer-head-text">
                <span className="nav-drawer-title">{t('nav.menu')}</span>
                <span className="nav-drawer-subtitle">{t('nav.menuSub')}</span>
              </div>
              <button
                type="button"
                className="nav-drawer-close"
                onClick={closeMenu}
                aria-label={t('nav.closeMenu')}
              >
                <span className="nav-drawer-close-icon">✕</span>
              </button>
            </div>

            <LanguageToggle className="lang-toggle--drawer" />

            <span className="nav-drawer-section-label">{t('nav.explore')}</span>

            <div className="nav-links-primary">
              <NavDrawerLink to="/" end icon="🏠" label={t('nav.home')} className="nav-drawer-link--home" onClick={closeMenu} />
              <div className={`nav-drawer-accordion ${shopAccordionOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="nav-drawer-item nav-drawer-accordion-trigger"
                  aria-expanded={shopAccordionOpen}
                  aria-controls="nav-shop-accordion-panel"
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.currentTarget.blur()}
                  onClick={toggleShopAccordion}
                >
                  <span className="nav-drawer-item-glow" aria-hidden="true" />
                  <span className="nav-drawer-item-icon" aria-hidden="true">🛍️</span>
                  <span className="nav-drawer-item-label">{t('nav.shop')}</span>
                  <span className="nav-drawer-item-arrow nav-drawer-accordion-chevron" aria-hidden="true">▾</span>
                </button>
                <div
                  id="nav-shop-accordion-panel"
                  className="nav-drawer-accordion-panel"
                  aria-hidden={!shopAccordionOpen}
                >
                  <div className="nav-drawer-accordion-panel-inner nav-drawer-shop-panel">
                    {shopMobileLevel > 1 && (
                      <button
                        type="button"
                        className="nav-drawer-accordion-link nav-drawer-accordion-link--btn nav-drawer-shop-back"
                        onClick={() => setShopMobileLevel((level) => Math.max(1, level - 1))}
                      >
                        ← {shopMobileLevel === 2 ? t('nav.categories') : t('nav.topPicks')}
                      </button>
                    )}

                    {shopMobileLevel === 1 && (
                      <>
                        <Link to="/shop" className="nav-drawer-accordion-link" onClick={closeMenu}>
                          {t('nav.shopAll')}
                        </Link>
                        {SHOP_CATEGORIES.map((cat) =>
                          MODEL_SPECIFIC_CATEGORIES.includes(cat) ? (
                            <button
                              key={cat}
                              type="button"
                              className="nav-drawer-accordion-link nav-drawer-accordion-link--btn"
                              onClick={() => {
                                closeMenu();
                                setFinderCategory(cat);
                              }}
                            >
                              {cat}
                            </button>
                          ) : (
                            <Link
                              key={cat}
                              className="nav-drawer-accordion-link"
                              to={`/shop?category=${encodeURIComponent(cat)}`}
                              onClick={closeMenu}
                            >
                              {cat}
                            </Link>
                          )
                        )}
                        <button
                          type="button"
                          className="nav-drawer-accordion-link nav-drawer-accordion-link--btn nav-drawer-shop-next"
                          onClick={() => setShopMobileLevel(2)}
                        >
                          {t('nav.topPicks')} →
                        </button>
                      </>
                    )}

                    {shopMobileLevel === 2 &&
                      SHOP_BRANDS.map((brand) => (
                        <button
                          key={brand.id}
                          type="button"
                          className="nav-drawer-accordion-link nav-drawer-accordion-link--btn nav-drawer-accordion-link--brand"
                          onClick={() => {
                            setShopMobileBrand(brand.id);
                            setShopMobileLevel(3);
                          }}
                        >
                          <SearchBrandIcon brandId={brand.id} />
                          <span className="nav-drawer-brand-label">{brand.label}</span>
                          <span className="nav-drawer-brand-arrow" aria-hidden="true">›</span>
                        </button>
                      ))}

                    {shopMobileLevel === 3 && shopMobileBrand && (
                      <>
                        <div className="nav-drawer-shop-brand-head">
                          <SearchBrandIcon brandId={shopMobileBrand} />
                          <span className="nav-drawer-brand-label">
                            {SHOP_BRANDS.find((b) => b.id === shopMobileBrand)?.label || shopMobileBrand}
                          </span>
                        </div>
                        {getSeriesForShopBrand(shopMobileBrand).flatMap((series) =>
                          series.models.map((model) => (
                            <Link
                              key={`${series.name}-${model}`}
                              className="nav-drawer-accordion-link nav-drawer-model-link"
                              to={`/shop?brand=${encodeURIComponent(shopMobileBrand)}&search=${encodeURIComponent(model)}`}
                              onClick={closeMenu}
                            >
                              <ModelThumb
                                brand={SHOP_BRAND_TO_REPAIR_BRAND[shopMobileBrand]}
                                model={model}
                              />
                              <span>{model}</span>
                            </Link>
                          ))
                        )}
                        <Link
                          className="nav-drawer-accordion-link"
                          to={`/shop?brand=${encodeURIComponent(shopMobileBrand)}`}
                          onClick={closeMenu}
                        >
                          {t('nav.viewAllBrand', {
                            brand: SHOP_BRANDS.find((b) => b.id === shopMobileBrand)?.label || '',
                          })}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <NavDrawerLink to="/gaming" icon="🎮" label={t('nav.gamingAccessories')} className="nav-drawer-link--gaming" onClick={closeMenu} />
              <NavDrawerLink to="/repair" icon="🔧" label={t('nav.repair')} onClick={closeMenu} />
              <NavDrawerLink to="/track" icon="📦" label={t('nav.track')} className="nav-drawer-link--track" onClick={closeMenu} />
              <NavDrawerLink to="/contact" icon="💬" label={t('nav.contact')} onClick={closeMenu} />
            </div>

            <span className="nav-drawer-section-label">{t('nav.accountSection')}</span>
            <div className="nav-links-account">
              {isCustomer ? (
                <>
                  <NavDrawerLink to="/account" icon="👤" label={t('nav.profile')} onClick={closeMenu} />
                  <NavDrawerLink to="/account" icon="📦" label={t('nav.myOrders')} onClick={closeMenu} />
                  <NavDrawerLink to="/account/settings" icon="⚙️" label={t('nav.settings')} onClick={closeMenu} />
                  <NavDrawerButton
                    icon="🚪"
                    label={t('account.logout')}
                    className="nav-drawer-logout"
                    onClick={handleLogout}
                  />
                </>
              ) : isStaff ? (
                <>
                  <NavDrawerAdminLink to="/admin" icon="⚙️" label={t('nav.admin')} onClick={closeMenu} />
                  <NavDrawerButton
                    icon="🚪"
                    label={t('account.logout')}
                    className="nav-drawer-logout"
                    onClick={handleLogout}
                  />
                </>
              ) : (
                <>
                  <NavDrawerButton icon="🔑" label={t('nav.signIn')} onClick={openLoginModal} />
                  <NavDrawerLink to="/account/register" icon="✨" label={t('nav.signUp')} onClick={closeMenu} />
                </>
              )}
            </div>

            {isStaff && (
              <>
                <span className="nav-drawer-section-label">{t('staff.staffOnly')}</span>
                <div className="nav-links-staff">
                  <NavDrawerButton
                    icon="➕"
                    label={t('nav.addProduct')}
                    className="nav-add-product"
                    onClick={() => {
                      setAddOpen(true);
                      closeMenu();
                    }}
                  />
                </div>
              </>
            )}

            <NavDrawerLink
              to={generalContactPath()}
              icon="📱"
              label={t('nav.whatsapp')}
              className="nav-whatsapp"
              onClick={closeMenu}
            />
          </nav>

          <div className="navbar-aside">
            <Link to="/repair" className="nav-repair-cta" onClick={closeMenu}>
              <span className="nav-repair-cta-icon" aria-hidden="true">
                🔧
              </span>
              <span>{t('nav.repair')}</span>
            </Link>
            <OpenBadge compact />
            {isCustomer ? (
              <AccountMenu className="account-menu--toolbar" />
            ) : isStaff ? (
              <Link to="/admin" className="btn btn-primary btn-sm nav-auth-btn">
                {t('nav.admin')}
              </Link>
            ) : (
              <div className="nav-auth-buttons nav-auth-buttons--toolbar">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm nav-auth-btn"
                  onClick={() => setLoginOpen(true)}
                >
                  {t('nav.signIn')}
                </button>
                <Link to="/account/register" className="btn btn-primary btn-sm nav-auth-btn">
                  {t('nav.signUp')}
                </Link>
              </div>
            )}
            <LanguageToggle className="lang-toggle--toolbar" />
            <ThemeToggle className="theme-switch--nav" />
            <button
              type="button"
              className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="main-nav"
            >
              <span className="menu-toggle-bar" />
              <span className="menu-toggle-bar" />
              <span className="menu-toggle-bar" />
            </button>
          </div>
        </div>

        <div className="navbar-search-row">
          <div className="container">
            <NavSearch />
          </div>
        </div>

        <div
          className={`nav-overlay ${menuOpen ? 'visible' : ''}`}
          onClick={closeMenu}
          aria-hidden="true"
        />
      </header>

      {isStaff && <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} />}
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <PhoneFinderModal
        open={Boolean(finderCategory)}
        category={finderCategory}
        onClose={() => setFinderCategory(null)}
      />
    </>
  );
}

function LogoLink({ onNavigate }) {
  return (
    <Link to="/" className="logo" onClick={onNavigate}>
      <Logo size={38} showText />
    </Link>
  );
}
