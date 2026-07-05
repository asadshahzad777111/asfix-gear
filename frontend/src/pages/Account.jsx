import { useCallback, useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { api, formatPrice } from '../api/client';

import { useAuth } from '../context/AuthContext';

import { useTranslation } from '../context/LanguageContext';

import PageHeader from '../components/PageHeader';

import RepairRateBot from '../components/account/RepairRateBot';
import AddressBook from '../components/account/AddressBook';
import OrderHelpActions from '../components/OrderHelpActions';
import RepairTimeline from '../components/RepairTimeline';
import RepairPhotosGrid from '../components/RepairPhotosGrid';
import { getOrderCustomerStatus } from '../utils/orderStatus';



const COMPLETED_STATUSES = new Set(['delivered']);
const PENDING_STATUSES = new Set(['pending', 'pending_payment']);
const REPAIR_PENDING = new Set(['pending', 'in_progress']);
const REPAIR_DONE = new Set(['completed']);



function paymentLabel(t, mode) {

  if (!mode) return '—';

  const key = `cart.${mode}`;

  const label = t(key);

  return label === key ? mode : label;

}



export default function Account() {

  const { user, logout } = useAuth();

  const { t } = useTranslation();

  const [tab, setTab] = useState('orders');

  const [orders, setOrders] = useState([]);

  const [repairs, setRepairs] = useState([]);

  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [copiedId, setCopiedId] = useState('');



  const loadData = useCallback(async () => {

    setLoading(true);

    setError('');

    try {

      const [orderData, repairData, messageData] = await Promise.all([

        api.getMyOrders(),

        api.getMyRepairs(),

        api.getMyMessages(),

      ]);

      setOrders(orderData);

      setRepairs(repairData);

      setMessages(messageData);

    } catch (err) {

      setError(err.message || t('account.loadFailed'));

    } finally {

      setLoading(false);

    }

  }, [t]);



  useEffect(() => {

    loadData();

  }, [loadData]);



  const sortedOrders = useMemo(

    () => [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),

    [orders],

  );



  const stats = useMemo(() => ({

    total: orders.length,

    pending: orders.filter((o) => PENDING_STATUSES.has(getOrderCustomerStatus(o))).length,

    completed: orders.filter((o) => COMPLETED_STATUSES.has(getOrderCustomerStatus(o))).length,

  }), [orders]);



  const repairStats = useMemo(() => ({

    total: repairs.length,

    pending: repairs.filter((r) => REPAIR_PENDING.has(r.status)).length,

    completed: repairs.filter((r) => REPAIR_DONE.has(r.status)).length,

  }), [repairs]);



  const handleLogout = async () => {

    await logout();

  };



  const copyOrderId = async (orderId) => {

    try {

      await navigator.clipboard.writeText(orderId);

      setCopiedId(orderId);

      setTimeout(() => setCopiedId(''), 2000);

    } catch {

      /* clipboard unavailable */

    }

  };



  const statusLabel = (order) => {

    const status = getOrderCustomerStatus(order);

    const key = `track.status_${status}`;

    const label = t(key);

    return label === key ? status : label;

  };



  const repairStatusLabel = (repair) => {

    const key = `track.repair_status_${repair.status}`;

    const label = t(key);

    return label === key ? repair.status : label;

  };



  return (

    <>

      <PageHeader

        eyebrow={t('account.eyebrow')}

        title={t('account.title')}

        subtitle={`${t('account.welcome')}, ${user?.name || user?.email || user?.phone || ''}`}

      />



      <section className="section" style={{ paddingTop: 0 }}>

        <div className="container">

          <div className="glass-card account-panel">

            <div className="account-panel-head">

              <div>

                <strong>{user?.name}</strong>

                {user?.username && <p>@{user.username}</p>}

                {user?.email && <p>{user.email}</p>}

                {user?.phone && <p>{user.phone}</p>}

              </div>

              <button type="button" className="btn btn-ghost" onClick={handleLogout}>

                {t('account.logout')}

              </button>

              <Link to="/account/settings" className="btn btn-ghost">

                {t('nav.settings')}

              </Link>

            </div>



            <div className="account-tabs">

              <button

                type="button"

                className={tab === 'orders' ? 'active' : ''}

                onClick={() => setTab('orders')}

              >

                {t('account.ordersTab')} ({orders.length})

              </button>

              <button

                type="button"

                className={tab === 'messages' ? 'active' : ''}

                onClick={() => setTab('messages')}

              >

                {t('account.messagesTab')} ({messages.length})

              </button>

              <button

                type="button"

                className={tab === 'addresses' ? 'active' : ''}

                onClick={() => setTab('addresses')}

              >

                {t('address.tab')}

              </button>

              <button

                type="button"

                className={tab === 'repairs' ? 'active' : ''}

                onClick={() => setTab('repairs')}

              >

                {t('account.repairsTab')} ({repairs.length})

              </button>

              <button

                type="button"

                className={tab === 'rates' ? 'active' : ''}

                onClick={() => setTab('rates')}

              >

                {t('account.ratesTab')}

              </button>

            </div>



            {error && tab !== 'rates' && tab !== 'repairs' && <div className="alert alert-error">{error}</div>}



            {tab === 'rates' ? (

              <RepairRateBot />

            ) : tab === 'addresses' ? (

              <AddressBook />

            ) : tab === 'repairs' ? (

              loading ? (

                <p className="loading">{t('common.loading')}</p>

              ) : repairs.length === 0 ? (

                <div className="account-empty">

                  <p>{t('account.noRepairs')}</p>

                  <Link to="/repair" className="btn btn-primary">{t('nav.repair')}</Link>

                </div>

              ) : (

                <>

                  <div className="account-order-stats">

                    <div className="account-stat-card">

                      <span className="account-stat-value">{repairStats.total}</span>

                      <span className="account-stat-label">{t('account.repairStatsTotal')}</span>

                    </div>

                    <div className="account-stat-card account-stat-card--pending">

                      <span className="account-stat-value">{repairStats.pending}</span>

                      <span className="account-stat-label">{t('account.repairStatsPending')}</span>

                    </div>

                    <div className="account-stat-card account-stat-card--done">

                      <span className="account-stat-value">{repairStats.completed}</span>

                      <span className="account-stat-label">{t('account.repairStatsCompleted')}</span>

                    </div>

                  </div>



                  <ul className="account-list account-order-list">

                    {repairs.map((repair) => {

                      const ref = repair.booking_ref || `ASF-R-${repair.id}`;

                      const refClean = String(ref).replace(/^#/, '');

                      return (

                        <li key={refClean} className="account-list-item account-order-card account-repair-card">

                          <div className="order-success-id-card account-order-id-box">

                            <span className="order-success-id-label">{t('account.repairIdLabel')}</span>

                            <div className="order-success-id-row">

                              <strong className="order-success-id-value">#{refClean}</strong>

                              <button

                                type="button"

                                className="btn btn-outline btn-sm order-success-copy"

                                onClick={() => copyOrderId(refClean)}

                              >

                                {copiedId === refClean ? t('account.copied') : t('account.copyOrderId')}

                              </button>

                            </div>

                          </div>



                          <div className="account-order-head">

                            <span className={`order-status-pill status-${repair.status}`}>

                              {repairStatusLabel(repair)}

                            </span>

                            {repair.estimated_cost != null && Number(repair.estimated_cost) > 0 && (

                              <strong>{formatPrice(repair.estimated_cost)}</strong>

                            )}

                          </div>



                          <div className="account-order-meta">

                            <p>

                              <span>{t('account.repairDevice')}</span>{' '}

                              <strong>{repair.device_brand} {repair.device_model}</strong>

                            </p>

                            {repair.issue && (

                              <p>

                                <span>{t('account.repairIssue')}</span>{' '}

                                <strong>{repair.issue}</strong>

                              </p>

                            )}

                            {repair.estimated_repair_time && (

                              <p>

                                <span>{t('account.repairEstTime')}</span>{' '}

                                <strong>{repair.estimated_repair_time}</strong>

                              </p>

                            )}

                            <p className="account-list-meta">

                              {new Date(repair.created_at).toLocaleString()}

                            </p>

                          </div>



                          <RepairTimeline status={repair.status} statusHistory={repair.status_history} />

                          <RepairPhotosGrid photosBefore={repair.photos_before} photosAfter={repair.photos_after} />



                          <Link

                            to={`/track?tab=repair&bookingId=${encodeURIComponent(refClean)}&phone=${encodeURIComponent(user?.phone || '')}`}

                            className="btn btn-outline btn-sm account-track-btn"

                          >

                            {t('account.trackRepair')}

                          </Link>

                        </li>

                      );

                    })}

                  </ul>

                </>

              )

            ) : loading ? (

              <p className="loading">{t('common.loading')}</p>

            ) : tab === 'orders' ? (

              orders.length === 0 ? (

                <div className="account-empty">

                  <p>{t('account.noOrders')}</p>

                  <Link to="/shop" className="btn btn-primary">{t('nav.shop')}</Link>

                </div>

              ) : (

                <>

                  <div className="account-order-stats">

                    <div className="account-stat-card">

                      <span className="account-stat-value">{stats.total}</span>

                      <span className="account-stat-label">{t('account.statsTotal')}</span>

                    </div>

                    <div className="account-stat-card account-stat-card--pending">

                      <span className="account-stat-value">{stats.pending}</span>

                      <span className="account-stat-label">{t('account.statsPending')}</span>

                    </div>

                    <div className="account-stat-card account-stat-card--done">

                      <span className="account-stat-value">{stats.completed}</span>

                      <span className="account-stat-label">{t('account.statsCompleted')}</span>

                    </div>

                  </div>



                  <ul className="account-list account-order-list">

                    {sortedOrders.map((order) => {

                      const orderRef = order.order_id || `#${order.id}`;

                      const orderIdClean = String(orderRef).replace(/^#/, '');

                      const itemCount = (order.items || []).reduce((sum, i) => sum + Number(i.qty || 1), 0);

                      return (

                        <li key={order.id} className="account-list-item account-order-card">

                          <div className="order-success-id-card account-order-id-box">

                            <span className="order-success-id-label">{t('account.orderIdLabel')}</span>

                            <div className="order-success-id-row">

                              <strong className="order-success-id-value">#{orderIdClean}</strong>

                              <button

                                type="button"

                                className="btn btn-outline btn-sm order-success-copy"

                                onClick={() => copyOrderId(orderIdClean)}

                              >

                                {copiedId === orderIdClean ? t('account.copied') : t('account.copyOrderId')}

                              </button>

                            </div>

                          </div>



                          <div className="account-order-head">

                            <span className={`order-status-pill status-${getOrderCustomerStatus(order)}`}>

                              {statusLabel(order)}

                            </span>

                            <strong>{formatPrice(order.total_amount)}</strong>

                          </div>



                          <div className="account-order-meta">

                            <p>

                              <span>{t('account.paymentVia')}</span>{' '}

                              <strong>{paymentLabel(t, order.payment_mode)}</strong>

                            </p>

                            <p>

                              <span>{t('account.orderCity')}</span>{' '}

                              <strong>{order.city || '—'}</strong>

                            </p>

                            {order.shipping_address?.text && (

                              <p>

                                <span>{t('track.deliveryAddress')}</span>{' '}

                                <strong>{order.shipping_address.text}</strong>

                              </p>

                            )}

                            {order.rider_phone && (

                              <p>

                                <span>{t('track.riderPhone')}</span>{' '}

                                <strong>{order.rider_phone}</strong>

                                {Number(order.delivery_charge) > 0 && (

                                  <> · {t('track.deliveryCharge')}: {formatPrice(order.delivery_charge)}</>

                                )}

                              </p>

                            )}

                            <p>

                              <span>{t('account.orderItems')}</span>{' '}

                              <strong>{t('account.itemsCount', { count: itemCount })}</strong>

                            </p>

                            <p className="account-list-meta">

                              {new Date(order.created_at).toLocaleString()}

                            </p>

                          </div>



                          <Link

                            to={`/track?orderId=${encodeURIComponent(orderIdClean)}&phone=${encodeURIComponent(user?.phone || order.phone || '')}`}

                            className="btn btn-outline btn-sm account-track-btn"

                          >

                            {t('account.trackOrder')}

                          </Link>

                          <OrderHelpActions
                            orderId={orderIdClean}
                            phone={user?.phone || order.phone || ''}
                            compact
                            className="account-order-help"
                          />

                        </li>

                      );

                    })}

                  </ul>

                </>

              )

            ) : messages.length === 0 ? (

              <div className="account-empty">

                <p>{t('account.noMessages')}</p>

                <Link to="/contact" className="btn btn-primary">{t('nav.contact')}</Link>

              </div>

            ) : (

              <ul className="account-list">

                {messages.map((msg) => (

                  <li key={msg.id} className="account-list-item">

                    <p>{msg.message}</p>

                    {msg.staff_reply && (

                      <blockquote className="account-reply">

                        <strong>{t('account.staffReply')}</strong> {msg.staff_reply}

                      </blockquote>

                    )}

                    <p className="account-list-meta">{new Date(msg.created_at).toLocaleString()}</p>

                  </li>

                ))}

              </ul>

            )}

          </div>

        </div>

      </section>

    </>

  );

}


