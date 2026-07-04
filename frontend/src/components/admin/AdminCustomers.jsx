import { useEffect, useMemo, useState } from 'react';
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

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'last_order', dir: 'desc' });

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
      <div className="wp-filter-bar">
        <input
          type="search"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search customers"
        />
        <span style={{ fontSize: '0.84rem', color: '#50575e' }}>
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
                <SortHeader label="Name" sortKey="name" activeKey={sort.key} dir={sort.dir} onSort={toggleSort} />
                <th>Email / Phone</th>
                <SortHeader label="Orders" sortKey="orders" activeKey={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader label="Last order" sortKey="last_order" activeKey={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader label="Total spent" sortKey="spent" activeKey={sort.key} dir={sort.dir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="wp-row-title">{c.name || '—'}</div>
                  </td>
                  <td>
                    {c.email ? <div>{c.email}</div> : null}
                    {c.phone ? <div className="wp-customer-contact">{c.phone}</div> : null}
                    {!c.email && !c.phone ? '—' : null}
                  </td>
                  <td>{c.order_count || 0}</td>
                  <td>{c.last_order_at ? new Date(c.last_order_at).toLocaleString() : '—'}</td>
                  <td>{formatPrice(c.total_spent || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
