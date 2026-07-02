import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { canDeleteProducts, canEditProduct, canManageTeam, canManageShopSettings, canViewSalesReport, roleLabel } from '../config/permissions';
import PageHeader from '../components/PageHeader';
import AddProductForm from '../components/AddProductForm';
import AdminDiscountPanel from '../components/AdminDiscountPanel';
import AdminManagement from '../components/AdminManagement';
import AdminChatInbox from '../components/AdminChatInbox';
import AdminSalesReport from '../components/AdminSalesReport';
import AdminOrderCard from '../components/AdminOrderCard';
import AdminStockManager from '../components/AdminStockManager';
import ShopStatusControl from '../components/ShopStatusControl';
import { useTranslation } from '../context/LanguageContext';
import { ProductPrice } from '../components/DiscountPicker';
import { hasDiscount } from '../utils/pricing';
import { getStockStatus } from '../utils/stock';
import { startVisibilityPoll } from '../utils/visibilityPoll';

export default function Admin() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'add');
  const [bookings, setBookings] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);

  const showAdminMgmt = canManageTeam(user);
  const showSales = canViewSalesReport(user);
  const allowDelete = canDeleteProducts(user);
  const showShopControl = canManageShopSettings(user);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bookingData, productData, orderData] = await Promise.all([
        api.getBookings(),
        api.getProducts(),
        api.getOrders(),
      ]);
      setBookings(bookingData);
      setProducts(productData);
      setOrders(orderData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pendingOrders = orders.filter((o) => o.shipping_status === 'pending').length;

  const updateOrderStatus = async (id, shipping_status) => {
    try {
      const updated = await api.updateOrderStatus(id, shipping_status);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    loadData();
    return startVisibilityPoll(loadData, 45_000);
  }, []);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setTab(t);
  }, [searchParams]);

  const updateStatus = async (id, status) => {
    try {
      await api.updateBookingStatus(id, status);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (!allowDelete) return;
    const product = products.find((p) => p.id === id);
    if (product && !canEditProduct(user, product)) {
      alert(t('admin.ownerOnly'));
      return;
    }
    if (!confirm(t('admin.deleteConfirm', { name }))) return;
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditProduct = (product) => {
    if (!canEditProduct(user, product)) {
      alert(t('admin.ownerOnly'));
      return;
    }
    setEditingProduct(product);
    setTab('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormSuccess = (saved) => {
    setEditingProduct(null);
    if (saved?.id) {
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
      });
    }
    loadData();
    setTab('products');
  };

  return (
    <>
      <PageHeader
        eyebrow="⚙️ Admin"
        title="Dashboard"
        subtitle={`Welcome, ${user?.username || 'Staff'} — ${roleLabel(user?.role)}`}
      >
        <button type="button" className="btn btn-outline" onClick={logout}>
          Logout
        </button>
      </PageHeader>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {showShopControl && <ShopStatusControl />}

          <div className="admin-tabs">
            <button type="button" className={`admin-tab admin-tab-add ${tab === 'add' ? 'active' : ''}`} onClick={() => { setTab('add'); setEditingProduct(null); }}>
              {editingProduct ? '✏️ Edit Product' : '➕ Add Product'}
            </button>
            <button type="button" className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
              Products ({products.length})
            </button>
            <button type="button" className={`admin-tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>
              📦 {t('admin.stockTab')}
            </button>
            <button type="button" className={`admin-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
              Orders ({orders.length}){pendingOrders > 0 ? ` · ${pendingOrders} new` : ''}
            </button>
            <button type="button" className={`admin-tab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => setTab('bookings')}>
              Repair Intake ({bookings.length})
            </button>
            <button type="button" className={`admin-tab ${tab === 'messages' ? 'active' : ''}`} onClick={() => setTab('messages')}>
              {t('admin.messages')}
            </button>
            {showSales && (
              <button type="button" className={`admin-tab ${tab === 'sales' ? 'active' : ''}`} onClick={() => setTab('sales')}>
                {t('sales.tab')}
              </button>
            )}
            {showAdminMgmt && (
              <button type="button" className={`admin-tab ${tab === 'admins' ? 'active' : ''}`} onClick={() => setTab('admins')}>
                {t('team.manageTeam')}
              </button>
            )}
          </div>

          {loading && !['add', 'admins', 'messages', 'sales'].includes(tab) ? (
            <div className="loading">{t('common.loading')}</div>
          ) : tab === 'messages' ? (
            <AdminChatInbox />
          ) : tab === 'sales' && showSales ? (
            <AdminSalesReport />
          ) : tab === 'add' ? (
            <div className="glass-card admin-add-wrap">
              {editingProduct && (
                <button type="button" className="btn btn-outline btn-sm" style={{ marginBottom: '1rem' }} onClick={() => setEditingProduct(null)}>
                  ← Cancel Edit
                </button>
              )}
              <AddProductForm
                editProduct={editingProduct}
                onSuccess={handleFormSuccess}
              />
            </div>
          ) : tab === 'admins' && showAdminMgmt ? (
            <AdminManagement />
          ) : tab === 'orders' ? (
            <div className="admin-orders-list">
              {orders.length === 0 ? (
                <div className="empty-state glass-card">Abhi koi order nahi.</div>
              ) : (
                orders
                  .slice()
                  .reverse()
                  .map((o) => (
                    <AdminOrderCard
                      key={o.id}
                      order={o}
                      onUpdateStatus={updateOrderStatus}
                      className="admin-float-card admin-order-card-full glass-card"
                    />
                  ))
              )}
            </div>
          ) : tab === 'stock' ? (
            <AdminStockManager
              products={products}
              currentUser={user}
              onProductUpdated={(updated) =>
                setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
            />
          ) : tab === 'products' ? (
            <>
              <div className="admin-toolbar">
                <button type="button" className="btn btn-primary" onClick={() => { setEditingProduct(null); setTab('add'); }}>
                  ➕ Naya Product
                </button>
              </div>
              <div className="admin-products-grid">
                {products.length === 0 ? (
                  <div className="empty-state">
                    <p>{t('admin.noProducts')}</p>
                    <button type="button" className="btn btn-primary" onClick={() => setTab('add')}>➕ Add Product</button>
                  </div>
                ) : (
                  products.map((p) => {
                    const editable = canEditProduct(user, p);
                    return (
                    <div key={p.id} className={`admin-product-card glass-card ${hasDiscount(p) ? 'on-sale' : ''}`}>
                      <div className="admin-product-img-wrap">
                        <img src={p.image} alt={p.name} />
                        {hasDiscount(p) && <span className="admin-sale-tag">-{p.discount_percent}%</span>}
                        {getStockStatus(p.stock) === 'out' && (
                          <span className="admin-stock-badge admin-stock-badge--out">{t('admin.outOfStock')}</span>
                        )}
                        {getStockStatus(p.stock) === 'low' && (
                          <span className="admin-stock-badge admin-stock-badge--low">{t('admin.lowStock')}: {p.stock}</span>
                        )}
                      </div>
                      <div className="admin-product-info">
                        <span className="preview-cat">{p.category}</span>
                        <h3>{p.name}</h3>
                        <ProductPrice product={p} size="sm" />
                        {p.cost_price > 0 && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {t('sales.costPrice')}: Rs. {Number(p.cost_price).toLocaleString('en-PK')}
                          </p>
                        )}
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          {t('admin.stockLabel', { count: p.stock })}
                        </p>
                        {p.warranty ? <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🛡️ {p.warranty}</p> : null}
                        {p.featured ? <span className="featured-tag">⭐ Featured</span> : null}
                        <p className="admin-product-owner">
                          {p.created_by_name
                            ? t('admin.addedBy', { name: p.created_by_name })
                            : t('admin.addedByLegacy')}
                        </p>
                        <AdminDiscountPanel
                          product={p}
                          canEdit={editable}
                          onUpdated={(updated) => setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                        />
                        <div className="admin-product-actions">
                          {editable ? (
                            <>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleEditProduct(p)}>
                                Edit
                              </button>
                              {allowDelete && (
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDeleteProduct(p.id, p.name)}>
                                  Delete
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="admin-product-locked">🔒 {t('admin.ownerOnly')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div className="admin-bookings-list">
                {bookings.length === 0 ? (
                  <div className="empty-state glass-card">Abhi koi repair intake nahi.</div>
                ) : (
                  bookings.map((b) => (
                    <article key={b.id} className="admin-booking-card glass-card">
                      <div className="admin-booking-head">
                        <div>
                          <h3>{b.customer_name}</h3>
                          <p className="admin-booking-meta">
                            {b.phone}
                            {b.alternative_contact ? ` · Alt: ${b.alternative_contact}` : ''}
                          </p>
                        </div>
                        <select className="status-select" value={b.status} onChange={(e) => updateStatus(b.id, e.target.value)}>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div className="admin-booking-grid">
                        <div>
                          <span className="admin-booking-label">Device</span>
                          <p>{b.device_brand} {b.device_model}</p>
                        </div>
                        <div>
                          <span className="admin-booking-label">Estimated Time</span>
                          <p>{b.estimated_repair_time || b.service_name || '—'}</p>
                        </div>
                        <div className="admin-booking-span-2">
                          <span className="admin-booking-label">Issues</span>
                          <p>{b.issue || '—'}</p>
                          {b.issue_other ? <p className="admin-booking-sub">Other: {b.issue_other}</p> : null}
                          {b.screen_quality ? <p className="admin-booking-sub">Screen: {b.screen_quality}</p> : null}
                          {b.dead_mobile_acknowledged ? <p className="admin-booking-sub">Dead mobile policy: ✓ Accepted (no warranty)</p> : null}
                        </div>
                        <div>
                          <span className="admin-booking-label">Submitted</span>
                          <p>{b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</p>
                        </div>
                        <div>
                          <span className="admin-booking-label">Terms</span>
                          <p>{b.terms_accepted ? '✓ Confirmed' : '—'}</p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
              <div className="admin-table-wrap glass-card admin-table-desktop">
                {bookings.length === 0 ? (
                  <div className="empty-state">Abhi koi repair intake nahi.</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Contact</th>
                        <th>Device</th>
                        <th>Issues</th>
                        <th>Est. Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id}>
                          <td>{b.customer_name}</td>
                          <td>
                            {b.phone}
                            {b.alternative_contact ? <><br /><small>Alt: {b.alternative_contact}</small></> : null}
                          </td>
                          <td>{b.device_brand} {b.device_model}</td>
                          <td className="admin-table-issues">{b.issue || '—'}</td>
                          <td>{b.estimated_repair_time || '—'}</td>
                          <td>
                            <select className="status-select" value={b.status} onChange={(e) => updateStatus(b.id, e.target.value)}>
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
