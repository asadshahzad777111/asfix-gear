import { Fragment, useEffect, useMemo, useState } from 'react';
import { api, formatPrice } from '../../api/client';
import AdminOrderCard from '../AdminOrderCard';
import { filterOrders, normalizeOrderSearchQuery } from '../../utils/orderSearch';

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

function customerKeyFromOrder(order) {
  const email = String(order?.gmail || '').trim().toLowerCase();
  const phone = String(order?.phone || '').replace(/\D/g, '');
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  const name = String(order?.customer_name || '').trim().toLowerCase();
  if (name) return `name:${name}`;
  return null;
}

function looksLikeOrderSearch(query) {
  const q = normalizeOrderSearchQuery(query).toLowerCase();
  if (!q) return false;
  return /^(?:asf-?)?\d+$/i.test(q.replace(/\s/g, '')) || /\basf-?\d+/i.test(q);
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'last_order', dir: 'desc' });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([api.getCustomersSummary(), api.getOrders()])
      .then(([rows, orderRows]) => {
        if (cancelled) return;
        setCustomers(Array.isArray(rows) ? rows : []);
        setOrders(Array.isArray(orderRows) ? orderRows : []);
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

  const matchedOrders = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    return filterOrders(orders, q);
  }, [orders, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalized = normalizeOrderSearchQuery(search).toLowerCase();
    let rows = customers;
    if (q) {
      const matchKeys = new Set(
        matchedOrders.map((o) => customerKeyFromOrder(o)).filter(Boolean),
      );
      rows = rows.filter((c) => {
        const hay = `${c.name} ${c.email} ${c.phone}`.toLowerCase();
        if (hay.includes(q) || (normalized && hay.includes(normalized))) return true;
        if (matchKeys.has(c.id)) return true;
        const recentHay = (c.recent_orders || [])
          .map((o) => `${o.order_id || ''} ${o.id || ''}`)
          .join(' ')
          .toLowerCase();
        if (recentHay && (recentHay.includes(q) || recentHay.includes(normalized.replace(/\s/g, '')))) {
          return true;
        }
        return false;
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
  }, [customers, search, sort, matchedOrders]);

  const orderSearchActive = Boolean(search.trim()) && (matchedOrders.length > 0 || looksLikeOrderSearch(search));
  const highlightSingleReceipt = matchedOrders.length === 1;

  useEffect(() => {
    if (!search.trim()) return;
    if (matchedOrders.length === 1) {
      const key = customerKeyFromOrder(matchedOrders[0]);
      if (key) setExpandedId(key);
    } else if (filtered.length === 1) {
      setExpandedId(filtered[0].id);
    }
  }, [search, matchedOrders, filtered]);

  useEffect(() => {
    if (!highlightSingleReceipt) return;
    const timer = window.setTimeout(() => {
      document.querySelector('.wp-customer-receipt-hit')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [highlightSingleReceipt, matchedOrders]);

  if (loading) {
    return <div className="wp-loading">Loading customers…</div>;
  }

  if (error) {
    return <div className="wp-empty"><p>{error}</p></div>;
  }

  const showEmpty =
    filtered.length === 0 && matchedOrders.length === 0;

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
          className="wp-customers-search-input"
          placeholder="ASF-1043, #ASF-1043, 1043, name, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search customers or receipt number"
          autoComplete="off"
          enterKeyHint="search"
        />
        <span className="wp-filter-meta">
          {search.trim()
            ? `${matchedOrders.length} receipt${matchedOrders.length === 1 ? '' : 's'} · ${filtered.length} customer${filtered.length === 1 ? '' : 's'}`
            : `${filtered.length} customer${filtered.length === 1 ? '' : 's'} with orders`}
        </span>
      </div>

      {matchedOrders.length > 0 ? (
        <section className="wp-customer-receipts" aria-label="Matching receipts">
          <div className="wp-customer-receipts__head">
            <h3>Matching receipts</h3>
            <p>Print / Share / Download is on each bill card.</p>
          </div>
          <div className="wp-customer-receipts__grid">
            {matchedOrders.map((o) => (
              <AdminOrderCard
                key={o.id}
                order={o}
                className={`admin-float-card admin-order-card-full glass-card wp-customer-receipt-hit${
                  o.source === 'counter_sale' || o.source === 'counter_return'
                    ? ' admin-order-card--pos'
                    : ' admin-order-card--online'
                }${highlightSingleReceipt ? ' admin-order-card--search-hit' : ''}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {orderSearchActive && matchedOrders.length === 0 ? (
        <div className="wp-empty wp-empty--soft">
          <p>No receipt matched this slip number.</p>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="wp-empty">
          <p>
            {customers.length === 0
              ? 'No customers have placed orders yet.'
              : 'No customers or receipts match this search.'}
          </p>
        </div>
      ) : filtered.length === 0 ? null : (
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
                const hitOrderIds = new Set(matchedOrders.map((o) => String(o.id)));
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
                            <p className="wp-customer-orders-title">Recent orders — full bill is in Matching receipts above when you search the slip #</p>
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
                                  <tr
                                    key={o.id}
                                    className={hitOrderIds.has(String(o.id)) ? 'is-receipt-hit' : undefined}
                                  >
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
