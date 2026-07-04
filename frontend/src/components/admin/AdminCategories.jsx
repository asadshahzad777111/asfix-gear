import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

function buildCategoryTree(categories) {
  const byParent = new Map();
  for (const cat of categories) {
    const parentKey = cat.parent_id != null ? Number(cat.parent_id) : null;
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(cat);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  const rows = [];
  function walk(parentId, depth) {
    for (const cat of byParent.get(parentId) || []) {
      rows.push({ ...cat, depth });
      walk(cat.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}

export default function AdminCategories({ onViewCategory }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editParentId, setEditParentId] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.getAdminCategories();
      setCategories(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Could not load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const treeRows = useMemo(() => buildCategoryTree(categories), [categories]);

  const parentOptions = useMemo(
    () => categories.filter((c) => c.id !== editingId),
    [categories, editingId],
  );

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3500);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    try {
      await api.createCategory({
        name,
        parent_id: newParentId ? Number(newParentId) : null,
      });
      setNewName('');
      setNewParentId('');
      flash(`Category "${name}" created`);
      await loadCategories();
    } catch (err) {
      setError(err.message || 'Could not create category');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditParentId(cat.parent_id != null ? String(cat.parent_id) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditParentId('');
  };

  const handleSaveEdit = async (cat) => {
    setSaving(true);
    setError('');
    try {
      await api.updateCategory(cat.id, {
        name: editName.trim(),
        parent_id: editParentId ? Number(editParentId) : null,
      });
      flash(`Category "${editName.trim()}" updated`);
      cancelEdit();
      await loadCategories();
    } catch (err) {
      setError(err.message || 'Could not update category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (cat.product_count > 0) {
      setError(`Cannot delete "${cat.name}" — ${cat.product_count} product(s) use it`);
      return;
    }
    if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteCategory(cat.id);
      flash(`Category "${cat.name}" deleted`);
      if (editingId === cat.id) cancelEdit();
      await loadCategories();
    } catch (err) {
      setError(err.message || 'Could not delete category');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="wp-loading">Loading categories…</div>;
  }

  return (
    <>
      {message ? <div className="wp-notice wp-notice--success">{message}</div> : null}
      {error ? <div className="wp-notice wp-notice--error">{error}</div> : null}

      <div className="wp-postbox wp-categories-add">
        <div className="wp-postbox-head">Add new category</div>
        <div className="wp-postbox-body">
          <form className="wp-categories-add-form" onSubmit={handleCreate}>
            <label>
              <span>Name</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Screen Guards"
                maxLength={80}
                disabled={saving}
              />
            </label>
            <label>
              <span>Parent</span>
              <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)} disabled={saving}>
                <option value="">None (top level)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="wp-button wp-button--primary" disabled={saving || !newName.trim()}>
              Add category
            </button>
          </form>
        </div>
      </div>

      {treeRows.length === 0 ? (
        <div className="wp-empty">
          <p>No categories yet — add one above or assign categories when editing products.</p>
        </div>
      ) : (
        <div className="wp-table-wrap">
          <table className="wp-table wp-table--categories">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Products</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {treeRows.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    {editingId === cat.id ? (
                      <input
                        type="text"
                        className="wp-categories-edit-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={80}
                        disabled={saving || cat.product_count > 0}
                        title={cat.product_count > 0 ? 'Rename blocked while products use this category' : ''}
                      />
                    ) : (
                      <div className="wp-row-title" style={{ paddingLeft: `${cat.depth * 1.25}rem` }}>
                        {cat.depth > 0 ? <span className="wp-category-tree-marker">↳ </span> : null}
                        {cat.name}
                      </div>
                    )}
                  </td>
                  <td><code className="wp-category-slug">{cat.slug}</code></td>
                  <td>
                    <span className={cat.product_count > 0 ? 'wp-category-count--used' : 'wp-category-count--empty'}>
                      {cat.product_count}
                    </span>
                  </td>
                  <td className="wp-table-actions">
                    {editingId === cat.id ? (
                      <>
                        <label className="wp-categories-parent-edit">
                          <select
                            value={editParentId}
                            onChange={(e) => setEditParentId(e.target.value)}
                            disabled={saving}
                          >
                            <option value="">Top level</option>
                            {parentOptions.filter((p) => p.id !== cat.id).map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="wp-button wp-button--primary wp-button--small"
                          onClick={() => handleSaveEdit(cat)}
                          disabled={saving || !editName.trim()}
                        >
                          Save
                        </button>
                        <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={cancelEdit} disabled={saving}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="wp-button wp-button--link" onClick={() => startEdit(cat)} disabled={saving}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="wp-button wp-button--link wp-button--danger"
                          onClick={() => handleDelete(cat)}
                          disabled={saving || cat.product_count > 0}
                          title={cat.product_count > 0 ? `${cat.product_count} product(s) — delete blocked` : 'Delete category'}
                        >
                          Delete
                        </button>
                        {onViewCategory && cat.product_count > 0 ? (
                          <button
                            type="button"
                            className="wp-button wp-button--secondary wp-button--small"
                            onClick={() => onViewCategory(cat.name)}
                          >
                            View products
                          </button>
                        ) : null}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
