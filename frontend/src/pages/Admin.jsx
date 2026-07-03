import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { canDeleteProducts, canEditProduct, canManageTeam, canManageShopSettings, canViewSalesReport } from '../config/permissions';
import AdminLayout from '../components/admin/AdminLayout';
import '../components/admin/admin-wp.css';
import AddProductForm from '../components/AddProductForm';
import AdminManagement from '../components/AdminManagement';
import AdminChatInbox from '../components/AdminChatInbox';
import AdminSalesReport from '../components/AdminSalesReport';
import AdminOrderCard from '../components/AdminOrderCard';
import AdminStockManager from '../components/AdminStockManager';
import ShopStatusControl from '../components/ShopStatusControl';
import { useTranslation } from '../context/LanguageContext';
import { ProductPrice } from '../components/DiscountPicker';
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
  const [backupLoading, setBackupLoading] = useState(false);
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

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      await api.downloadDataBackup();
    } catch (err) {
      alert(err.message || 'Backup download failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const pageTitle = (() => {
    if (tab === 'add') return editingProduct ? 'Edit product' : 'Add new product';
    if (tab === 'products') return 'Products';
    if (tab === 'stock') return 'Stock';
    if (tab === 'orders') return 'Orders';
    if (tab === 'bookings') return 'Repair Intake';
    if (tab === 'messages') return t('admin.messages');
    if (tab === 'sales') return t('sales.tab');
    if (tab === 'admins') return t('team.manageTeam');
    return 'Dashboard';
  })();

  return (
    <AdminLayout
      user={user}
      logout={logout}
      tab={tab}
      setTab={setTab}
      editingProduct={editingProduct}
      onEditCancel={() => setEditingProduct(null)}
      counts={{ products: products.length, orders: orders.length, bookings: bookings.length, pendingOrders }}
      flags={{ showSales, showAdminMgmt, showShopControl }}
      pageTitle={pageTitle}
    >
      {showShopControl && (
        <div className="wp-postbox">
          <div className="wp-postbox-head">Shop status</div>
          <div className="wp-postbox-body">
            <ShopStatusControl />
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="wp-button wp-button--secondary"
                onClick={handleDownloadBackup}
                disabled={backupLoading}
              >
                {backupLoading ? 'Downloading…' : 'Download backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && !['add', 'admins', 'messages', 'sales'].includes(tab) ? (
        <div className="wp-loading">{t('common.loading')}</div>
      ) : tab === 'messages' ? (
        <div className="wp-postbox">
          <div className="wp-postbox-body"><AdminChatInbox /></div>
        </div>
      ) : tab === 'sales' && showSales ? (
        <AdminSalesReport />
      ) : tab === 'add' ? (
        <div className="wp-post-layout">
          <div className="wp-post-main">
            {editingProduct && (
              <button type="button" className="wp-button wp-button--secondary" style={{ marginBottom: '0.75rem' }} onClick={() => setEditingProduct(null)}>
                ← Cancel edit
              </button>
            )}
            <div className="wp-postbox">
              <div className="wp-postbox-head">Product data</div>
              <div className="wp-postbox-body">
                <AddProductForm editProduct={editingProduct} onSuccess={handleFormSuccess} />
              </div>
            </div>
          </div>
          <aside className="wp-post-sidebar">
            <div className="wp-postbox">
              <div className="wp-postbox-head">Publish</div>
              <div className="wp-postbox-body">
                <p style={{ fontSize: '0.84rem', color: '#50575e', margin: 0 }}>
                  Form ke neeche <strong>Save Changes</strong> dabayein — product shop par live ho jayega.
                </p>
              </div>
            </div>
            <div className="wp-postbox">
              <div className="wp-postbox-head">Tip</div>
              <div className="wp-postbox-body">
                <p style={{ fontSize: '0.84rem', color: '#50575e', margin: 0 }}>
                  Brand + model select karein taake customer shop filter se product dhundh sakein.
                </p>
              </div>
            </div>
          </aside>
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
              <div className="wp-toolbar">
                <div className="wp-toolbar-left">
                  <button type="button" className="wp-button" onClick={() => { setEditingProduct(null); setTab('add'); }}>
                    Add new product
                  </button>
                </div>
                <div className="wp-toolbar-right">
                  <span style={{ fontSize: '0.84rem', color: '#50575e' }}>{products.length} items</span>
                </div>
              </div>
              {products.length === 0 ? (
                <div className="wp-empty">
                  <p>{t('admin.noProducts')}</p>
                  <button type="button" className="wp-button" style={{ marginTop: '0.75rem' }} onClick={() => setTab('add')}>
                    Add new product
                  </button>
                </div>
              ) : (
                <div className="wp-table-wrap">
                  <table className="wp-table">
                    <thead>
                      <tr>
                        <th style={{ width: 56 }} />
                        <th>Name</th>
                        <th>Stock</th>
                        <th>Price</th>
                        <th>Categories</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const editable = canEditProduct(user, p);
                        const stockStatus = getStockStatus(p.stock);
                        return (
                          <tr key={p.id}>
                            <td>
                              <img className="wp-table-thumb" src={p.image} alt="" />
                            </td>
                            <td>
                              <div className="wp-row-title">{p.name}</div>
                              <div className="wp-row-actions">
                                {editable ? (
                                  <>
                                    <button type="button" onClick={() => handleEditProduct(p)}>Edit</button>
                                    <span>|</span>
                                    {allowDelete && (
                                      <button type="button" onClick={() => handleDeleteProduct(p.id, p.name)}>Delete</button>
                                    )}
                                  </>
                                ) : (
                                  <span>🔒 {t('admin.ownerOnly')}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              {stockStatus === 'out' ? (
                                <span className="wp-stock-out">{t('admin.outOfStock')}</span>
                              ) : stockStatus === 'low' ? (
                                <span className="wp-stock-out">{t('admin.lowStock')}: {p.stock}</span>
                              ) : (
                                <span className="wp-stock-in">In stock ({p.stock})</span>
                              )}
                            </td>
                            <td>
                              <ProductPrice product={p} size="sm" />
                            </td>
                            <td>{p.category}{p.brand ? ` · ${p.brand}` : ''}</td>
                            <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
    </AdminLayout>
  );
}
