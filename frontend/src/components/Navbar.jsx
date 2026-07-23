import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { generalContactPath, whatsappLink } from '../config/shop';
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
  IconCart,
  IconCartReady,
  IconHeart,
  IconHeartFilled,
  IconSettings,
  IconSettingsSpin,
  IconWhatsApp,
  IconWhatsAppOutline,
} from './nav/NavIcons';
import MorphIcon from './nav/MorphIcon';
import MenuToggle from './ui/MenuToggle';
import { useWishlistIds } from '../hooks/useWishlist';
import { useCart } from '../context/CartContext';
import { useChatAssistant } from '../context/ChatAssistantContext';
import {
  NavDrawerAdminLink,
  NavDrawerButton,
  NavDrawerLink,
} from './NavDrawerItem';
import { useTranslation } from '../context/LanguageContext';
import useHeaderScrollHide from '../hooks/useHeaderScrollHide';
import { BRAND_ACCENT } from './LogoMark';
import { canManageProducts, isCounterStaff } from '../config/permissions';
import { getPostLoginPath } from '../utils/authRedirect';

export default function Navbar() {
  const { isStaff, isCustomer, user, logout } = useAuth();
  const canAddProducts = canManageProducts(user);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const drawerScrollRef = useRef(null);
  const prevPathRef = useRef(location.pathname);
  const { count: wishlistCount } = useWishlistIds();
  const { close: closeChat } = useChatAssistant();
  const { count: cartCount, setOpen: setCartOpen, open: cartOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopAccordionOpen, setShopAccordionOpen] = useState(false);
  const [shopMobileLevel, setShopMobileLevel] = useState(1);
  const [shopMobileBrand, setShopMobileBrand] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [finderCategory, setFinderCategory] = useState(null);
  const [drawerTab, setDrawerTab] = useState('menu');
  const [drawerBrand, setDrawerBrand] = useState(null);
  const [menuSession, setMenuSession] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const prevCartRef = useRef(cartCount);

  const resetDrawerScroll = () => {
    if (drawerScrollRef.current) {
      drawerScrollRef.current.scrollTop = 0;
    }
  };

  const clearModalBodyLocks = () => {
    document.body.classList.remove('modal-open');
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setDrawerTab('menu');
    setDrawerBrand(null);
    resetDrawerScroll();
  };

  const toggleMenu = () => {
    setMenuOpen((open) => {
      if (open) {
        setDrawerTab('menu');
        setDrawerBrand(null);
        return false;
      }
      clearModalBodyLocks();
      setDrawerTab('menu');
      setDrawerBrand(null);
      setMenuSession((n) => n + 1);
      resetDrawerScroll();
      return true;
    });
  };

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

  /* Same as before: opening the menu hides chat AI so the drawer can open cleanly */
  useEffect(() => {
    if (menuOpen) closeChat();
  }, [menuOpen, closeChat]);

  const headerHidden = useHeaderScrollHide(menuOpen || cartOpen);

  useEffect(() => {
    if (cartOpen && menuOpen) closeMenu();
  }, [cartOpen, menuOpen]);

  useEffect(() => {
    if (menuOpen && cartOpen) setCartOpen(false);
  }, [menuOpen, cartOpen, setCartOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    setDrawerTab('menu');
    resetDrawerScroll();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setShopAccordionOpen(false);
      setShopMobileLevel(1);
      setShopMobileBrand(null);
    } else {
      resetDrawerScroll();
    }
  }, [menuOpen]);

  useEffect(() => {
    resetDrawerScroll();
  }, [drawerTab]);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    clearModalBodyLocks();
    setMenuOpen(false);
    setDrawerTab('menu');
    setDrawerBrand(null);
    setShopAccordionOpen(false);
    setShopMobileLevel(1);
    setShopMobileBrand(null);
    setMenuSession((n) => n + 1);
    resetDrawerScroll();
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (prevCartRef.current !== cartCount) {
      prevCartRef.current = cartCount;
      setCartBump(true);
      const id = window.setTimeout(() => setCartBump(false), 420);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [cartCount]);

  const resetShopMobileNav = () => {
    setShopMobileLevel(1);
    setShopMobileBrand(null);
  };

  const toggleShopAccordion = (e) => {
    e?.currentTarget?.blur();
    const scrollEl =
      document.querySelector('.dx-drawer-scroll') || document.getElementById('main-nav');
    const scrollTop = scrollEl?.scrollTop ?? 0;
    setShopAccordionOpen((open) => {
      if (open) resetShopMobileNav();
      return !open;
    });
    requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollTop;
      requestAnimationFrame(() => {
        if (scrollEl) scrollEl.scrollTop = scrollTop;
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

  const waHref = whatsappLink('Assalam o Alaikum! AsFix & Gear se baat karni hai.');

  const showSlimline = headerHidden && !menuOpen && !cartOpen;

  return (
    <>
      {/* Slim brand rail — logo + ember line drop from top as one unit when header tucks */}
      <div
        className={`dx-slimline${showSlimline ? ' is-visible' : ''}`}
        aria-hidden={!showSlimline}
      >
        <Link to="/" className="dx-slimline-brand" tabIndex={showSlimline ? 0 : -1}>
          <img src="/logo.png" alt="" width="22" height="22" decoding="async" />
          <span className="dx-slimline-wordmark">
            <em style={{ color: BRAND_ACCENT }}>AS</em>
            {' '}FIX{' '}
            <em style={{ color: BRAND_ACCENT }}>&</em>
            {' '}GEAR
          </span>
        </Link>
        <span className="dx-slimline-ember" aria-hidden="true" />
      </div>

      <header
        className={`navbar navbar--mobile-pro navbar--pc navbar--dx${scrolled ? ' is-scrolled' : ''}${menuOpen ? ' is-menu-open' : ''}${headerHidden ? ' is-header-hidden' : ''}`}
      >
        {/* Row 1 — utility */}
        <div className="dx-utility">
          <div className="container dx-utility-inner">
            <MenuToggle
              open={menuOpen}
              onOpenChange={() => toggleMenu()}
              className={`menu-toggle menu-toggle--leading dx-menu-toggle dx-icon-btn ${menuOpen ? 'is-open' : ''}`}
              aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="main-nav"
            />

            <LogoLink onNavigate={closeMenu} />

            <NavSearch className="navbar-search--desktop dx-search--desktop" />

            <OpenBadge compact />

            <div className="dx-actions">
              <a
                href={waHref}
                className="dx-icon-btn dx-icon-btn--wa dx-icon-btn--morph"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('nav.whatsapp')}
                title={t('nav.whatsapp')}
              >
                <MorphIcon
                  idle={<IconWhatsAppOutline size={20} />}
                  hover={<IconWhatsApp size={20} />}
                />
              </a>

              {isCustomer ? (
                <AccountMenu className="account-menu--toolbar" />
              ) : isStaff ? (
                <Link to={getPostLoginPath(user)} className="dx-admin-link" onClick={closeMenu}>
                  {isCounterStaff(user) ? t('counter.title') : t('nav.admin')}
                </Link>
              ) : (
                <button
                  type="button"
                  className="dx-icon-btn dx-icon-btn--account dx-icon-btn--morph"
                  onClick={() => setLoginOpen(true)}
                  aria-label={t('nav.signIn')}
                  title={t('nav.signIn')}
                >
                  <MorphIcon
                    idle={<IconSettings size={20} />}
                    hover={<IconSettingsSpin size={20} />}
                  />
                </button>
              )}

              <Link
                to="/wishlist"
                className="dx-icon-btn dx-icon-btn--wishlist dx-icon-btn--morph"
                aria-label={t('wishlist.nav')}
                onClick={closeMenu}
              >
                <MorphIcon
                  idle={<IconHeart size={20} />}
                  hover={<IconHeartFilled size={20} />}
                />
                {wishlistCount > 0 && (
                  <span className="dx-badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>
                )}
              </Link>

              <button
                type="button"
                className={`dx-icon-btn dx-icon-btn--cart dx-icon-btn--morph${cartBump ? ' is-bump' : ''}`}
                data-cart-target="header"
                onClick={() => setCartOpen(true)}
                aria-label={t('cart.openCart', { count: cartCount })}
              >
                <MorphIcon
                  idle={<IconCart size={20} />}
                  hover={<IconCartReady size={20} />}
                />
                {cartCount > 0 && (
                  <span className="dx-badge">{cartCount > 99 ? '99+' : cartCount}</span>
                )}
              </button>

              <LanguageToggle className="lang-toggle--toolbar dx-lang" />
              <ThemeToggle className="theme-switch--nav dx-theme" />
            </div>
          </div>
        </div>

        {/* Row 2 — primary nav (desktop) */}
        <div className="dx-nav-row">
          <div className="container dx-nav-inner">
            <NavLink to="/" end className={({ isActive }) => `dx-nav-link${isActive ? ' is-active' : ''}`}>
              {t('nav.home')}
            </NavLink>
            <ShopMegaMenu />
            <NavLink
              to="/gaming"
              className={({ isActive }) =>
                `dx-nav-link dx-nav-link--gaming${isActive ? ' is-active' : ''}`
              }
            >
              {t('nav.gamingAccessories')}
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => `dx-nav-link${isActive ? ' is-active' : ''}`}>
              {t('nav.contact')}
            </NavLink>
            <NavLink
              to="/download"
              className={({ isActive }) => `dx-nav-link dx-nav-link--download${isActive ? ' is-active' : ''}`}
            >
              {t('nav.downloadApp')}
            </NavLink>
            {isCustomer ? (
              <NavLink
                to="/account"
                className={({ isActive }) => `dx-nav-link${isActive ? ' is-active' : ''}`}
              >
                {t('nav.myOrders')}
              </NavLink>
            ) : (
              <NavLink to="/track" className={({ isActive }) => `dx-nav-link${isActive ? ' is-active' : ''}`}>
                {t('nav.track')}
              </NavLink>
            )}
          </div>
        </div>

        {/* Mobile search row */}
        <div className="dx-search-row">
          <div className="container">
            <NavSearch className="dx-search--mobile" />
          </div>
        </div>

      </header>

      {typeof document !== 'undefined' &&
        createPortal(
          /* Style-scope classes stay for child CSS; .dx-drawer-portal-root
             strips sticky/glass so fixed drawer stays viewport-pinned. */
          <div
            className="navbar navbar--dx navbar--pc navbar--mobile-pro dx-drawer-portal-root"
            data-drawer-open={menuOpen ? 'true' : 'false'}
          >
            <div
              className={`nav-overlay ${menuOpen ? 'visible' : ''}`}
              onClick={closeMenu}
              aria-hidden="true"
            />
            <nav
              id="main-nav"
              className={`nav-links nav-drawer nav-drawer--pc ${menuOpen ? 'open' : ''}`}
              aria-hidden={!menuOpen}
            >
              <div className="nav-drawer-head nav-drawer-head--pc dx-drawer-chrome">
                <div className="dx-drawer-topbar">
                  <LogoLink onNavigate={closeMenu} />
                  <button
                    type="button"
                    className="nav-drawer-close nav-drawer-close--pc dx-drawer-close"
                    onClick={closeMenu}
                    aria-label={t('nav.closeMenu')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <div className="pc-drawer-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className={`pc-drawer-tab${drawerTab === 'menu' ? ' is-active' : ''}`}
                    aria-selected={drawerTab === 'menu'}
                    onClick={() => setDrawerTab('menu')}
                  >
                    {t('nav.menu')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`pc-drawer-tab${drawerTab === 'model' ? ' is-active' : ''}`}
                    aria-selected={drawerTab === 'model'}
                    onClick={() => setDrawerTab('model')}
                  >
                    {t('nav.selectModel')}
                  </button>
                </div>
              </div>

              <div
                className="dx-drawer-scroll"
                ref={drawerScrollRef}
                key={`drawer-scroll-${location.pathname}-${menuSession}-${drawerTab}`}
              >
                {drawerTab === 'model' ? (
                  <div className="pc-drawer-model-panel dx-drawer-tab-panel">
                    {!drawerBrand ? (
                      <div className="pc-drawer-brand-list">
                        {SHOP_BRANDS.map((brand) => (
                          <button
                            key={brand.id}
                            type="button"
                            className="pc-drawer-brand-row"
                            onClick={() => setDrawerBrand(brand.id)}
                          >
                            <SearchBrandIcon brandId={brand.id} />
                            <span>{brand.label}</span>
                            <span aria-hidden="true">›</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="pc-drawer-brand-back"
                          onClick={() => setDrawerBrand(null)}
                        >
                          ← {t('repair.changeCompany')}
                        </button>
                        <div className="pc-drawer-model-list">
                          {getSeriesForShopBrand(drawerBrand).flatMap((series) =>
                            series.models.map((model) => (
                              <Link
                                key={`${series.name}-${model}`}
                                className="pc-drawer-model-row"
                                to={`/shop?brand=${encodeURIComponent(drawerBrand)}&search=${encodeURIComponent(model)}`}
                                onClick={closeMenu}
                              >
                                {model}
                              </Link>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="dx-drawer-menu-panel dx-drawer-tab-panel">
                    <LanguageToggle className="lang-toggle--drawer" />
                    <span className="nav-drawer-section-label">{t('nav.explore')}</span>

                    <div className="nav-links-primary">
                      <NavDrawerLink
                        to="/"
                        end
                        icon="🏠"
                        label={t('nav.home')}
                        className="nav-drawer-link--home"
                        onClick={closeMenu}
                      />
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
                          <span className="nav-drawer-item-arrow nav-drawer-accordion-chevron" aria-hidden="true">
                            ▾
                          </span>
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
                      <NavDrawerLink
                        to="/gaming"
                        icon="🎮"
                        label={t('nav.gamingAccessories')}
                        className="nav-drawer-link--gaming"
                        onClick={closeMenu}
                      />
                      <NavDrawerLink to="/repair" icon="🔧" label={t('nav.repair')} onClick={closeMenu} />
                      <NavDrawerLink
                        to="/track"
                        icon="📦"
                        label={t('nav.track')}
                        className="nav-drawer-link--track"
                        onClick={closeMenu}
                      />
                      <NavDrawerLink to="/contact" icon="💬" label={t('nav.contact')} onClick={closeMenu} />
                      <NavDrawerLink to="/download" icon="⬇️" label={t('nav.downloadApp')} onClick={closeMenu} />
                    </div>

                    <span className="nav-drawer-section-label">{t('nav.accountSection')}</span>
                    <div className="nav-links-account">
                      {isCustomer ? (
                        <>
                          <NavDrawerLink to="/account" icon="👤" label={t('nav.profile')} onClick={closeMenu} />
                          <NavDrawerLink to="/account" icon="📦" label={t('nav.myOrders')} onClick={closeMenu} />
                          <NavDrawerLink
                            to="/account/settings"
                            icon="⚙️"
                            label={t('nav.settings')}
                            onClick={closeMenu}
                          />
                          <NavDrawerButton
                            icon="🚪"
                            label={t('account.logout')}
                            className="nav-drawer-logout"
                            onClick={handleLogout}
                          />
                        </>
                      ) : isStaff ? (
                        <>
                          <NavDrawerAdminLink to={getPostLoginPath(user)} icon="⚙️" label={isCounterStaff(user) ? t('counter.title') : t('nav.admin')} onClick={closeMenu} />
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
                          <NavDrawerLink
                            to="/account/register"
                            icon="✨"
                            label={t('nav.signUp')}
                            onClick={closeMenu}
                          />
                        </>
                      )}
                    </div>

                    {canAddProducts && (
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
                      accent
                      onClick={closeMenu}
                    />
                  </div>
                )}
              </div>
            </nav>
          </div>,
          document.body
        )}

      {canAddProducts && <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} />}
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
    <Link to="/" className="logo dx-logo" onClick={onNavigate}>
      <Logo size={36} showText />
    </Link>
  );
}
