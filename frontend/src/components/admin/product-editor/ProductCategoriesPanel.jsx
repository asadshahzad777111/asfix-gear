import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { CATEGORY_TREE, flattenCategoryTree } from '../../../config/products';

export default function ProductCategoriesPanel({ category, onCategoryChange, onMessage }) {
  const [tab, setTab] = useState('all');
  const [customCategories, setCustomCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [categoryRows, setCategoryRows] = useState([]);
  const [productCounts, setProductCounts] = useState(new Map());

  useEffect(() => {
    Promise.all([api.getCategories(), api.getProducts()])
      .then(([names, products]) => {
        setCategoryRows(Array.isArray(names) ? names : []);
        const map = new Map();
        for (const p of products || []) {
          const cat = p.category || 'Uncategorized';
          map.set(cat, (map.get(cat) || 0) + 1);
        }
        setProductCounts(map);
      })
      .catch(() => {
        setCategoryRows([]);
        setProductCounts(new Map());
      });
  }, []);

  const counts = productCounts;

  const allCategories = useMemo(
    () => flattenCategoryTree([...customCategories, ...categoryRows]),
    [customCategories, categoryRows],
  );

  const popular = useMemo(
    () => [...allCategories]
      .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
      .slice(0, 6),
    [allCategories, counts],
  );

  const visibleGroups = useMemo(() => {
    if (tab === 'popular') {
      return [{ label: 'Most used', items: popular }];
    }
    const extra = allCategories.filter(
      (name) => !CATEGORY_TREE.some((group) => group.items.includes(name)),
    );
    const groups = [...CATEGORY_TREE];
    if (extra.length) groups.push({ label: 'Other', items: extra });
    return groups;
  }, [tab, allCategories, popular]);

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (allCategories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      onCategoryChange(name);
      setNewCategory('');
      return;
    }
    setCustomCategories((prev) => [...prev, name]);
    onCategoryChange(name);
    setNewCategory('');
    onMessage?.(`Category "${name}" selected ✓`);
  };

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
              {group.items.map(renderItem)}
            </div>
          ))}
        </div>
        <div className="wp-product-category-add">
          <input
            type="text"
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
          />
          <button type="button" className="wp-button wp-button--link" onClick={addCategory}>
            + Add new category
          </button>
        </div>
      </div>
    </div>
  );
}
