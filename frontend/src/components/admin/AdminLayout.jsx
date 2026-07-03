import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { roleLabel } from '../../config/permissions';

const PRODUCT_SUB = [
  { id: 'products', label: 'All Products' },
  { id: 'add', label: 'Add new product' },
  { id: 'categories', label: 'Categories' },
  { id: 'stock', label: 'Stock' },
];

export default function AdminLayout({
  user,
  logout,
  tab,
  setTab,
  counts,
  flags,
  pageTitle,
  children,
  onEditCancel,
  editingProduct,
}) {
  const { t } = useTranslation();
  const { products = 0, orders = 0, bookings = 0, pendingOrders = 0 } = counts || {};
  const { showSales, showAdminMgmt, showShopControl } = flags || {};
  const [menuOpen, setMenuOpen] = useState(false);

  const goTab = (next) => {
    if (next === 'add' && onEditCancel) onEditCancel();
    setTab(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  };

  const navItem = (id, label, badge) => (
    <button
      key={id}
      type="button"
      className={`wp-menu-link ${tab === id ? 'is-active' : ''}`}
      onClick={() => goTab(id)}
    >
      <span className="wp-menu-text">{label}</span>
      {badge ? <span className="wp-menu-badge">{badge}</span> : null}
    </button>
  );

  return (
    <div className="wp-admin-shell">
      <header className="wp-admin-bar">
        <div className="wp-admin-bar-left">
          <button
            type="button"
            className={`wp-admin-menu-toggle ${menuOpen ? 'is-active' : ''}`}
            aria-expanded={menuOpen}
            aria-controls="wp-admin-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
          <span className="wp-admin-bar-site">AsFix & Gear</span>
          <span className="wp-admin-bar-live">Live</span>
          <Link to="/" className="wp-admin-bar-link" target="_blank" rel="noreferrer">
            View site
          </Link>
        </div>
        <div className="wp-admin-bar-right">
          <span className="wp-admin-bar-user">
            Howdy, {user?.username || 'Staff'} ({roleLabel(user?.role)})
          </span>
          <button type="button" className="wp-admin-bar-link" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="wp-admin-frame">
        <aside id="wp-admin-menu" className={`wp-admin-menu ${menuOpen ? 'is-open' : ''}`} aria-label="Admin menu">
          <div className="wp-menu-section">
            {navItem('dashboard', 'Dashboard')}
            <p className="wp-menu-heading">Shop</p>
            <div className={`wp-menu-item ${['products', 'add', 'stock', 'categories'].includes(tab) ? 'is-open' : ''}`}>
              <button
                type="button"
                className={`wp-menu-link wp-menu-link--parent ${['products', 'add', 'stock', 'categories'].includes(tab) ? 'is-active' : ''}`}
                onClick={() => goTab('products')}
              >
                <span className="wp-menu-text">Products</span>
                <span className="wp-menu-badge">{products}</span>
              </button>
              <div className="wp-submenu">
                {PRODUCT_SUB.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`wp-submenu-link ${tab === item.id ? 'is-active' : ''}`}
                    onClick={() => goTab(item.id)}
                  >
                    {item.id === 'add' && editingProduct ? 'Edit product' : item.label}
                  </button>
                ))}
              </div>
            </div>
            {navItem('orders', 'Orders', pendingOrders > 0 ? pendingOrders : orders || null)}
            {navItem('bookings', 'Repair Intake', bookings || null)}
            {navItem('messages', t('admin.messages'))}
          </div>

          {(showSales || showAdminMgmt || showShopControl) && (
            <div className="wp-menu-section">
              <p className="wp-menu-heading">Manage</p>
              {showSales && navItem('sales', t('sales.tab'))}
              {showAdminMgmt && navItem('admins', t('team.manageTeam'))}
              {showShopControl && navItem('settings', 'Settings')}
              {showShopControl && navItem('payments', 'Payments')}
            </div>
          )}
        </aside>

        <main className="wp-admin-content">
          <div className="wp-admin-content-head">
            <h1 className="wp-admin-page-title">{pageTitle}</h1>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
