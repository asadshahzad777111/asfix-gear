import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminDashboard({ onNavigate, showShopControl = false }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getAdminDashboardStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load stats'); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <div className="wp-notice wp-notice--error">{error}</div>;
  }

  if (!stats) {
    return <div className="wp-loading">Loading dashboard…</div>;
  }

  const cards = [
    { label: 'Products', value: stats.products, tab: 'products' },
    { label: 'Pending orders', value: stats.pendingOrders, tab: 'orders', hint: `${stats.orders} total` },
    { label: 'Low stock', value: stats.lowStock, tab: 'stock', hint: `${stats.outOfStock} out of stock` },
    { label: 'On sale', value: stats.onSale, tab: 'products', filter: { onSale: 'true' } },
    { label: 'Repair intake', value: stats.bookings, tab: 'bookings', hint: `${stats.pendingBookings} pending` },
    { label: 'Unread messages', value: stats.unreadMessages, tab: 'messages' },
  ];

  return (
    <div className="wp-dashboard">
      <div className="wp-dashboard-grid">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            className="wp-dashboard-card"
            onClick={() => onNavigate(card.tab, card.filter)}
          >
            <span className="wp-dashboard-value">{card.value}</span>
            <span className="wp-dashboard-label">{card.label}</span>
            {card.hint ? <span className="wp-dashboard-hint">{card.hint}</span> : null}
          </button>
        ))}
      </div>
      <div className="wp-postbox" style={{ marginTop: '1rem' }}>
        <div className="wp-postbox-head">Quick actions</div>
        <div className="wp-postbox-body wp-dashboard-actions">
          <button type="button" className="wp-button" onClick={() => onNavigate('add')}>Add new product</button>
          {showShopControl ? (
            <button type="button" className="wp-button wp-button--secondary" onClick={() => onNavigate('hero')}>
              Home Ads (hero photos)
            </button>
          ) : null}
          <button type="button" className="wp-button wp-button--secondary" onClick={() => onNavigate('orders')}>View orders</button>
          <button type="button" className="wp-button wp-button--secondary" onClick={() => onNavigate('categories')}>Categories</button>
        </div>
      </div>
    </div>
  );
}
