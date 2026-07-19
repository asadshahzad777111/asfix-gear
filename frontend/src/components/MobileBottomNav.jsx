import { startTransition, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlistIds } from '../hooks/useWishlist';
import { IconCart, IconHeart, IconShop, IconUser } from './nav/NavIcons';
import './mobile-bottom-nav.css';

/** Warm route chunks on press so navigation feels instant. */
function prefetchRoute(path) {
  if (path.startsWith('/shop')) import('../pages/Shop');
  else if (path.startsWith('/wishlist')) import('../pages/Wishlist');
  else if (path.startsWith('/repair')) import('../pages/Repair');
  else if (path.startsWith('/account')) import('../pages/Account');
}

function IconRepair({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
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
  const reduceMotion = useReducedMotion();
  const { count: cartCount, setOpen: setCartOpen, open: cartOpen } = useCart();
  const { count: wishlistCount } = useWishlistIds();
  const { isCustomer } = useAuth();

  const active = activeKey(location.pathname);
  const itemsRef = useRef(null);
  const tabRefs = useRef({});
  const [mark, setMark] = useState({ x: 0, ready: false });
  const [ripple, setRipple] = useState(null);
  /** Brief cutout mark on Cart (not a route) */
  const [flashKey, setFlashKey] = useState(null);

  const openAccount = () => {
    startTransition(() => {
      if (isCustomer) navigate('/account');
      else navigate('/account/login');
    });
  };

  const markedKey = flashKey || active;

  useLayoutEffect(() => {
    const measure = () => {
      if (!markedKey || markedKey === 'repair' || cartOpen) {
        setMark((m) => ({ ...m, ready: false }));
        return;
      }
      const el = tabRefs.current[markedKey];
      const row = itemsRef.current;
      if (!el || !row) return;
      const rowBox = row.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setMark({
        x: box.left - rowBox.left + box.width / 2,
        ready: true,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [markedKey, cartOpen, wishlistCount, cartCount]);

  const burst = (key, el) => {
    if (reduceMotion || !el) return;
    const row = itemsRef.current;
    if (!row) return;
    const rowBox = row.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setRipple({
      x: box.left - rowBox.left + box.width / 2,
      y: box.top - rowBox.top + box.height / 2,
      id: Date.now(),
    });
  };

  const flashCart = () => {
    setFlashKey('cart');
    window.setTimeout(() => setFlashKey(null), 420);
  };

  const tabClass = (key) =>
    [
      'mobile-bottom-nav__item',
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
        markedKey && markedKey !== 'repair' ? 'has-side-mark' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Quick navigation"
      aria-hidden={cartOpen ? 'true' : undefined}
    >
      <div className="mobile-bottom-nav__dock">
        {/* Frosted glass shell — cutout mask (blurred, not clear glass) */}
        <div className="mobile-bottom-nav__glass" aria-hidden="true" />
        <svg
          className="mobile-bottom-nav__cutout"
          viewBox="0 0 390 72"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="mobile-bottom-nav__cutout-fill"
            d="M0 28
               C0 12.5 12.5 0 28 0
               H146
               C155 0 161 7 165 16
               C172 32 183 42 195 42
               C207 42 218 32 225 16
               C229 7 235 0 244 0
               H362
               C377.5 0 390 12.5 390 28
               V72 H0 Z"
          />
        </svg>

        <div className="mobile-bottom-nav__items" ref={itemsRef}>
          {/* Slideshow mark — springs between tabs like a slide frame */}
          {mark.ready && (
            <motion.span
              className="mobile-bottom-nav__mark"
              aria-hidden="true"
              initial={false}
              style={{ x: '-50%' }}
              animate={
                reduceMotion
                  ? { left: mark.x, opacity: 1, scaleX: 1, scaleY: 1 }
                  : {
                      left: mark.x,
                      opacity: 1,
                      scaleX: [1.32, 1],
                      scaleY: [0.88, 1],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      left: {
                        type: 'spring',
                        stiffness: 340,
                        damping: 28,
                        mass: 0.75,
                      },
                      scaleX: {
                        duration: 0.36,
                        ease: [0.22, 1, 0.36, 1],
                      },
                      scaleY: {
                        duration: 0.36,
                        ease: [0.22, 1, 0.36, 1],
                      },
                    }
              }
            />
          )}

          {ripple && (
            <motion.span
              key={ripple.id}
              className="mobile-bottom-nav__ripple"
              style={{ left: ripple.x, top: ripple.y }}
              initial={{ scale: 0.2, opacity: 0.4 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              onAnimationComplete={() => setRipple(null)}
              aria-hidden="true"
            />
          )}

          <NavLink
            to="/shop"
            className={() => tabClass('shop')}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.shop = el;
            }}
            onPointerDown={() => prefetchRoute('/shop')}
            onClick={(e) => burst('shop', e.currentTarget)}
          >
            <span className="mobile-bottom-nav__icon">
              <IconShop size={22} />
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
            onClick={(e) => burst('wishlist', e.currentTarget)}
          >
            <span className="mobile-bottom-nav__icon-wrap mobile-bottom-nav__icon">
              <IconHeart size={22} />
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
            onClick={(e) => {
              burst('cart', e.currentTarget);
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
              <IconCart size={22} />
              {cartCount > 0 && (
                <span className="mobile-bottom-nav__badge">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </span>
            <span className="mobile-bottom-nav__label">Cart</span>
          </button>

          <button
            type="button"
            className={tabClass('account')}
            onClick={(e) => {
              burst('account', e.currentTarget);
              openAccount();
            }}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.account = el;
            }}
          >
            <span className="mobile-bottom-nav__icon">
              <IconUser size={22} />
            </span>
            <span className="mobile-bottom-nav__label">Account</span>
          </button>
        </div>
      </div>

      <NavLink
        to="/repair"
        className={() =>
          `mobile-bottom-nav__fab${active === 'repair' ? ' is-active' : ''}`
        }
        tabIndex={cartOpen ? -1 : undefined}
        aria-label="Repair"
        onPointerDown={() => prefetchRoute('/repair')}
        onClick={(e) => burst('repair', e.currentTarget)}
      >
        <motion.span
          className="mobile-bottom-nav__fab-orb"
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
          animate={
            reduceMotion
              ? undefined
              : active === 'repair'
                ? { scale: 1.04, y: -1 }
                : { scale: 1, y: 0 }
          }
          transition={{ type: 'tween', duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <IconRepair size={22} />
        </motion.span>
        <span className="mobile-bottom-nav__fab-label">Repair</span>
      </NavLink>
    </nav>
  );
}
