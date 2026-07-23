import { startTransition, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import MorphIcon from './nav/MorphIcon';
import {
  IconCart,
  IconCartReady,
  IconHome,
  IconHomeFilled,
  IconRepair,
  IconRepairBolt,
  IconShop,
  IconShopBag,
  IconUser,
  IconUserFilled,
} from './nav/NavIcons';
import './mobile-bottom-nav.css';

/** Warm route chunks on press so navigation feels instant. */
function prefetchRoute(path) {
  if (path === '/') import('../pages/Home');
  else if (path.startsWith('/shop')) import('../pages/Shop');
  else if (path.startsWith('/repair')) import('../pages/Repair');
  else if (path.startsWith('/account')) import('../pages/Account');
}

function activeKey(pathname) {
  if (pathname === '/') return 'home';
  if (pathname === '/shop' || pathname.startsWith('/shop/')) return 'shop';
  if (pathname.startsWith('/repair')) return 'repair';
  if (pathname.startsWith('/account')) return 'account';
  return null;
}

/**
 * Mobile/tablet bottom pill dock.
 * Active tab expands (icon + label + underline); inactive tabs stay icon-only.
 */
export default function MobileBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { count: cartCount, setOpen: setCartOpen, open: cartOpen } = useCart();
  const { isCustomer } = useAuth();

  const active = activeKey(location.pathname);
  const tabRefs = useRef({});
  /** Brief mark on Cart (not a route) */
  const [flashKey, setFlashKey] = useState(null);

  const openAccount = () => {
    startTransition(() => {
      if (isCustomer) navigate('/account');
      else navigate('/account/login');
    });
  };

  const markedKey = flashKey || active;

  const flashCart = () => {
    setFlashKey('cart');
    window.setTimeout(() => setFlashKey(null), 420);
  };

  const tabClass = (key) =>
    [
      'mobile-bottom-nav__item',
      'mobile-bottom-nav__item--morph',
      'mobile-bottom-nav__item--pill',
      markedKey === key ? 'is-marked' : '',
      active === key ? 'is-active' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <nav
      className={[
        'mobile-bottom-nav',
        cartOpen ? 'is-cart-open' : '',
        active === 'repair' ? 'is-repair-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={t('nav.floatingNav')}
      aria-hidden={cartOpen ? 'true' : undefined}
    >
      <NavLink
        to="/repair"
        className={() =>
          `mobile-bottom-nav__fab mobile-bottom-nav__item--morph${active === 'repair' ? ' is-active' : ''}`
        }
        tabIndex={cartOpen ? -1 : undefined}
        aria-label={t('nav.repair')}
        onPointerDown={() => prefetchRoute('/repair')}
      >
        <span className="mobile-bottom-nav__fab-orb">
          <MorphIcon
            className="mobile-bottom-nav__morph"
            idle={<IconRepair size={22} />}
            hover={<IconRepairBolt size={22} />}
          />
        </span>
        <span className="mobile-bottom-nav__fab-label">{t('nav.repair')}</span>
      </NavLink>

      <div className="mobile-bottom-nav__dock">
        <div className="mobile-bottom-nav__glass" aria-hidden="true" />
        <svg
          className="mobile-bottom-nav__cutout"
          viewBox="0 0 390 76"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="mobile-bottom-nav__cutout-fill"
            d="M0 24
               C0 10.7 10.7 0 24 0
               H132
               C143 0 151 7 155 16
               C163 36 176 50 195 50
               C214 50 227 36 235 16
               C239 7 247 0 258 0
               H366
               C379.3 0 390 10.7 390 24
               V76 H0 Z"
          />
        </svg>

        <div className="mobile-bottom-nav__items">
          <NavLink
            to="/"
            end
            className={() => tabClass('home')}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.home = el;
            }}
            onPointerDown={() => prefetchRoute('/')}
          >
            <span className="mobile-bottom-nav__icon">
              <MorphIcon
                className="mobile-bottom-nav__morph"
                idle={<IconHome size={22} />}
                hover={<IconHomeFilled size={22} />}
              />
            </span>
            <span className="mobile-bottom-nav__label">{t('nav.home')}</span>
            <span className="mobile-bottom-nav__underline" aria-hidden="true" />
          </NavLink>

          <NavLink
            to="/shop"
            className={() => tabClass('shop')}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.shop = el;
            }}
            onPointerDown={() => prefetchRoute('/shop')}
          >
            <span className="mobile-bottom-nav__icon">
              <MorphIcon
                className="mobile-bottom-nav__morph"
                idle={<IconShop size={22} />}
                hover={<IconShopBag size={22} />}
              />
            </span>
            <span className="mobile-bottom-nav__label">{t('nav.shop')}</span>
            <span className="mobile-bottom-nav__underline" aria-hidden="true" />
          </NavLink>

          <div className="mobile-bottom-nav__fab-slot" aria-hidden="true" />

          <button
            type="button"
            className={tabClass('cart')}
            onClick={() => {
              flashCart();
              setCartOpen(true);
            }}
            aria-label={
              cartCount
                ? t('cart.openCart', { count: cartCount })
                : t('nav.cart')
            }
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.cart = el;
            }}
          >
            <span className="mobile-bottom-nav__icon-wrap mobile-bottom-nav__icon">
              <MorphIcon
                className="mobile-bottom-nav__morph"
                idle={<IconCart size={22} />}
                hover={<IconCartReady size={22} />}
              />
              {cartCount > 0 && (
                <span className="mobile-bottom-nav__badge">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </span>
            <span className="mobile-bottom-nav__label">{t('nav.cart')}</span>
            <span className="mobile-bottom-nav__underline" aria-hidden="true" />
          </button>

          <button
            type="button"
            className={tabClass('account')}
            onClick={openAccount}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.account = el;
            }}
            aria-label={t('nav.myAccount')}
          >
            <span className="mobile-bottom-nav__icon">
              <MorphIcon
                className="mobile-bottom-nav__morph"
                idle={<IconUser size={22} />}
                hover={<IconUserFilled size={22} />}
              />
            </span>
            <span className="mobile-bottom-nav__label">{t('nav.profile')}</span>
            <span className="mobile-bottom-nav__underline" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}
