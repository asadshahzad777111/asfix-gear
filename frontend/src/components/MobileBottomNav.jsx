import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlistIds } from '../hooks/useWishlist';
import { IconCart, IconHeart, IconShop, IconUser } from './nav/NavIcons';
import './mobile-bottom-nav.css';

function IconRepair({ size = 18 }) {
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
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false });
  const [ripple, setRipple] = useState(null);
  const [pressed, setPressed] = useState(null);

  const openAccount = () => {
    if (isCustomer) navigate('/account');
    else navigate('/account/login');
  };

  useLayoutEffect(() => {
    const measure = () => {
      if (!active || active === 'repair' || cartOpen) {
        setPill((p) => ({ ...p, ready: false }));
        return;
      }
      const el = tabRefs.current[active];
      const row = itemsRef.current;
      if (!el || !row) return;
      const rowBox = row.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setPill({
        x: box.left - rowBox.left + box.width * 0.14,
        w: box.width * 0.72,
        ready: true,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, cartOpen, wishlistCount, cartCount]);

  const burst = (key, el) => {
    if (reduceMotion || !el) return;
    const row = itemsRef.current;
    if (!row) return;
    const rowBox = row.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setRipple({
      key,
      x: box.left - rowBox.left + box.width / 2,
      y: box.top - rowBox.top + box.height / 2,
      id: Date.now(),
    });
  };

  const pressHandlers = (key) => ({
    onPointerDown: () => setPressed(key),
    onPointerUp: () => setPressed(null),
    onPointerCancel: () => setPressed(null),
    onPointerLeave: () => setPressed(null),
  });

  const tabClass = (key) =>
    [
      'mobile-bottom-nav__item',
      active === key ? 'is-active' : '',
      pressed === key ? 'is-cut' : '',
    ]
      .filter(Boolean)
      .join(' ');

  const iconMotion = (key) =>
    active === key && !reduceMotion ? { y: -1, scale: 1.05 } : { y: 0, scale: 1 };

  return (
    <nav
      className={`mobile-bottom-nav${cartOpen ? ' is-cart-open' : ''}${active === 'repair' ? ' is-repair-active' : ''}`}
      aria-label="Quick navigation"
      aria-hidden={cartOpen ? 'true' : undefined}
    >
      <div className="mobile-bottom-nav__dock">
        {/* Smaller center cutout for the Repair FAB */}
        <svg
          className="mobile-bottom-nav__cutout"
          viewBox="0 0 390 72"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="mobile-bottom-nav__cutout-fill"
            d="M0 18
               C0 8 8 0 18 0
               H156
               C163 0 168 5 171 11
               C177 24 187 34 195 34
               C203 34 213 24 219 11
               C222 5 227 0 234 0
               H372
               C382 0 390 8 390 18
               V72 H0 Z"
          />
        </svg>

        <div className="mobile-bottom-nav__items" ref={itemsRef}>
          {pill.ready && (
            <motion.span
              className="mobile-bottom-nav__pill"
              aria-hidden="true"
              initial={false}
              animate={{ x: pill.x, width: pill.w, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }
              }
            />
          )}

          {ripple && (
            <motion.span
              key={ripple.id}
              className="mobile-bottom-nav__ripple"
              style={{ left: ripple.x, top: ripple.y }}
              initial={{ scale: 0.2, opacity: 0.45 }}
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
            onClick={(e) => burst('shop', e.currentTarget)}
            {...pressHandlers('shop')}
          >
            <span className="mobile-bottom-nav__cut">
              <motion.span
                className="mobile-bottom-nav__icon"
                animate={iconMotion('shop')}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              >
                <IconShop size={20} />
              </motion.span>
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
            onClick={(e) => burst('wishlist', e.currentTarget)}
            {...pressHandlers('wishlist')}
          >
            <span className="mobile-bottom-nav__cut">
              <motion.span
                className="mobile-bottom-nav__icon-wrap mobile-bottom-nav__icon"
                animate={iconMotion('wishlist')}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              >
                <IconHeart size={20} />
                {wishlistCount > 0 && (
                  <span className="mobile-bottom-nav__badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>
                )}
              </motion.span>
            </span>
            <span className="mobile-bottom-nav__label">Wishlist</span>
          </NavLink>

          <div className="mobile-bottom-nav__fab-slot" aria-hidden="true" />

          <button
            type="button"
            className={tabClass('cart')}
            onClick={(e) => {
              burst('cart', e.currentTarget);
              setCartOpen(true);
            }}
            aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.cart = el;
            }}
            {...pressHandlers('cart')}
          >
            <span className="mobile-bottom-nav__cut">
              <motion.span
                className="mobile-bottom-nav__icon-wrap mobile-bottom-nav__icon"
                whileTap={reduceMotion ? undefined : { scale: 0.9 }}
              >
                <IconCart size={20} />
                {cartCount > 0 && (
                  <span className="mobile-bottom-nav__badge">{cartCount > 99 ? '99+' : cartCount}</span>
                )}
              </motion.span>
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
            {...pressHandlers('account')}
          >
            <span className="mobile-bottom-nav__cut">
              <motion.span
                className="mobile-bottom-nav__icon"
                animate={iconMotion('account')}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                whileTap={reduceMotion ? undefined : { scale: 0.9 }}
              >
                <IconUser size={20} />
              </motion.span>
            </span>
            <span className="mobile-bottom-nav__label">Account</span>
          </button>
        </div>
      </div>

      <NavLink
        to="/repair"
        className={() =>
          [
            'mobile-bottom-nav__fab',
            active === 'repair' ? 'is-active' : '',
            pressed === 'repair' ? 'is-cut' : '',
          ]
            .filter(Boolean)
            .join(' ')
        }
        tabIndex={cartOpen ? -1 : undefined}
        aria-label="Repair"
        onClick={(e) => burst('repair', e.currentTarget)}
        {...pressHandlers('repair')}
      >
        <motion.span
          className="mobile-bottom-nav__fab-orb"
          whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          animate={
            reduceMotion
              ? undefined
              : active === 'repair'
                ? { scale: 1.04, y: -1 }
                : { scale: 1, y: 0 }
          }
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        >
          <IconRepair size={18} />
        </motion.span>
        <span className="mobile-bottom-nav__fab-label">Repair</span>
      </NavLink>
    </nav>
  );
}
