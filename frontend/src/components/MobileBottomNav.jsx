import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlistIds } from '../hooks/useWishlist';
import { IconCart, IconHeart, IconShop, IconUser } from './nav/NavIcons';
import './mobile-bottom-nav.css';

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
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false });
  const [ripple, setRipple] = useState(null);

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
        x: box.left - rowBox.left + box.width * 0.12,
        w: box.width * 0.76,
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

  const tabClass = (key) =>
    `mobile-bottom-nav__item${active === key ? ' is-active' : ''}`;

  return (
    <nav
      className={`mobile-bottom-nav${cartOpen ? ' is-cart-open' : ''}${active === 'repair' ? ' is-repair-active' : ''}`}
      aria-label="Quick navigation"
      aria-hidden={cartOpen ? 'true' : undefined}
    >
      <div className="mobile-bottom-nav__dock">
        {/* Cutout silhouette behind the elevated Repair FAB */}
        <svg
          className="mobile-bottom-nav__cutout"
          viewBox="0 0 390 72"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="mobile-bottom-nav__cutout-fill"
            d="M0 20
               C0 9 9 0 20 0
               H148
               C156 0 162 6 166 14
               C174 32 186 44 195 44
               C204 44 216 32 224 14
               C228 6 234 0 242 0
               H370
               C381 0 390 9 390 20
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
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
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
          >
            <motion.span
              className="mobile-bottom-nav__icon"
              animate={active === 'shop' && !reduceMotion ? { y: -2, scale: 1.08 } : { y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            >
              <IconShop size={22} />
            </motion.span>
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
          >
            <motion.span
              className="mobile-bottom-nav__icon-wrap mobile-bottom-nav__icon"
              animate={active === 'wishlist' && !reduceMotion ? { y: -2, scale: 1.08 } : { y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            >
              <IconHeart size={22} />
              {wishlistCount > 0 && (
                <span className="mobile-bottom-nav__badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>
              )}
            </motion.span>
            <span className="mobile-bottom-nav__label">Wishlist</span>
          </NavLink>

          {/* Spacer for cutout / FAB */}
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
          >
            <motion.span
              className="mobile-bottom-nav__icon-wrap mobile-bottom-nav__icon"
              whileTap={reduceMotion ? undefined : { scale: 0.88 }}
            >
              <IconCart size={22} />
              {cartCount > 0 && (
                <span className="mobile-bottom-nav__badge">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </motion.span>
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
            <motion.span
              className="mobile-bottom-nav__icon"
              animate={active === 'account' && !reduceMotion ? { y: -2, scale: 1.08 } : { y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              whileTap={reduceMotion ? undefined : { scale: 0.88 }}
            >
              <IconUser size={22} />
            </motion.span>
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
      >
        <motion.span
          className="mobile-bottom-nav__fab-orb"
          whileTap={reduceMotion ? undefined : { scale: 0.9 }}
          animate={
            reduceMotion
              ? undefined
              : active === 'repair'
                ? { scale: 1.06, y: -2 }
                : { scale: 1, y: 0 }
          }
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          <IconRepair size={22} />
        </motion.span>
        <span className="mobile-bottom-nav__fab-label">Repair</span>
      </NavLink>
    </nav>
  );
}
