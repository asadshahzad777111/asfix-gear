import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { count: cartCount, setOpen: setCartOpen, open: cartOpen } = useCart();
  const { count: wishlistCount } = useWishlistIds();
  const { isCustomer } = useAuth();

  const path = location.pathname;
  const onShop = path === '/shop' || path.startsWith('/shop/');
  const onWishlist = path.startsWith('/wishlist');
  const onRepair = path.startsWith('/repair');
  const onAccount = path.startsWith('/account');

  const openAccount = () => {
    if (isCustomer) navigate('/account');
    else navigate('/account/login');
  };

  return (
    <nav
      className={`mobile-bottom-nav${cartOpen ? ' is-cart-open' : ''}`}
      aria-label="Quick navigation"
      aria-hidden={cartOpen ? 'true' : undefined}
    >
      <NavLink
        to="/shop"
        className={() => `mobile-bottom-nav__item${onShop ? ' is-active' : ''}`}
        tabIndex={cartOpen ? -1 : undefined}
      >
        <IconShop size={22} />
        <span>Shop</span>
      </NavLink>

      <NavLink
        to="/wishlist"
        className={() => `mobile-bottom-nav__item${onWishlist ? ' is-active' : ''}`}
        tabIndex={cartOpen ? -1 : undefined}
      >
        <span className="mobile-bottom-nav__icon-wrap">
          <IconHeart size={22} />
          {wishlistCount > 0 && (
            <span className="mobile-bottom-nav__badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>
          )}
        </span>
        <span>Wishlist</span>
      </NavLink>

      <NavLink
        to="/repair"
        className={() => `mobile-bottom-nav__item mobile-bottom-nav__item--repair${onRepair ? ' is-active' : ''}`}
        tabIndex={cartOpen ? -1 : undefined}
      >
        <span className="mobile-bottom-nav__repair-orb">
          <IconRepair size={20} />
        </span>
        <span>Repair</span>
      </NavLink>

      <button
        type="button"
        className="mobile-bottom-nav__item"
        onClick={() => setCartOpen(true)}
        aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'}
        tabIndex={cartOpen ? -1 : undefined}
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
        tabIndex={cartOpen ? -1 : undefined}
      >
        <IconUser size={22} />
        <span>Account</span>
      </button>
    </nav>
  );
}
