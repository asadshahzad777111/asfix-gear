import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { CATEGORY_TREE } from '../../../config/products';

export default function ProductCategoriesPanel({ category, onCategoryChange, onMessage }) {
  const [tab, setTab] = useState('all');
  const [registryCategories, setRegistryCategories] = useState([]);
  const [productCounts, setProductCounts] = useState(new Map());
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getAdminCategories(),
      api.getProducts({ status: 'all' }),
    ])
      .then(([cats, products]) => {
        setRegistryCategories(Array.isArray(cats) ? cats : []);
        const map = new Map();
        for (const p of products || []) {
          const cat = p.category || 'Uncategorized';
          map.set(cat, (map.get(cat) || 0) + 1);
        }
        setProductCounts(map);
      })
      .catch(() => {
        setRegistryCategories([]);
        setProductCounts(new Map());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const counts = productCounts;

  const allCategoryNames = useMemo(() => {
    const fromRegistry = registryCategories.map((c) => c.name);
    const fromProducts = [...counts.keys()];
    return [...new Set([...fromRegistry, ...fromProducts])].sort((a, b) => a.localeCompare(b));
  }, [registryCategories, counts]);

  const popular = useMemo(
    () => [...allCategoryNames]
      .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
      .slice(0, 6),
    [allCategoryNames, counts],
  );

  const visibleGroups = useMemo(() => {
    if (tab === 'popular') {
      return [{ label: 'Most used', items: popular }];
    }

    if (registryCategories.length > 0) {
      const grouped = [];
      const topLevel = registryCategories.filter((c) => c.parent_id == null);
      for (const parent of topLevel.sort((a, b) => a.name.localeCompare(b.name))) {
        const children = registryCategories
          .filter((c) => Number(c.parent_id) === parent.id)
          .map((c) => c.name);
        grouped.push({
          label: parent.name,
          items: children.length ? [parent.name, ...children] : [parent.name],
        });
      }
      const inTree = new Set(grouped.flatMap((g) => g.items));
      const orphans = allCategoryNames.filter((n) => !inTree.has(n));
      if (orphans.length) grouped.push({ label: 'Other', items: orphans });
      return grouped.length ? grouped : [{ label: 'Categories', items: allCategoryNames }];
    }

    const extra = allCategoryNames.filter(
      (name) => !CATEGORY_TREE.some((group) => group.items.includes(name)),
    );
    const groups = [...CATEGORY_TREE];
    if (extra.length) groups.push({ label: 'Other', items: extra });
    return groups;
  }, [tab, allCategoryNames, popular, registryCategories]);

  const renderItem = (name) => (
    <label key={name} className="wp-product-category-item">
      <input
        type="radio"
        name="product-category"
        checked={category === name}
        onChange={() => onCategoryChange(name)}
      />
      <span>{name}</span>
      {counts.get(name) ? <span className="wp-product-category-count">({counts.get(name)})</span> : null}
    </label>
  );

  return (
    <div className="wp-postbox wp-product-categories">
      <div className="wp-postbox-head">Product categories</div>
      <div className="wp-postbox-body">
        {loading ? (
          <p className="wp-product-hint--muted">Loading categories…</p>
        ) : (
          <>
            <div className="wp-product-category-tabs">
              <button type="button" className={tab === 'all' ? 'is-active' : ''} onClick={() => setTab('all')}>
                All categories
              </button>
              <button type="button" className={tab === 'popular' ? 'is-active' : ''} onClick={() => setTab('popular')}>
                Most Used
              </button>
            </div>
            <div className="wp-product-category-list">
              {visibleGroups.map((group) => (
                <div key={group.label} className="wp-product-category-group">
                  <p className="wp-product-category-group-label">{group.label}</p>
                  {[...new Set(group.items)].map(renderItem)}
                </div>
              ))}
            </div>
            <p className="wp-product-hint--muted">
              Manage categories in{' '}
              <button type="button" className="wp-button wp-button--link" onClick={() => onMessage?.('Open Categories tab from the sidebar')}>
                Products → Categories
              </button>
              . Selecting a category here sets it on save — existing products keep their current category until edited.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
