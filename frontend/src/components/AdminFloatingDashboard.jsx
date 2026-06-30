import { useCallback, useEffect, useState } from 'react';

import { Link } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';

import { api, formatPrice } from '../api/client';

import { canManageTeam, roleLabel, canManageShopSettings, canViewSalesReport } from '../config/permissions';

import AddProductModal from './AddProductModal';

import AdminChatInbox from './AdminChatInbox';

import AdminManagement from './AdminManagement';

import AdminSalesReport from './AdminSalesReport';

import ShopStatusControl from './ShopStatusControl';

import { startVisibilityPoll } from '../utils/visibilityPoll';
import { useTranslation } from '../context/LanguageContext';
import { buildOrderReceipt } from '../utils/receipts';

const POLL_MS = 60_000;

const ORDER_STATUSES = ['pending', 'payment_verified', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

const BOOKING_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];



const ORDER_QUICK_ACTIONS = [

  { status: 'payment_verified', label: 'Verify Payment', short: 'Paid' },

  { status: 'shipped', label: 'Mark Shipped', short: 'Ship' },

  { status: 'out_for_delivery', label: 'Out for Delivery', short: 'Rider' },

  { status: 'delivered', label: 'Mark Delivered', short: 'Done' },

];



function statusBtnLabel(status) {

  const found = ORDER_QUICK_ACTIONS.find((a) => a.status === status);

  return found?.short || status;

}



export default function AdminFloatingDashboard() {

  const { t } = useTranslation();
  const { user, isStaff, logout } = useAuth();

  const [open, setOpen] = useState(false);

  const [tab, setTab] = useState('orders');

  const [addOpen, setAddOpen] = useState(false);



  const [orders, setOrders] = useState([]);

  const [bookings, setBookings] = useState([]);

  const [unreadChat, setUnreadChat] = useState(0);

  const [loading, setLoading] = useState(false);



  const showTeam = canManageTeam(user);

  const showSales = canViewSalesReport(user);

  const showShopControl = canManageShopSettings(user);



  const loadDesk = useCallback(async () => {

    if (!isStaff) return;

    setLoading(true);

    try {

      const [o, b, m] = await Promise.all([

        api.getOrders(),

        api.getBookings(),

        api.getContactMessages(),

      ]);

      setOrders(o);

      setBookings(b);

      setUnreadChat(m.filter((msg) => !msg.staff_reply).length);

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);

    }

  }, [isStaff]);



  useEffect(() => {

    if (!isStaff) return undefined;

    loadDesk();

    return startVisibilityPoll(loadDesk, POLL_MS);

  }, [isStaff, loadDesk]);



  useEffect(() => {

    if (open && isStaff) loadDesk();

  }, [open, isStaff, loadDesk]);



  if (!isStaff || !user) return null;



  const pendingOrders = orders.filter((o) => o.shipping_status === 'pending').length;

  const pendingRepairs = bookings.filter((b) => b.status === 'pending').length;



  const updateOrder = async (id, shipping_status) => {

    try {

      const updated = await api.updateOrderStatus(id, shipping_status);

      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

    } catch (err) {

      alert(err.message);

    }

  };



  const updateBooking = async (id, status) => {

    try {

      const updated = await api.updateBookingStatus(id, status);

      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

    } catch (err) {

      alert(err.message);

    }

  };



  return (

    <>

      <div className={`admin-float-desk ${open ? 'is-open' : ''}`}>

        <button

          type="button"

          className="admin-float-tab"

          onClick={() => setOpen((v) => !v)}

          aria-expanded={open}

          aria-label="Staff operations desk"

        >

          <span className="admin-float-tab-icon">⚡</span>

          <span className="admin-float-tab-label">Ops</span>

          {(pendingOrders + pendingRepairs + unreadChat) > 0 && (

            <span className="admin-float-tab-badge">{pendingOrders + pendingRepairs + unreadChat}</span>

          )}

        </button>



        <AnimatePresence>

          {open && (

            <motion.aside

              className="admin-float-panel glass-card"

              initial={{ x: -24, opacity: 0, scale: 0.98 }}

              animate={{ x: 0, opacity: 1, scale: 1 }}

              exit={{ x: -24, opacity: 0, scale: 0.98 }}

              transition={{ type: 'spring', stiffness: 380, damping: 32 }}

            >

              <div className="admin-float-head">

                <div>

                  <span className="admin-float-badge">Authorized Staff</span>

                  <h3>Operations Desk</h3>

                  <p>{user.username} · {roleLabel(user.role)}</p>

                </div>

                <div className="admin-float-head-actions">

                  <button type="button" className="admin-float-add" onClick={() => setAddOpen(true)} title="Add product">

                    +

                  </button>

                  <button type="button" className="admin-float-close" onClick={() => setOpen(false)} aria-label="Close">

                    ✕

                  </button>

                </div>

              </div>



              {showShopControl && <ShopStatusControl compact />}



              <div className="admin-float-tabs">

                <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>

                  Orders {pendingOrders > 0 && <em>{pendingOrders}</em>}

                </button>

                <button type="button" className={tab === 'repairs' ? 'active' : ''} onClick={() => setTab('repairs')}>

                  Repairs {pendingRepairs > 0 && <em>{pendingRepairs}</em>}

                </button>

                <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>

                  Chat {unreadChat > 0 && <em>{unreadChat}</em>}

                </button>

                {showSales && (

                  <button type="button" className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>

                    {t('sales.tab')}

                  </button>

                )}

                {showTeam && (

                  <button type="button" className={tab === 'team' ? 'active' : ''} onClick={() => setTab('team')}>

                    {t('team.manageTeam')}

                  </button>

                )}

              </div>



              <div className="admin-float-body">

                {loading && tab !== 'chat' && tab !== 'team' && tab !== 'sales' ? (

                  <div className="loading">Syncing...</div>

                ) : tab === 'orders' ? (

                  orders.length === 0 ? (

                    <p className="admin-float-empty">No orders yet.</p>

                  ) : (

                    orders.map((o) => (

                      <article key={o.id} className="admin-float-card">

                        <div className="admin-float-card-head">

                          <strong>#{o.order_id || o.id} · {o.customer_name}</strong>

                          <span>{formatPrice(o.total_amount)}</span>

                        </div>

                        <p className="admin-float-meta">{o.phone} · {o.city || 'No city'} · {o.payment_mode}</p>

                        {o.gmail && <p className="admin-float-sub">📩 {o.gmail}</p>}

                        <ul className="admin-float-items">

                          {o.items.map((item, idx) => (

                            <li key={idx}>
                              {item.name} ×{item.qty}
                              {item.price != null && (
                                <span className="admin-float-item-price"> — {formatPrice(Number(item.price) * Number(item.qty || 1))}</span>
                              )}
                            </li>

                          ))}

                        </ul>

                        <div className="admin-float-receipt-actions">
                          <a
                            href={buildOrderReceipt(o, { showCost: false }).waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                          >
                            {t('sales.receiptCustomer')}
                          </a>
                          <a
                            href={buildOrderReceipt(o, { showCost: true }).waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                          >
                            {t('sales.receiptStaff')}
                          </a>
                        </div>

                        <div className="admin-order-actions">

                          {ORDER_QUICK_ACTIONS.map((action) => (

                            <button

                              key={action.status}

                              type="button"

                              className={`btn btn-outline btn-sm admin-status-btn ${o.shipping_status === action.status ? 'active' : ''}`}

                              disabled={o.shipping_status === action.status}

                              onClick={() => updateOrder(o.id, action.status)}

                              title={action.label}

                            >

                              {statusBtnLabel(action.status)}

                            </button>

                          ))}

                        </div>

                        <select

                          className="status-select"

                          value={o.shipping_status}

                          onChange={(e) => updateOrder(o.id, e.target.value)}

                        >

                          {ORDER_STATUSES.map((s) => (

                            <option key={s} value={s}>{s}</option>

                          ))}

                        </select>

                        {o.activity_log?.length > 0 && (

                          <p className="admin-float-activity">{o.activity_log[o.activity_log.length - 1].message}</p>

                        )}

                      </article>

                    ))

                  )

                ) : tab === 'repairs' ? (

                  bookings.length === 0 ? (

                    <p className="admin-float-empty">No repair intakes.</p>

                  ) : (

                    bookings.map((b) => (

                      <article key={b.id} className="admin-float-card">

                        <div className="admin-float-card-head">

                          <strong>{b.booking_ref ? `#${b.booking_ref}` : b.customer_name}</strong>

                          <span>{b.phone}</span>

                        </div>

                        <p className="admin-float-meta">{b.device_brand} {b.device_model}</p>

                        <p className="admin-float-issue">{b.issue || '—'}</p>

                        {b.screen_quality && <p className="admin-float-sub">Screen: {b.screen_quality}</p>}

                        {b.estimated_repair_time && (

                          <p className="admin-float-sub">Est: {b.estimated_repair_time}</p>

                        )}

                        <select

                          className="status-select"

                          value={b.status}

                          onChange={(e) => updateBooking(b.id, e.target.value)}

                        >

                          {BOOKING_STATUSES.map((s) => (

                            <option key={s} value={s}>{s}</option>

                          ))}

                        </select>

                        {b.activity_log?.length > 0 && (

                          <p className="admin-float-activity">{b.activity_log[b.activity_log.length - 1].message}</p>

                        )}

                      </article>

                    ))

                  )

                ) : tab === 'chat' ? (

                  <AdminChatInbox compact onUnreadChange={setUnreadChat} />

                ) : tab === 'sales' && showSales ? (

                  <AdminSalesReport compact />

                ) : tab === 'team' && showTeam ? (

                  <div className="admin-float-team">

                    <AdminManagement compact />

                  </div>

                ) : null}

              </div>



              <div className="admin-float-foot">

                <Link to="/admin?tab=messages" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>

                  Full Admin

                </Link>

                <button type="button" className="btn btn-outline btn-sm" onClick={loadDesk}>

                  Refresh

                </button>

                <button type="button" className="btn btn-outline btn-sm" onClick={logout}>

                  Logout

                </button>

              </div>

            </motion.aside>

          )}

        </AnimatePresence>

      </div>



      <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={() => setAddOpen(false)} />

    </>

  );

}

