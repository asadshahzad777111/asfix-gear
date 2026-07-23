import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';
import RepairRateBot from '../components/account/RepairRateBot';
import AddressBook from '../components/account/AddressBook';
import CustomerOrderCard from '../components/account/CustomerOrderCard';
import RepairTimeline from '../components/RepairTimeline';
import RepairPhotosGrid from '../components/RepairPhotosGrid';
import { RepairChatButton, RepairChatModal } from '../components/RepairChatPanel';
import useLiveUpdates from '../hooks/useLiveUpdates';
import { startVisibilityPoll } from '../utils/visibilityPoll';
import { getOrderCustomerStatus } from '../utils/orderStatus';
import { filterOrders } from '../utils/orderSearch';

const COMPLETED_STATUSES = new Set(['delivered']);
const PENDING_STATUSES = new Set(['pending', 'pending_payment']);
const REPAIR_PENDING = new Set(['pending', 'in_progress']);
const REPAIR_DONE = new Set(['completed']);

export default function Account() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatRepair, setChatRepair] = useState(null);
  const [copiedId, setCopiedId] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

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
    return startVisibilityPoll(loadData, 30_000);
  }, [loadData]);

  const onLiveEvent = useCallback((event) => {
    if (event.startsWith('order_') || event.startsWith('repair_')) {
      loadData();
    }
    if (event === 'repair_message') {
      loadData();
    }
  }, [loadData]);

  useLiveUpdates({ onEvent: onLiveEvent, enabled: Boolean(user) });

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [orders],
  );

  const visibleOrders = useMemo(
    () => filterOrders(sortedOrders, orderSearch),
    [sortedOrders, orderSearch],
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
              <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
                {t('account.ordersTab')} ({orders.length})
              </button>
              <button type="button" className={tab === 'messages' ? 'active' : ''} onClick={() => setTab('messages')}>
                {t('account.messagesTab')} ({messages.length})
              </button>
              <button type="button" className={tab === 'addresses' ? 'active' : ''} onClick={() => setTab('addresses')}>
                {t('address.tab')}
              </button>
              <button type="button" className={tab === 'repairs' ? 'active' : ''} onClick={() => setTab('repairs')}>
                {t('account.repairsTab')} ({repairs.length})
              </button>
              <button type="button" className={tab === 'rates' ? 'active' : ''} onClick={() => setTab('rates')}>
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
                <div className="account-empty account-empty--motion">
                  <div className="account-empty-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p>{t('account.noRepairs')}</p>
                  <div className="account-empty-actions">
                    <Link to="/repair" className="btn btn-primary">{t('account.emptyRepairsCta')}</Link>
                    <Link to="/shop" className="btn btn-outline">{t('nav.shop')}</Link>
                  </div>
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

                  <ul className="account-list account-order-list account-list--motion">
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

                          <div className="account-repair-actions">
                            <RepairChatButton
                              booking={repair}
                              unread={repair.unread_repair_messages || 0}
                              onClick={() => setChatRepair(repair)}
                            />
                            <Link
                              to={`/track?tab=repair&bookingId=${encodeURIComponent(refClean)}&phone=${encodeURIComponent(user?.phone || '')}`}
                              className="btn btn-outline btn-sm account-track-btn"
                            >
                              {t('account.trackRepair')}
                            </Link>
                          </div>
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
                <div className="account-empty account-empty--motion">
                  <div className="account-empty-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M6 6h15l-1.5 9h-12z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="9" cy="20" r="1.25" fill="currentColor" stroke="none" />
                      <circle cx="18" cy="20" r="1.25" fill="currentColor" stroke="none" />
                      <path d="M6 6 5 3H2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p>{t('account.noOrders')}</p>
                  <div className="account-empty-actions">
                    <Link to="/shop" className="btn btn-primary">{t('account.emptyOrdersCta')}</Link>
                    <Link to="/repair" className="btn btn-outline">{t('nav.repair')}</Link>
                  </div>
                </div>
              ) : (
                <>
                  <p className="account-orders-intro">{t('account.ordersAutoLoad')}</p>

                  <div className="account-order-search-wrap">
                    <input
                      type="search"
                      className="account-order-search"
                      placeholder={t('account.orderSearchPlaceholder')}
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      aria-label={t('account.orderSearchPlaceholder')}
                    />
                    {orderSearch ? (
                      <span className="account-order-search-count">
                        {t('account.orderSearchResults', { count: visibleOrders.length, total: orders.length })}
                      </span>
                    ) : null}
                  </div>

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

                  {visibleOrders.length === 0 ? (
                    <div className="account-empty account-empty--motion">
                      <p>{t('account.noOrderSearchMatch')}</p>
                    </div>
                  ) : (
                    <div className="account-list account-order-list account-list--motion">
                      {visibleOrders.map((order) => (
                        <CustomerOrderCard
                          key={order.id}
                          order={order}
                          userPhone={user?.phone || ''}
                          copiedId={copiedId}
                          onCopyId={copyOrderId}
                          showTrackLink={false}
                        />
                      ))}
                    </div>
                  )}
                </>
              )
            ) : messages.length === 0 ? (
              <div className="account-empty account-empty--motion">
                <div className="account-empty-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p>{t('account.noMessages')}</p>
                <div className="account-empty-actions">
                  <Link to="/contact" className="btn btn-primary">{t('account.emptyMessagesCta')}</Link>
                </div>
              </div>
            ) : (
              <ul className="account-list account-list--motion">
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
      {chatRepair ? (
        <RepairChatModal
          booking={chatRepair}
          mode="customer"
          onClose={() => {
            setChatRepair(null);
            loadData();
          }}
        />
      ) : null}
    </>
  );
}
