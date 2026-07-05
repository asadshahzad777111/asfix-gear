import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { getDefaultImage } from '../../config/products';
const STATUS_LABEL = {
  pending: 'Pending approval',
  published: 'Published',
  hidden: 'Hidden',
};

export default function AdminFeedback() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ rating: 5, comment: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminFeedback();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => filter === 'all' || r.status === filter);

  const startEdit = (row) => {
    setEditingId(row.order_id);
    setDraft({ rating: row.rating, comment: row.comment || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ rating: 5, comment: '' });
  };

  const saveEdit = async (orderId) => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateAdminFeedback(orderId, {
        rating: draft.rating,
        comment: draft.comment,
      });
      setRows((prev) => prev.map((r) => (r.order_id === orderId ? updated : r)));
      cancelEdit();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (orderId, status) => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateAdminFeedback(orderId, { status });
      setRows((prev) => prev.map((r) => (r.order_id === orderId ? updated : r)));
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (orderId) => {
    if (!window.confirm('Delete this review permanently?')) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteAdminFeedback(orderId);
      setRows((prev) => prev.filter((r) => r.order_id !== orderId));
      if (editingId === orderId) cancelEdit();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="wp-muted">Loading reviews…</p>;
  }

  return (
    <div className="admin-feedback">
      <div className="admin-feedback-toolbar">
        <p className="wp-muted">
          Customer ratings from order tracking. New reviews stay <strong>Pending</strong> until you publish them on the shop.
        </p>
        <select
          className="wp-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter reviews"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending approval</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No customer reviews yet.</p>
        </div>
      ) : (
        <div className="admin-feedback-list">
          {filtered.map((row) => (
            <article key={row.order_id} className="admin-feedback-card wp-postbox">
              <header className="admin-feedback-head">
                <div>
                  <strong>{row.customer_name}</strong>
                  <span className="wp-muted"> · {row.order_ref}</span>
                </div>
                <span className={`wp-status-badge wp-status-badge--${row.status}`}>
                  {STATUS_LABEL[row.status] || row.status}
                </span>
              </header>

              <div className="admin-feedback-stars" aria-label={`${row.rating} stars`}>
                {'★'.repeat(row.rating)}
                <span className="wp-muted"> ({row.rating}/5)</span>
              </div>

              {editingId === row.order_id ? (
                <div className="admin-feedback-edit">
                  <label>
                    Rating
                    <select
                      value={draft.rating}
                      onChange={(e) => setDraft((d) => ({ ...d, rating: Number(e.target.value) }))}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>{n} stars</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Comment
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={draft.comment}
                      onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
                    />
                  </label>
                  <div className="admin-feedback-actions">
                    <button type="button" className="wp-button wp-button-primary" disabled={saving} onClick={() => saveEdit(row.order_id)}>
                      Save edit
                    </button>
                    <button type="button" className="wp-button" disabled={saving} onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {row.product_id ? (
                    <Link to={`/shop/${row.product_id}`} className="admin-feedback-product" target="_blank" rel="noopener noreferrer">
                      <img
                        src={row.product_image || getDefaultImage(row.product_category || 'Cases')}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = getDefaultImage(row.product_category || 'Cases');
                        }}
                      />
                      <span>{row.product_name || `Product #${row.product_id}`}</span>
                    </Link>
                  ) : (
                    <p className="wp-muted admin-feedback-no-product">No linked product (order items missing)</p>
                  )}
                  {row.comment ? <p className="admin-feedback-comment">{row.comment}</p> : <p className="wp-muted">No comment</p>}
                  <p className="wp-muted admin-feedback-meta">
                    Submitted {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'}
                  </p>
                  <div className="admin-feedback-actions">
                    <button type="button" className="wp-button" disabled={saving} onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    {row.status !== 'published' ? (
                      <button type="button" className="wp-button wp-button-primary" disabled={saving} onClick={() => setStatus(row.order_id, 'published')}>
                        Publish
                      </button>
                    ) : null}
                    {row.status !== 'hidden' ? (
                      <button type="button" className="wp-button" disabled={saving} onClick={() => setStatus(row.order_id, 'hidden')}>
                        Hide
                      </button>
                    ) : (
                      <button type="button" className="wp-button" disabled={saving} onClick={() => setStatus(row.order_id, 'pending')}>
                        Unhide
                      </button>
                    )}
                    <button type="button" className="wp-button wp-button-link-delete" disabled={saving} onClick={() => remove(row.order_id)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
