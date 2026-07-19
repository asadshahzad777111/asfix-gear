import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlistIds } from '../hooks/useWishlist';
import { IconCart, IconHeart, IconSearch, IconShop, IconUser } from './nav/NavIcons';
import './mobile-bottom-nav.css';

export const FOCUS_SEARCH_EVENT = 'asfix-focus-search';

function focusSiteSearch() {
  window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
  const input =
    document.querySelector('.dx-search--mobile input')
    || document.querySelector('.dx-search--desktop input')
    || document.querySelector('.navbar-search input')
    || document.querySelector('input[type="search"]');
  if (!input) return;
  const header = document.querySelector('.navbar');
  header?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    input.focus({ preventScroll: true });
    try {
      input.select?.();
    } catch {
      /* ignore */
    }
  }, 280);
}

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { count: cartCount, setOpen: setCartOpen } = useCart();
  const { count: wishlistCount } = useWishlistIds();
  const { isCustomer } = useAuth();

  const path = location.pathname;
  const onShop = path === '/shop' || path.startsWith('/shop/');
  const onWishlist = path.startsWith('/wishlist');
  const onAccount = path.startsWith('/account');

  const openAccount = () => {
    if (isCustomer) navigate('/account');
    else navigate('/account/login');
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Quick navigation">
      <NavLink
        to="/shop"
        className={() => `mobile-bottom-nav__item${onShop ? ' is-active' : ''}`}
        end={false}
      >
        <IconShop size={22} />
        <span>Shop</span>
      </NavLink>

      <NavLink
        to="/wishlist"
        className={() => `mobile-bottom-nav__item${onWishlist ? ' is-active' : ''}`}
      >
        <span className="mobile-bottom-nav__icon-wrap">
          <IconHeart size={22} />
          {wishlistCount > 0 && (
            <span className="mobile-bottom-nav__badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>
          )}
        </span>
        <span>Wishlist</span>
      </NavLink>

      <button
        type="button"
        className="mobile-bottom-nav__item"
        onClick={() => setCartOpen(true)}
        aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'}
      >
        <span className="mobile-bottom-nav__icon-wrap">
          <IconCart size={22} />
          {cartCount > 0 && (
            <span className="mobile-bottom-nav__badge">{cartCount > 99 ? '99+' : cartCount}</span>
          )}
        </span>
        <span>Cart</span>
      </button>

      <button
        type="button"
        className={`mobile-bottom-nav__item${onAccount ? ' is-active' : ''}`}
        onClick={openAccount}
      >
        <IconUser size={22} />
        <span>Account</span>
      </button>

      <button type="button" className="mobile-bottom-nav__item" onClick={focusSiteSearch}>
        <IconSearch size={22} />
        <span>Search</span>
      </button>
    </nav>
  );
}
