import { startTransition, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlistIds } from '../hooks/useWishlist';
import MorphIcon from './nav/MorphIcon';
import {
  IconCart,
  IconCartReady,
  IconHeart,
  IconHeartFilled,
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
  if (path.startsWith('/shop')) import('../pages/Shop');
  else if (path.startsWith('/wishlist')) import('../pages/Wishlist');
  else if (path.startsWith('/repair')) import('../pages/Repair');
  else if (path.startsWith('/account')) import('../pages/Account');
}

function activeKey(pathname) {
  if (pathname === '/shop' || pathname.startsWith('/shop/')) return 'shop';
  if (pathname.startsWith('/wishlist')) return 'wishlist';
  if (pathname.startsWith('/repair')) return 'repair';
  if (pathname.startsWith('/account')) return 'account';
  return null;
}

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { count: cartCount, setOpen: setCartOpen, open: cartOpen } = useCart();
  const { count: wishlistCount } = useWishlistIds();
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
      aria-label="Quick navigation"
      aria-hidden={cartOpen ? 'true' : undefined}
    >
      {/* Repair nestled in the saddle cutout — part of the navbar composition */}
      <NavLink
        to="/repair"
        className={() =>
          `mobile-bottom-nav__fab mobile-bottom-nav__item--morph${active === 'repair' ? ' is-active' : ''}`
        }
        tabIndex={cartOpen ? -1 : undefined}
        aria-label="Repair"
        onPointerDown={() => prefetchRoute('/repair')}
      >
        <span className="mobile-bottom-nav__fab-orb">
          <MorphIcon
            className="mobile-bottom-nav__morph"
            idle={<IconRepair size={22} />}
            hover={<IconRepairBolt size={22} />}
          />
        </span>
        <span className="mobile-bottom-nav__fab-label">Repair</span>
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
            <span className="mobile-bottom-nav__label">Shop</span>
          </NavLink>

          <NavLink
            to="/wishlist"
            className={() => tabClass('wishlist')}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.wishlist = el;
            }}
            onPointerDown={() => prefetchRoute('/wishlist')}
          >
            <span className="mobile-bottom-nav__icon-wrap mobile-bottom-nav__icon">
              <MorphIcon
                className="mobile-bottom-nav__morph"
                idle={<IconHeart size={22} />}
                hover={<IconHeartFilled size={22} />}
              />
              {wishlistCount > 0 && (
                <span className="mobile-bottom-nav__badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>
              )}
            </span>
            <span className="mobile-bottom-nav__label">Wishlist</span>
          </NavLink>

          <div className="mobile-bottom-nav__fab-slot" aria-hidden="true" />

          <button
            type="button"
            className={tabClass('cart')}
            onClick={() => {
              flashCart();
              setCartOpen(true);
            }}
            aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'}
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
            <span className="mobile-bottom-nav__label">Cart</span>
          </button>

          <button
            type="button"
            className={tabClass('account')}
            onClick={openAccount}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.account = el;
            }}
          >
            <span className="mobile-bottom-nav__icon">
              <MorphIcon
                className="mobile-bottom-nav__morph"
                idle={<IconUser size={22} />}
                hover={<IconUserFilled size={22} />}
              />
            </span>
            <span className="mobile-bottom-nav__label">Account</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
