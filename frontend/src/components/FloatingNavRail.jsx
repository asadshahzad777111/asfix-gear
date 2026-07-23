import { startTransition, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import useHeaderScrollHide from '../hooks/useHeaderScrollHide';
import {
  IconClose,
  IconHome,
  IconHomeFilled,
  IconMail,
  IconNavDots,
  IconSettings,
  IconSettingsSpin,
  IconShop,
  IconShopBag,
  IconUser,
  IconUserFilled,
} from './nav/NavIcons';
import MorphIcon from './nav/MorphIcon';
import './floating-nav-rail.css';

function activeKey(pathname) {
  if (pathname === '/') return 'home';
  if (pathname === '/shop' || pathname.startsWith('/shop/')) return 'shop';
  if (pathname.startsWith('/contact')) return 'contact';
  if (pathname.startsWith('/account/settings')) return 'settings';
  if (pathname.startsWith('/account')) return 'account';
  return null;
}

/**
 * Laptop/desktop floating rail — visible only while the main header is tucked.
 * Collapsed FAB expands into a scalloped vertical stack (Close · Home · Shop · Contact · Account · Settings).
 * Hidden on mobile (bottom dock owns that IA) and on admin/auth/gaming via App chrome gates.
 */
export default function FloatingNavRail() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { open: cartOpen } = useCart();
  const { isCustomer } = useAuth();
  const [menuBlocked, setMenuBlocked] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const headerHidden = useHeaderScrollHide(cartOpen || menuBlocked);
  const active = activeKey(location.pathname);
  const visible = headerHidden && !cartOpen && !menuBlocked;

  useEffect(() => {
    const sync = () => setMenuBlocked(document.body.classList.contains('nav-open'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Re-open the stack whenever the rail reappears after a header reveal.
  useEffect(() => {
    if (visible) setExpanded(true);
    else setExpanded(false);
  }, [visible]);

  const goAccount = () => {
    startTransition(() => {
      if (isCustomer) navigate('/account');
      else navigate('/account/login');
    });
  };

  const goSettings = () => {
    startTransition(() => {
      if (isCustomer) navigate('/account/settings');
      else navigate('/account/login');
    });
  };

  const itemClass = (key) =>
    ['fnav-rail__btn', active === key ? 'is-active' : ''].filter(Boolean).join(' ');

  return (
    <div
      className={[
        'fnav-rail',
        visible ? 'is-visible' : '',
        expanded ? 'is-expanded' : 'is-collapsed',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden={visible ? undefined : 'true'}
    >
      {!expanded ? (
        <button
          type="button"
          className="fnav-rail__fab"
          onClick={() => setExpanded(true)}
          tabIndex={visible ? 0 : -1}
          aria-label={t('nav.floatingOpen')}
          aria-expanded="false"
        >
          <IconNavDots size={20} />
        </button>
      ) : (
        <nav className="fnav-rail__stack" aria-label={t('nav.floatingNav')}>
          <button
            type="button"
            className="fnav-rail__btn fnav-rail__btn--close"
            onClick={() => setExpanded(false)}
            tabIndex={visible ? 0 : -1}
            aria-label={t('nav.floatingClose')}
          >
            <IconClose size={18} />
          </button>

          <NavLink
            to="/"
            end
            className={() => itemClass('home')}
            tabIndex={visible ? 0 : -1}
            aria-label={t('nav.home')}
            onClick={() => setExpanded(false)}
          >
            <MorphIcon
              className="fnav-rail__morph"
              idle={<IconHome size={18} />}
              hover={<IconHomeFilled size={18} />}
            />
          </NavLink>

          <NavLink
            to="/shop"
            className={() => itemClass('shop')}
            tabIndex={visible ? 0 : -1}
            aria-label={t('nav.shop')}
            onClick={() => setExpanded(false)}
          >
            <MorphIcon
              className="fnav-rail__morph"
              idle={<IconShop size={18} />}
              hover={<IconShopBag size={18} />}
            />
          </NavLink>

          <NavLink
            to="/contact"
            className={() => itemClass('contact')}
            tabIndex={visible ? 0 : -1}
            aria-label={t('nav.contact')}
            onClick={() => setExpanded(false)}
          >
            <IconMail size={18} />
          </NavLink>

          <button
            type="button"
            className={itemClass('account')}
            onClick={() => {
              goAccount();
              setExpanded(false);
            }}
            tabIndex={visible ? 0 : -1}
            aria-label={t('nav.myAccount')}
          >
            <MorphIcon
              className="fnav-rail__morph"
              idle={<IconUser size={18} />}
              hover={<IconUserFilled size={18} />}
            />
          </button>

          <button
            type="button"
            className={itemClass('settings')}
            onClick={() => {
              goSettings();
              setExpanded(false);
            }}
            tabIndex={visible ? 0 : -1}
            aria-label={t('nav.settings')}
          >
            <MorphIcon
              className="fnav-rail__morph"
              idle={<IconSettings size={18} />}
              hover={<IconSettingsSpin size={18} />}
            />
          </button>
        </nav>
      )}
    </div>
  );
}
