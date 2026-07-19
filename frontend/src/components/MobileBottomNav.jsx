import { startTransition, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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

const POP = {
  initial: { opacity: 0, scale: 0.2, y: 36 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.55, y: 18 },
};

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
  const [pop, setPop] = useState(null);
  /** Brief mark on Cart (not a route) */
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

  const firePop = (key, el) => {
    if (reduceMotion || !el) return;
    const row = itemsRef.current;
    if (!row) return;
    const rowBox = row.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setPop({
      key,
      id: Date.now(),
      x: box.left - rowBox.left + box.width / 2,
      y: box.top - rowBox.top + box.height * 0.35,
    });
  };

  const flashCart = () => {
    setFlashKey('cart');
    window.setTimeout(() => setFlashKey(null), 480);
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
        markedKey && markedKey !== 'repair' ? 'has-side-mark' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Quick navigation"
      aria-hidden={cartOpen ? 'true' : undefined}
    >
      {/* Repair floats fully above the dock — never joined to the top edge */}
      <NavLink
        to="/repair"
        className={() =>
          `mobile-bottom-nav__fab mobile-bottom-nav__item--morph${active === 'repair' ? ' is-active' : ''}`
        }
        tabIndex={cartOpen ? -1 : undefined}
        aria-label="Repair"
        onPointerDown={() => prefetchRoute('/repair')}
        onClick={() => {
          if (!reduceMotion) {
            setPop({ key: 'repair', id: Date.now(), x: 0, y: 0 });
          }
        }}
      >
        <AnimatePresence>
          {pop?.key === 'repair' && (
            <motion.span
              key={pop.id}
              className="mobile-bottom-nav__fab-pop"
              initial={{ opacity: 0.95, scale: 0.2, y: 28 }}
              animate={{ opacity: 0, scale: 2.1, y: -16 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => setPop(null)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
        <motion.span
          className="mobile-bottom-nav__fab-orb"
          whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          animate={
            reduceMotion
              ? undefined
              : active === 'repair'
                ? { scale: 1.06, y: -2 }
                : { scale: 1, y: 0 }
          }
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        >
          <MorphIcon
            className="mobile-bottom-nav__morph"
            idle={<IconRepair size={22} />}
            hover={<IconRepairBolt size={22} />}
          />
        </motion.span>
        <span className="mobile-bottom-nav__fab-label">Repair</span>
      </NavLink>

      <div className="mobile-bottom-nav__dock">
        <div className="mobile-bottom-nav__glass" aria-hidden="true" />

        <div className="mobile-bottom-nav__items" ref={itemsRef}>
          {/* Settled active orb — pops in from below, stays clear of dock rim */}
          <AnimatePresence mode="wait">
            {mark.ready && (
              <motion.span
                key={`mark-${markedKey}`}
                className="mobile-bottom-nav__mark"
                aria-hidden="true"
                style={{ left: mark.x, x: '-50%' }}
                initial={reduceMotion ? false : POP.initial}
                animate={POP.animate}
                exit={reduceMotion ? undefined : POP.exit}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 22, mass: 0.7 }
                }
              />
            )}
          </AnimatePresence>

          {/* One-shot pop burst that emerges from outside on every tap */}
          <AnimatePresence>
            {pop && pop.key !== 'repair' && (
              <motion.span
                key={pop.id}
                className="mobile-bottom-nav__pop"
                style={{ left: pop.x, top: pop.y }}
                initial={reduceMotion ? false : { opacity: 0.9, scale: 0.15, y: 42 }}
                animate={{ opacity: 0, scale: 1.85, y: -8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={() => setPop(null)}
                aria-hidden="true"
              />
            )}
          </AnimatePresence>

          <NavLink
            to="/shop"
            className={() => tabClass('shop')}
            tabIndex={cartOpen ? -1 : undefined}
            ref={(el) => {
              tabRefs.current.shop = el;
            }}
            onPointerDown={() => prefetchRoute('/shop')}
            onClick={(e) => firePop('shop', e.currentTarget)}
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
            onClick={(e) => firePop('wishlist', e.currentTarget)}
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
            onClick={(e) => {
              firePop('cart', e.currentTarget);
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
            onClick={(e) => {
              firePop('account', e.currentTarget);
              openAccount();
            }}
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
