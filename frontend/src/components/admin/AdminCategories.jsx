import { useMemo } from 'react';

export default function AdminCategories({ products, onViewCategory }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const cat = p.category || 'Uncategorized';
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  if (!rows.length) {
    return (
      <div className="wp-empty">
        <p>No categories yet — add a product first.</p>
      </div>
    );
  }

  return (
    <div className="wp-table-wrap">
      <table className="wp-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Products</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, count]) => (
            <tr key={name}>
              <td>
                <div className="wp-row-title">{name}</div>
              </td>
              <td>{count}</td>
              <td>
                <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={() => onViewCategory(name)}>
                  View products
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
