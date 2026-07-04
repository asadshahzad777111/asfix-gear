import { Fragment, useEffect, useMemo, useState } from 'react';
import { api, formatPrice } from '../../api/client';

function SortHeader({ label, sortKey, activeKey, dir, onSort }) {
  const active = activeKey === sortKey;
  return (
    <th>
      <button
        type="button"
        className={`wp-sortable-th${active ? ' is-active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="wp-sort-indicator" aria-hidden>
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function formatOrderDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'last_order', dir: 'desc' });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getCustomersSummary()
      .then((rows) => {
        if (!cancelled) setCustomers(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load customers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSort = (key) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const totals = useMemo(() => {
    return customers.reduce(
      (acc, c) => ({
        orders: acc.orders + (c.order_count || 0),
        spent: acc.spent + (c.total_spent || 0),
      }),
      { orders: 0, spent: 0 },
    );
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = customers;
    if (q) {
      rows = rows.filter((c) => {
        const hay = `${c.name} ${c.email} ${c.phone}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') {
        return mul * String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sort.key === 'orders') {
        return mul * ((a.order_count || 0) - (b.order_count || 0));
      }
      if (sort.key === 'spent') {
        return mul * ((a.total_spent || 0) - (b.total_spent || 0));
      }
      return mul * String(a.last_order_at || '').localeCompare(String(b.last_order_at || ''));
    });
  }, [customers, search, sort]);

  if (loading) {
    return <div className="wp-loading">Loading customers…</div>;
  }

  if (error) {
    return <div className="wp-empty"><p>{error}</p></div>;
  }

  return (
    <>
      <div className="wp-customers-summary">
        <div className="wp-customers-stat">
          <span className="wp-customers-stat-label">Customers</span>
          <strong>{customers.length}</strong>
        </div>
        <div className="wp-customers-stat">
          <span className="wp-customers-stat-label">Total orders</span>
          <strong>{totals.orders}</strong>
        </div>
        <div className="wp-customers-stat">
          <span className="wp-customers-stat-label">Total spent</span>
          <strong>{formatPrice(totals.spent)}</strong>
        </div>
      </div>

      <div className="wp-filter-bar">
        <input
          type="search"
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search customers"
        />
        <span className="wp-filter-meta">
          {filtered.length} customer{filtered.length === 1 ? '' : 's'} with orders
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="wp-empty">
          <p>{customers.length === 0 ? 'No customers have placed orders yet.' : 'No customers match this search.'}</p>
        </div>
      ) : (
        <div className="wp-table-wrap">
          <table className="wp-table wp-table--customers">
            <thead>
              <tr>
                <th aria-label="Expand" className="wp-col-expand" />
                <SortHeader label="Name" sortKey="name" activeKey={sort.key} dir={sort.dir} onSort={toggleSort} />
                <th>Email</th>
                <th>Phone</th>
                <SortHeader label="Orders" sortKey="orders" activeKey={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader label="Total spent" sortKey="spent" activeKey={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader label="Last order" sortKey="last_order" activeKey={sort.key} dir={sort.dir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const expanded = expandedId === c.id;
                const recent = c.recent_orders || [];
                return (
                  <Fragment key={c.id}>
                    <tr className={expanded ? 'is-expanded' : ''}>
                      <td className="wp-col-expand">
                        {recent.length > 0 ? (
                          <button
                            type="button"
                            className="wp-row-expand"
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Hide recent orders' : 'Show recent orders'}
                            onClick={() => setExpandedId(expanded ? null : c.id)}
                          >
                            {expanded ? '▼' : '▶'}
                          </button>
                        ) : null}
                      </td>
                      <td>
                        <div className="wp-row-title">{c.name || '—'}</div>
                      </td>
                      <td className="wp-customer-email">{c.email || '—'}</td>
                      <td className="wp-customer-phone">{c.phone || '—'}</td>
                      <td><span className="wp-badge wp-badge--neutral">{c.order_count || 0}</span></td>
                      <td className="wp-customer-spent">{formatPrice(c.total_spent || 0)}</td>
                      <td className="wp-customer-date">{formatOrderDate(c.last_order_at)}</td>
                    </tr>
                    {expanded && recent.length > 0 ? (
                      <tr className="wp-customer-detail-row">
                        <td colSpan={7}>
                          <div className="wp-customer-orders-panel">
                            <p className="wp-customer-orders-title">Recent orders (read-only)</p>
                            <table className="wp-table wp-table--nested">
                              <thead>
                                <tr>
                                  <th>Order</th>
                                  <th>Date</th>
                                  <th>Items</th>
                                  <th>Total</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recent.map((o) => (
                                  <tr key={o.id}>
                                    <td><strong>#{o.order_id}</strong></td>
                                    <td>{formatOrderDate(o.created_at)}</td>
                                    <td>{o.item_count || 0}</td>
                                    <td>{formatPrice(o.total_amount || 0)}</td>
                                    <td><span className="wp-status-pill">{o.shipping_status}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
