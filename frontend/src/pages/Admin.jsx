import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { canDeleteProducts, canEditProduct, canManageProducts, canManageTeam, canManageShopSettings, canViewAuditLog, canViewSalesReport } from '../config/permissions';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from '../components/admin/AdminDashboard';
import AdminCategories from '../components/admin/AdminCategories';
import AdminCustomers from '../components/admin/AdminCustomers';
import AdminFeedback from '../components/admin/AdminFeedback';
import AdminSettings from '../components/admin/AdminSettings';
import AdminAds from '../components/admin/AdminAds';
import AdminHeroAds from '../components/admin/AdminHeroAds';
import '../components/admin/admin-wp.css';
import AddProductForm from '../components/AddProductForm';
import AdminManagement from '../components/AdminManagement';
import AdminChatInbox from '../components/AdminChatInbox';
import AdminSalesReport from '../components/AdminSalesReport';
import { ORDER_STATUSES } from '../components/AdminOrderCard';
import AdminOrdersTable from '../components/admin/AdminOrdersTable';
import AdminStockManager from '../components/AdminStockManager';
import AdminProductsSheet from '../components/admin/AdminProductsSheet';
import AdminAuditLog from '../components/admin/AdminAuditLog';
import AdminAsfinBills from '../components/admin/AdminAsfinBills';
import { useTranslation } from '../context/LanguageContext';
import { ProductPrice } from '../components/DiscountPicker';
import { getStockStatus, LOW_STOCK_THRESHOLD, getStockAlertProducts, getLowStockProducts } from '../utils/stock';
import AdminStockAlert from '../components/admin/AdminStockAlert';
import AdminBookingPhotos from '../components/admin/AdminBookingPhotos';
import AdminBookingCard from '../components/admin/AdminBookingCard';
import { RepairChatButton, RepairChatModal } from '../components/RepairChatPanel';
import { startVisibilityPoll } from '../utils/visibilityPoll';
import useLiveUpdates from '../hooks/useLiveUpdates';
import { filterOrders } from '../utils/orderSearch';

const VALID_TABS = new Set([
  'dashboard', 'products', 'add', 'categories', 'stock', 'sheet', 'orders', 'customers',
  'bookings', 'messages', 'feedback', 'sales', 'audit', 'admins', 'settings', 'payments', 'ads', 'hero',
]);

const STOCK_FILTERS = new Set(['all', 'low_stock', 'out_of_stock']);

function ProductSortHeader({ label, sortKey, activeKey, dir, onSort }) {
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

export default function Admin() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const initialStockFilter = searchParams.get('filter');
  const [tab, setTabState] = useState(() => {
    if (initialTab === 'bill') return 'products'; /* Counter Bill removed — use /pos */
    return initialTab && VALID_TABS.has(initialTab) ? initialTab : 'dashboard';
  });
  const [stockFilter, setStockFilter] = useState(
    initialStockFilter && STOCK_FILTERS.has(initialStockFilter) ? initialStockFilter : 'all'
  );
  const [bookings, setBookings] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('all');
  const [productStockFilter, setProductStockFilter] = useState('all');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [productOnSale, setProductOnSale] = useState(false);
  const [productSort, setProductSort] = useState({ key: 'date', dir: 'desc' });
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderSourceFilter, setOrderSourceFilter] = useState('all');
  const [orderStaffFilter, setOrderStaffFilter] = useState('all');
  const [orderDatePreset, setOrderDatePreset] = useState('all'); // all | today | yesterday | older | custom
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [noteSaving, setNoteSaving] = useState({});
  const [costDrafts, setCostDrafts] = useState({});
  const [costSaving, setCostSaving] = useState({});
  const [chatBooking, setChatBooking] = useState(null);
  const [repairChatUnread, setRepairChatUnread] = useState({});
  const [repairChatUnreadTotal, setRepairChatUnreadTotal] = useState(0);

  const showAdminMgmt = canManageTeam(user);
  const showSales = canViewSalesReport(user);
  const allowDelete = canDeleteProducts(user);
  const showShopControl = canManageShopSettings(user);
  const showProductManagement = canManageProducts(user);
  const showAudit = canViewAuditLog(user);

  const setTab = (next, options = {}) => {
    setTabState(next);
    const params = {};
    if (next && next !== 'dashboard') params.tab = next;
    const nextFilter = options.stockFilter ?? (next === 'stock' ? stockFilter : null);
    if (next === 'stock' && nextFilter && nextFilter !== 'all') {
      params.filter = nextFilter;
    }
    if (Object.keys(params).length) {
      setSearchParams(params, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const goToStockAlerts = () => {
    setStockFilter('low_stock');
    setTabState('stock');
    setSearchParams({ tab: 'stock', filter: 'low_stock' }, { replace: true });
  };

  const handleStockFilterChange = (filter) => {
    setStockFilter(filter);
    setSearchParams(
      filter === 'all' ? { tab: 'stock' } : { tab: 'stock', filter },
      { replace: true }
    );
  };

  const toggleProductSort = (key) => {
    setProductSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [bookingData, productData, orderData] = await Promise.all([
        api.getBookings(),
        api.getProducts({ status: 'all' }),
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

  const loadRepairChats = useCallback(async () => {
    try {
      const [chats, unreadData] = await Promise.all([
        api.getRepairChats(),
        api.getRepairChatUnread(),
      ]);
      const map = {};
      for (const chat of chats) {
        map[chat.booking_id] = chat.unread || 0;
      }
      setRepairChatUnread(map);
      setRepairChatUnreadTotal(unreadData?.count || 0);
    } catch {
      /* optional — chat may be empty */
    }
  }, []);

  const pendingOrders = orders.filter((o) => o.payment_status === 'pending_payment' || o.shipping_status === 'pending').length;

  /* POS Custom (custom-bill save) rows often land at 0/low stock — keep them in Stock tab,
     but skip popup / top-bar noise so Custom bill save does not spam Low Stock alerts. */
  const stockAlertProducts = getStockAlertProducts(products, { excludePosCustom: true });
  const lowStockProducts = getLowStockProducts(products, { excludePosCustom: true });
  const lowStockCount = lowStockProducts.length;

  const productCategories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (productCategory !== 'all' && p.category !== productCategory) return false;
    if (productOnSale && !(Number(p.discount_percent) > 0)) return false;
    const status = p.status || 'published';
    if (productStatusFilter !== 'all' && status !== productStatusFilter) return false;
    const stock = Number(p.stock) || 0;
    if (productStockFilter === 'out_of_stock' && stock > 0) return false;
    if (productStockFilter === 'low_stock' && (stock <= 0 || stock > LOW_STOCK_THRESHOLD)) return false;
    if (productStockFilter === 'in_stock' && stock <= LOW_STOCK_THRESHOLD) return false;
    if (productSearch.trim()) {
      const q = productSearch.trim().toLowerCase();
      const hay = `${p.name} ${p.category} ${p.brand || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [products, productCategory, productOnSale, productStatusFilter, productStockFilter, productSearch]);

  const sortedProducts = useMemo(() => {
    const mul = productSort.dir === 'asc' ? 1 : -1;
    return [...filteredProducts].sort((a, b) => {
      if (productSort.key === 'name') {
        return mul * String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (productSort.key === 'stock') {
        return mul * ((Number(a.stock) || 0) - (Number(b.stock) || 0));
      }
      if (productSort.key === 'price') {
        return mul * ((Number(a.price) || 0) - (Number(b.price) || 0));
      }
      if (productSort.key === 'brand') {
        return mul * String(a.brand || '').localeCompare(String(b.brand || ''));
      }
      return mul * String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
  }, [filteredProducts, productSort]);

  const orderStaffOptions = useMemo(() => {
    const byId = new Map();
    for (const order of orders) {
      if (order.created_by_staff_id == null) continue;
      byId.set(String(order.created_by_staff_id), order.created_by_staff_name || `Staff #${order.created_by_staff_id}`);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [orders]);

  const localDateKey = (value = new Date()) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayKey = localDateKey();
  const yesterdayKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDateKey(d);
  })();

  const orderDayKey = (order) => (order?.created_at ? localDateKey(order.created_at) : '');

  const orderChannel = (o) => {
    const src = o?.source || 'online';
    if (src === 'counter_sale' || src === 'counter_return' || src === 'counter_draft') return 'counter';
    return 'online';
  };

  const matchesOrderDate = (o) => {
    const day = orderDayKey(o);
    if (!day) return orderDatePreset === 'all';
    if (orderDatePreset === 'today') return day === todayKey;
    if (orderDatePreset === 'yesterday') return day === yesterdayKey;
    if (orderDatePreset === 'older') return day < yesterdayKey;
    if (orderDatePreset === 'custom' && orderDateFilter) return day === orderDateFilter;
    return true;
  };

  const filteredOrders = useMemo(() => {
    const base = orders.filter((o) => {
      if (orderStatusFilter !== 'all' && o.shipping_status !== orderStatusFilter) return false;
      if (orderSourceFilter === 'counter_sale' && orderChannel(o) !== 'counter') return false;
      if (orderSourceFilter === 'online' && orderChannel(o) !== 'online') return false;
      if (orderStaffFilter !== 'all' && String(o.created_by_staff_id || '') !== orderStaffFilter) return false;
      if (!matchesOrderDate(o)) return false;
      return true;
    });
    return filterOrders(base, orderSearch);
  }, [
    orders,
    orderStatusFilter,
    orderSourceFilter,
    orderStaffFilter,
    orderDatePreset,
    orderDateFilter,
    orderSearch,
  ]);

  const countByDatePreset = (preset) =>
    orders.filter((o) => {
      const day = orderDayKey(o);
      if (!day) return preset === 'all';
      if (preset === 'today') return day === todayKey;
      if (preset === 'yesterday') return day === yesterdayKey;
      if (preset === 'older') return day < yesterdayKey;
      return true;
    }).length;

  const hasOrderSearch = Boolean(String(orderSearch || '').trim());
  const highlightSingle = hasOrderSearch && filteredOrders.length === 1;
  const highlightOrderId = highlightSingle ? filteredOrders[0]?.id : null;

  useEffect(() => {
    if (highlightSingle && filteredOrders[0]) {
      setExpandedOrderId(String(filteredOrders[0].id));
      return;
    }
    if (!hasOrderSearch) return;
    if (filteredOrders.length === 0) setExpandedOrderId(null);
  }, [highlightSingle, hasOrderSearch, filteredOrders]);

  useEffect(() => {
    if (!expandedOrderId) return;
    const timer = window.setTimeout(() => {
      document.querySelector('.wp-order-detail-row .admin-order-card--search-hit, .wp-order-detail-row .admin-order-card-full')
        ?.closest('tr')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.querySelector('.wp-table--orders tr.is-receipt-hit')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [expandedOrderId, highlightOrderId]);

  const clearOrderFilters = () => {
    setOrderSourceFilter('all');
    setOrderStaffFilter('all');
    setOrderDatePreset('all');
    setOrderDateFilter('');
    setOrderSearch('');
    setExpandedOrderId(null);
  };

  const navigateAdmin = (nextTab, filter = {}) => {
    if (filter.category) setProductCategory(filter.category);
    if (filter.onSale === 'true') setProductOnSale(true);
    if (filter.onSale === 'false') setProductOnSale(false);
    setEditingProduct(null);
    setTab(nextTab);
  };

  const toggleProductSelect = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllProducts = () => {
    const editableIds = filteredProducts
      .filter((p) => canEditProduct(user, p))
      .map((p) => p.id);
    const allSelected = editableIds.length > 0 && editableIds.every((id) => selectedProductIds.includes(id));
    setSelectedProductIds(allSelected ? [] : editableIds);
  };

  const handleDuplicateProduct = async (product) => {
    if (!canEditProduct(user, product)) {
      alert(t('admin.ownerOnly'));
      return;
    }
    try {
      const copy = await api.duplicateProduct(product.id);
      setProducts((prev) => [copy, ...prev]);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!allowDelete || !selectedProductIds.length) return;
    if (!confirm(`Delete ${selectedProductIds.length} selected product(s)?`)) return;
    setBulkLoading(true);
    try {
      const ids = [...selectedProductIds];
      const result = await api.bulkDeleteProducts(ids);
      setProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
      setSelectedProductIds([]);
      if (result.deleted < ids.length) {
        alert(`${result.deleted} deleted. Some items were skipped (not yours or not found).`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const updateOrderStatus = async (id, shipping_status) => {
    try {
      const updated = await api.updateOrderStatus(id, shipping_status);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (updated?.postex_error) {
        alert(`${t('admin.postexAutoFailed')}: ${updated.postex_error}`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const markOrderPaid = async (id) => {
    try {
      const updated = await api.markOrderPaid(id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (updated?.postex_error) {
        alert(`${t('admin.postexAutoFailed')}: ${updated.postex_error}`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const assignOrderRider = async (id, body) => {
    const updated = await api.assignOrderRider(id, body);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    return updated;
  };

  const markOrderDelivered = async (id) => {
    try {
      const updated = await api.markOrderDelivered(id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      alert(err.message);
    }
  };

  const bookOrderPostEx = async (id) => {
    const updated = await api.bookOrderPostEx(id);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    return updated;
  };

  const onLiveEvent = useCallback((event) => {
    if (event.startsWith('order_') || event.startsWith('repair_') || event.startsWith('product_')) {
      loadData();
    }
    if (event === 'repair_message' || event.startsWith('repair_')) {
      loadRepairChats();
    }
  }, [loadRepairChats]);

  useLiveUpdates({ onEvent: onLiveEvent, enabled: Boolean(user) });

  useEffect(() => {
    loadData();
    loadRepairChats();
    const stop = startVisibilityPoll(() => {
      loadData();
      loadRepairChats();
    }, 45_000);
    return stop;
  }, [loadRepairChats]);

  useEffect(() => {
    const t = searchParams.get('tab');
    const next = t && VALID_TABS.has(t) ? t : 'dashboard';
    setTabState(next);
    const f = searchParams.get('filter');
    if (next === 'stock' && f && STOCK_FILTERS.has(f)) {
      setStockFilter(f);
    } else if (next !== 'stock') {
      setStockFilter('all');
    }
  }, [searchParams]);

  const updateStatus = async (id, status) => {
    try {
      const updated = await api.updateBookingStatus(id, status);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      alert(err.message);
    }
  };

  const saveEstimatedCost = async (id) => {
    const raw = costDrafts[id];
    setCostSaving((prev) => ({ ...prev, [id]: true }));
    try {
      const value = raw === '' || raw == null ? null : Number(raw);
      const updated = await api.updateBookingEstimatedCost(id, value);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      alert(err.message);
    } finally {
      setCostSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const updateBookingInList = (updated) => {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const saveBookingNote = async (id) => {
    const note = (noteDrafts[id] || '').trim();
    if (!note) return;
    setNoteSaving((prev) => ({ ...prev, [id]: true }));
    try {
      const updated = await api.addBookingNote(id, note);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
      setNoteDrafts((prev) => ({ ...prev, [id]: '' }));
    } catch (err) {
      alert(err.message);
    } finally {
      setNoteSaving((prev) => ({ ...prev, [id]: false }));
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
    if (tab === 'dashboard') return 'Dashboard';
    if (tab === 'add') return editingProduct ? 'Edit product' : 'Add new product';
    if (tab === 'products') return 'Products';
    if (tab === 'categories') return 'Categories';
    if (tab === 'stock') return 'Stock';
    if (tab === 'sheet') return 'Products Sheet';
    if (tab === 'orders') return 'Orders';
    if (tab === 'customers') return 'Customers';
    if (tab === 'bookings') return 'Repair Intake';
    if (tab === 'messages') return t('admin.messages');
    if (tab === 'feedback') return 'Reviews & Feedback';
    if (tab === 'sales') return t('sales.tab');
    if (tab === 'asfin') return t('admin.asfinBillsTitle');
    if (tab === 'audit') return t('admin.auditTitle');
    if (tab === 'admins') return t('team.manageTeam');
    if (tab === 'settings') return 'Settings';
    if (tab === 'payments') return 'Payments';
    if (tab === 'ads') return 'Create Ad';
    if (tab === 'hero') return 'Home Ads';
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
      counts={{
        products: products.length,
        orders: orders.length,
        bookings: bookings.length,
        pendingOrders,
        lowStockCount,
        repairChatUnread: repairChatUnreadTotal,
      }}
      flags={{ showSales, showAdminMgmt, showShopControl, showAudit }}
      pageTitle={pageTitle}
      onStockAlertClick={goToStockAlerts}
    >
      <AdminStockAlert
        products={stockAlertProducts}
        ready={!loading}
        onViewStock={goToStockAlerts}
        onEditProduct={handleEditProduct}
      />
      {loading && !['add', 'admins', 'messages', 'feedback', 'sales', 'asfin', 'dashboard', 'settings', 'payments', 'customers', 'ads', 'hero'].includes(tab) ? (
        <div className="wp-loading">{t('common.loading')}</div>
      ) : tab === 'dashboard' ? (
        <AdminDashboard onNavigate={navigateAdmin} showShopControl={showShopControl} />
      ) : tab === 'hero' && showShopControl ? (
        <AdminHeroAds />
      ) : tab === 'ads' ? (
        <AdminAds />
      ) : tab === 'settings' && showShopControl ? (
        <AdminSettings
          onDownloadBackup={handleDownloadBackup}
          backupLoading={backupLoading}
          showBackup
          section="general"
        />
      ) : tab === 'payments' && showShopControl ? (
        <AdminSettings section="payments" />
      ) : tab === 'categories' ? (
        <AdminCategories
          onViewCategory={(name) => navigateAdmin('products', { category: name })}
        />
      ) : tab === 'messages' ? (
        <div className="wp-postbox">
          <div className="wp-postbox-body"><AdminChatInbox /></div>
        </div>
      ) : tab === 'feedback' ? (
        <AdminFeedback />
      ) : tab === 'sales' && showSales ? (
        <AdminSalesReport />
      ) : tab === 'asfin' ? (
        <AdminAsfinBills />
      ) : tab === 'audit' && showAudit ? (
        <AdminAuditLog />
      ) : tab === 'add' ? (
        <>
          {editingProduct && (
            <button type="button" className="wp-button wp-button--secondary" style={{ marginBottom: '0.75rem' }} onClick={() => setEditingProduct(null)}>
              ← Cancel edit
            </button>
          )}
          {showProductManagement ? (
            <AddProductForm editProduct={editingProduct} onSuccess={handleFormSuccess} wpLayout />
          ) : (
            <div className="wp-empty">{t('admin.productManagerOnly')}</div>
          )}
        </>
      ) : tab === 'admins' && showAdminMgmt ? (
        <AdminManagement />
      ) : tab === 'orders' ? (
            <>
              <div className="wp-order-filters wp-order-filters--date">
                <button
                  type="button"
                  className={`wp-order-filter ${orderDatePreset === 'all' ? 'is-active' : ''}`}
                  onClick={() => {
                    setOrderDatePreset('all');
                    setOrderDateFilter('');
                  }}
                >
                  {t('admin.orderDateAll')} ({orders.length})
                </button>
                <button
                  type="button"
                  className={`wp-order-filter ${orderDatePreset === 'today' ? 'is-active' : ''}`}
                  onClick={() => {
                    setOrderDatePreset('today');
                    setOrderDateFilter('');
                  }}
                >
                  {t('admin.orderDateToday')} ({countByDatePreset('today')})
                </button>
                <button
                  type="button"
                  className={`wp-order-filter ${orderDatePreset === 'yesterday' ? 'is-active' : ''}`}
                  onClick={() => {
                    setOrderDatePreset('yesterday');
                    setOrderDateFilter('');
                  }}
                >
                  {t('admin.orderDateYesterday')} ({countByDatePreset('yesterday')})
                </button>
                <button
                  type="button"
                  className={`wp-order-filter ${orderDatePreset === 'older' ? 'is-active' : ''}`}
                  onClick={() => {
                    setOrderDatePreset('older');
                    setOrderDateFilter('');
                  }}
                >
                  {t('admin.orderDateOlder')} ({countByDatePreset('older')})
                </button>
              </div>
              <div className="wp-order-filters">
                <button
                  type="button"
                  className={`wp-order-filter ${orderStatusFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setOrderStatusFilter('all')}
                >
                  All ({orders.length})
                </button>
                {ORDER_STATUSES.map((status) => {
                  const count = orders.filter((o) => o.shipping_status === status).length;
                  if (!count && orderStatusFilter !== status) return null;
                  return (
                    <button
                      key={status}
                      type="button"
                      className={`wp-order-filter ${orderStatusFilter === status ? 'is-active' : ''}`}
                      onClick={() => setOrderStatusFilter(status)}
                    >
                      {status.replace(/_/g, ' ')} ({count})
                    </button>
                  );
                })}
              </div>
              <div className="wp-filter-bar">
                <select value={orderSourceFilter} onChange={(e) => setOrderSourceFilter(e.target.value)} aria-label={t('admin.orderSourceFilter')}>
                  <option value="all">{t('admin.orderSourceAll')}</option>
                  <option value="counter_sale">{t('admin.orderSourceCounter')}</option>
                  <option value="online">{t('admin.orderSourceOnline')}</option>
                </select>
                <select value={orderStaffFilter} onChange={(e) => setOrderStaffFilter(e.target.value)} aria-label={t('admin.orderStaffFilter')}>
                  <option value="all">{t('admin.orderStaffAll')}</option>
                  {orderStaffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={orderDateFilter}
                  onChange={(e) => {
                    const value = e.target.value;
                    setOrderDateFilter(value);
                    setOrderDatePreset(value ? 'custom' : 'all');
                  }}
                  aria-label={t('admin.orderDateFilter')}
                />
                {(orderSourceFilter !== 'all' || orderStaffFilter !== 'all' || orderDatePreset !== 'all' || orderDateFilter || orderSearch) ? (
                  <button
                    type="button"
                    className="wp-button wp-button--secondary wp-button--small"
                    onClick={clearOrderFilters}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
              <label className="admin-orders-search">
                <span className="admin-orders-search__label">{t('admin.orderReceiptSearchLabel')}</span>
                <input
                  type="search"
                  className="admin-orders-search__input"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder={t('admin.orderReceiptSearchPh')}
                  aria-label={t('admin.orderReceiptSearchLabel')}
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {orderSearch.trim() ? (
                  <span className="admin-orders-search__meta">
                    {t('admin.orderReceiptSearchResults', {
                      count: filteredOrders.length,
                      total: orders.length,
                    })}
                  </span>
                ) : (
                  <span className="admin-orders-search__meta">
                    {filteredOrders.length} of {orders.length} orders — click ▶ or order # to open bill
                  </span>
                )}
              </label>
              <p className="admin-orders-print-hint">{t('admin.orderThermalPrintHint')}</p>
            <div className="admin-orders-list">
              {filteredOrders.length === 0 ? (
                <div className="empty-state glass-card">
                  {hasOrderSearch ? t('admin.orderReceiptSearchEmpty') : 'Is filter mein koi order nahi.'}
                </div>
              ) : (
                <AdminOrdersTable
                  orders={filteredOrders}
                  allOrders={orders}
                  expandedId={expandedOrderId}
                  onToggleExpand={setExpandedOrderId}
                  highlightId={highlightOrderId}
                  onUpdateStatus={updateOrderStatus}
                  onMarkPaid={markOrderPaid}
                  onAssignRider={assignOrderRider}
                  onMarkDelivered={markOrderDelivered}
                  onBookPostEx={bookOrderPostEx}
                  t={t}
                />
              )}
            </div>
            </>
          ) : tab === 'customers' ? (
            <AdminCustomers />
          ) : tab === 'stock' && showProductManagement ? (
            <AdminStockManager
              products={products}
              currentUser={user}
              stockFilter={stockFilter}
              onStockFilterChange={handleStockFilterChange}
              lowStockCount={lowStockCount}
              onProductUpdated={(updated) =>
                setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
            />
          ) : tab === 'stock' ? (
            <div className="wp-empty">{t('admin.productManagerOnly')}</div>
          ) : tab === 'sheet' ? (
            <AdminProductsSheet
              products={products}
              currentUser={user}
              onProductsChange={loadData}
              onProductUpdated={(updated) =>
                setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
            />
          ) : tab === 'products' ? (
            <>
              <div className="wp-toolbar">
                <div className="wp-toolbar-left">
                  {showProductManagement ? (
                    <button type="button" className="wp-button" onClick={() => { setEditingProduct(null); setTab('add'); }}>
                      Add new product
                    </button>
                  ) : null}
                </div>
                <div className="wp-toolbar-right">
                  <span style={{ fontSize: '0.84rem', color: '#50575e' }}>{filteredProducts.length} of {products.length}</span>
                </div>
              </div>
              <div className="wp-filter-bar">
                <input
                  type="search"
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  aria-label="Search products"
                />
                <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} aria-label="Filter by category">
                  <option value="all">All categories</option>
                  {productCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select value={productStockFilter} onChange={(e) => setProductStockFilter(e.target.value)} aria-label="Filter by stock">
                  <option value="all">All stock</option>
                  <option value="in_stock">In stock</option>
                  <option value="low_stock">Low stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
                <select value={productStatusFilter} onChange={(e) => setProductStatusFilter(e.target.value)} aria-label="Filter by status">
                  <option value="all">All statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.84rem' }}>
                  <input type="checkbox" checked={productOnSale} onChange={(e) => setProductOnSale(e.target.checked)} />
                  On sale only
                </label>
                {(productSearch || productCategory !== 'all' || productStockFilter !== 'all' || productStatusFilter !== 'all' || productOnSale) && (
                  <button
                    type="button"
                    className="wp-button wp-button--secondary wp-button--small"
                    onClick={() => {
                      setProductSearch('');
                      setProductCategory('all');
                      setProductStockFilter('all');
                      setProductStatusFilter('all');
                      setProductOnSale(false);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {allowDelete && selectedProductIds.length > 0 && (
                <div className="wp-bulk-bar">
                  <span>{selectedProductIds.length} selected</span>
                  <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={() => setSelectedProductIds([])}>
                    Clear selection
                  </button>
                  <button type="button" className="wp-button wp-button--small" onClick={handleBulkDelete} disabled={bulkLoading}>
                    {bulkLoading ? 'Deleting…' : 'Delete selected'}
                  </button>
                </div>
              )}
              {filteredProducts.length === 0 ? (
                <div className="wp-empty">
                  <p>{products.length === 0 ? t('admin.noProducts') : 'No products match these filters.'}</p>
                  {products.length === 0 && showProductManagement ? (
                    <button type="button" className="wp-button" style={{ marginTop: '0.75rem' }} onClick={() => setTab('add')}>
                      Add new product
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="wp-table-wrap">
                  <table className="wp-table">
                    <thead>
                      <tr>
                        {allowDelete ? (
                          <th style={{ width: 36 }}>
                            <input
                              type="checkbox"
                              aria-label="Select all"
                              checked={
                                filteredProducts.filter((p) => canEditProduct(user, p)).length > 0
                                && filteredProducts.filter((p) => canEditProduct(user, p)).every((p) => selectedProductIds.includes(p.id))
                              }
                              onChange={toggleSelectAllProducts}
                            />
                          </th>
                        ) : null}
                        <th style={{ width: 56 }} />
                        <ProductSortHeader label="Name" sortKey="name" activeKey={productSort.key} dir={productSort.dir} onSort={toggleProductSort} />
                        <ProductSortHeader label="Stock" sortKey="stock" activeKey={productSort.key} dir={productSort.dir} onSort={toggleProductSort} />
                        <ProductSortHeader label="Price" sortKey="price" activeKey={productSort.key} dir={productSort.dir} onSort={toggleProductSort} />
                        <th>Category</th>
                        <ProductSortHeader label="Brand" sortKey="brand" activeKey={productSort.key} dir={productSort.dir} onSort={toggleProductSort} />
                        <th>Status</th>
                        <ProductSortHeader label="Date" sortKey="date" activeKey={productSort.key} dir={productSort.dir} onSort={toggleProductSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProducts.map((p) => {
                        const editable = canEditProduct(user, p);
                        const stockStatus = getStockStatus(p.stock);
                        return (
                          <tr key={p.id}>
                            {allowDelete ? (
                              <td>
                                {editable ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedProductIds.includes(p.id)}
                                    onChange={() => toggleProductSelect(p.id)}
                                    aria-label={`Select ${p.name}`}
                                  />
                                ) : null}
                              </td>
                            ) : null}
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
                                    <button type="button" onClick={() => handleDuplicateProduct(p)}>Duplicate</button>
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
                            <td>{p.category || '—'}</td>
                            <td>{p.brand || '—'}</td>
                            <td>
                              <span className={`wp-status-badge wp-status-badge--${p.status || 'published'}`}>
                                {(p.status || 'published') === 'draft' ? 'Draft' : 'Published'}
                              </span>
                            </td>
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
                    <AdminBookingCard
                      key={b.id}
                      booking={b}
                      chatUnread={repairChatUnread[b.id] || 0}
                      onOpenChat={() => setChatBooking(b)}
                      onStatusChange={updateStatus}
                      costValue={costDrafts[b.id] ?? (b.estimated_cost ?? '')}
                      onCostChange={(id, value) => setCostDrafts((prev) => ({ ...prev, [id]: value }))}
                      onSaveCost={saveEstimatedCost}
                      costSaving={Boolean(costSaving[b.id])}
                      noteValue={noteDrafts[b.id] || ''}
                      onNoteChange={(id, value) => setNoteDrafts((prev) => ({ ...prev, [id]: value }))}
                      onSaveNote={saveBookingNote}
                      noteSaving={Boolean(noteSaving[b.id])}
                      onUpdated={updateBookingInList}
                      t={t}
                    />
                  ))
                )}
              </div>
            </>
          )}
      {chatBooking ? (
        <RepairChatModal
          booking={chatBooking}
          mode="staff"
          onClose={() => {
            setChatBooking(null);
            loadRepairChats();
          }}
          onUnreadChange={(count) => {
            setRepairChatUnread((prev) => ({ ...prev, [chatBooking.id]: count }));
          }}
        />
      ) : null}
    </AdminLayout>
  );
}
