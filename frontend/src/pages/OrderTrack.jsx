import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import OrderTimeline from '../components/OrderTimeline';
import RepairTimeline from '../components/RepairTimeline';
import RepairPhotosGrid from '../components/RepairPhotosGrid';
import { RepairChatButton, RepairChatModal, RepairChatLoginPrompt } from '../components/RepairChatPanel';
import OrderFeedbackForm from '../components/OrderFeedbackForm';
import OrderHelpActions from '../components/OrderHelpActions';
import OrderCancelRequest from '../components/OrderCancelRequest';
import BackButton from '../components/BackButton';
import CustomerOrderCard from '../components/account/CustomerOrderCard';
import useLiveUpdates from '../hooks/useLiveUpdates';
import { startVisibilityPoll } from '../utils/visibilityPoll';
import { getOrderCustomerStatus } from '../utils/orderStatus';
import { filterOrders } from '../utils/orderSearch';
import { whatsappLink } from '../config/shop';
import './order-track.css';

export default function OrderTrack() {
  const { t } = useTranslation();
  const { isCustomer, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialTab = params.get('tab') === 'repair' ? 'repair' : 'order';

  const [activeTab, setActiveTab] = useState(initialTab);

  const [orderId, setOrderId] = useState(() => {
    const fromUrl = params.get('orderId');
    if (fromUrl) return fromUrl;
    try {
      const saved = JSON.parse(localStorage.getItem('asfix_last_track_order') || 'null');
      return saved?.orderId || '';
    } catch {
      return '';
    }
  });
  const [phone, setPhone] = useState(() => {
    const fromUrl = params.get('phone');
    if (fromUrl) return fromUrl;
    try {
      const saved = JSON.parse(localStorage.getItem('asfix_last_track_order') || 'null');
      return saved?.phone || '';
    } catch {
      return '';
    }
  });
  const [order, setOrder] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);

  const [myOrders, setMyOrders] = useState([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const [bookingId, setBookingId] = useState(params.get('bookingId') || '');
  const [repairPhone, setRepairPhone] = useState(params.get('phone') || '');
  const [repair, setRepair] = useState(null);
  const [repairError, setRepairError] = useState('');
  const [repairLoading, setRepairLoading] = useState(false);
  const [chatRepair, setChatRepair] = useState(null);

  const helpWhatsAppHref = whatsappLink(
    activeTab === 'repair'
      ? `Assalam o Alaikum AsFix! Repair track help chahiye. Booking: ${bookingId || '—'}`
      : `Assalam o Alaikum AsFix! Order track help chahiye. Order: ${orderId || '—'}`,
  );

  const loadMyOrders = useCallback(async () => {
    if (!isCustomer) return;
    setMyOrdersLoading(true);
    try {
      const data = await api.getMyOrders();
      setMyOrders(data);
    } catch {
      /* guest fallback still works */
    } finally {
      setMyOrdersLoading(false);
    }
  }, [isCustomer]);

  useEffect(() => {
    loadMyOrders();
    if (isCustomer) {
      return startVisibilityPoll(loadMyOrders, 30_000);
    }
    return undefined;
  }, [isCustomer, loadMyOrders]);

  useLiveUpdates({
    enabled: isCustomer,
    onEvent: (event) => {
      if (event.startsWith('order_')) loadMyOrders();
      if (event.startsWith('repair_') || event === 'repair_message') lookupRepairFromState();
    },
  });

  const filteredMyOrders = useMemo(
    () => filterOrders(myOrders, orderSearch),
    [myOrders, orderSearch],
  );

  const selectedFromList = useMemo(() => {
    if (!selectedOrderId) return null;
    return myOrders.find((o) => o.id === selectedOrderId || o.order_id === selectedOrderId) || null;
  }, [myOrders, selectedOrderId]);

  const displayOrder = selectedFromList || order;
  const hasResult = (activeTab === 'order' && displayOrder) || (activeTab === 'repair' && repair);

  const switchTab = (tab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(params);
    if (tab === 'repair') {
      next.set('tab', 'repair');
      if (bookingId) next.set('bookingId', bookingId);
      next.delete('orderId');
    } else {
      next.delete('tab');
      if (orderId) next.set('orderId', orderId);
      next.delete('bookingId');
    }
    if (phone) next.set('phone', phone);
    setParams(next, { replace: true });
  };

  const lookupOrder = async (e) => {
    e?.preventDefault();
    if (!orderId.trim()) {
      setOrderError(t('track.errRequired'));
      return;
    }
    setOrderLoading(true);
    setOrderError('');
    setOrder(null);
    setSelectedOrderId(null);
    try {
      const data = await api.trackOrder(orderId.trim(), phone.trim());
      setOrder(data);
      const next = new URLSearchParams({ orderId: orderId.trim() });
      if (phone.trim()) next.set('phone', phone.trim());
      setParams(next, { replace: true });
    } catch (err) {
      setOrderError(err.message || t('track.notFound'));
    } finally {
      setOrderLoading(false);
    }
  };

  const lookupRepairFromState = async () => {
    if (!bookingId.trim()) return;
    setRepairLoading(true);
    setRepairError('');
    setRepair(null);
    try {
      const data = await api.trackRepair(bookingId.trim(), repairPhone.trim());
      setRepair(data);
    } catch (err) {
      setRepairError(err.message || t('track.repairNotFound'));
    } finally {
      setRepairLoading(false);
    }
  };

  const lookupRepair = async (e) => {
    e?.preventDefault();
    if (!bookingId.trim()) {
      setRepairError(t('track.repairErrRequired'));
      return;
    }
    await lookupRepairFromState();
    const next = new URLSearchParams({
      tab: 'repair',
      bookingId: bookingId.trim(),
    });
    if (repairPhone.trim()) next.set('phone', repairPhone.trim());
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (initialTab === 'repair' && params.get('bookingId')) {
      lookupRepairFromState();
    } else if (params.get('orderId') && initialTab === 'order' && !isCustomer) {
      lookupOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isCustomer || !myOrders.length) return;
    const urlOrderId = params.get('orderId');
    if (urlOrderId) {
      const match = myOrders.find(
        (o) => String(o.order_id).replace(/^#/, '') === urlOrderId.replace(/^#/, ''),
      );
      if (match) setSelectedOrderId(match.id);
    }
  }, [isCustomer, myOrders, params]);

  const customerStatus = displayOrder ? getOrderCustomerStatus(displayOrder) : null;

  const selectMyOrder = (entry) => {
    setSelectedOrderId(entry.id);
    setOrder(null);
    setOrderError('');
    const clean = String(entry.order_id || entry.id).replace(/^#/, '');
    const next = new URLSearchParams({ orderId: clean });
    if (entry.phone || user?.phone) next.set('phone', entry.phone || user?.phone || '');
    setParams(next, { replace: true });
  };

  return (
    <main className={`page order-track-page${hasResult ? ' order-track-page--has-result' : ''}`}>
      <div className="order-track-page__inner">
        <div className="order-track-page__back">
          <BackButton className="back-nav-btn--spaced" />
        </div>

        <header className="order-track-heading">
          <h1>{t('track.pageTitle')}</h1>
          <p>{t('track.pageSubtitle')}</p>
        </header>

        <div className="order-track-layout">
          <section className="order-track-hero glass-card">
            <div className="track-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'order'}
                className={activeTab === 'order' ? 'active' : ''}
                onClick={() => switchTab('order')}
              >
                {t('track.ordersTab')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'repair'}
                className={activeTab === 'repair' ? 'active' : ''}
                onClick={() => switchTab('repair')}
              >
                {t('track.repairsTab')}
              </button>
            </div>

            {activeTab === 'order' && isCustomer && (
              <div className="order-track-my-orders">
                <h3>{t('account.ordersTab')}</h3>
                <p className="order-track-my-orders-hint">{t('account.ordersAutoLoad')}</p>
                <input
                  type="search"
                  className="account-order-search"
                  placeholder={t('account.orderSearchPlaceholder')}
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
                {myOrdersLoading ? (
                  <p className="loading">{t('common.loading')}</p>
                ) : myOrders.length === 0 ? (
                  <p>{t('account.noOrders')}</p>
                ) : filteredMyOrders.length === 0 ? (
                  <p>{t('account.noOrderSearchMatch')}</p>
                ) : (
                  <ul className="order-track-my-list">
                    {filteredMyOrders.map((entry) => {
                      const clean = String(entry.order_id || entry.id).replace(/^#/, '');
                      const active = selectedOrderId === entry.id;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            className={`order-track-my-item ${active ? 'is-active' : ''}`}
                            onClick={() => selectMyOrder(entry)}
                          >
                            <strong>#{clean}</strong>
                            <span>{entry.customer_name}</span>
                            <span className={`order-status-pill status-${getOrderCustomerStatus(entry)}`}>
                              {t(`track.status_${getOrderCustomerStatus(entry)}`) || getOrderCustomerStatus(entry)}
                            </span>
                            <span>{formatPrice(entry.total_amount)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="order-track-guest-divider">{t('track.guestLookupHint')}</p>
              </div>
            )}

            {activeTab === 'order' ? (
              <form className="order-track-form" onSubmit={lookupOrder}>
                <label className="order-track-field">
                  <span>{t('track.orderIdLabelField')}</span>
                  <input
                    className="order-track-input order-track-input--mono"
                    placeholder={t('track.orderIdPh')}
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                </label>
                <label className="order-track-field">
                  <span>
                    {t('track.phoneLabelField')}{' '}
                    <em className="order-track-optional">({t('track.phoneOptional')})</em>
                  </span>
                  <input
                    type="tel"
                    className="order-track-input"
                    placeholder={t('track.phonePh')}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setRepairPhone(e.target.value);
                    }}
                  />
                </label>
                <button type="submit" className="btn btn-primary premium-btn order-track-submit" disabled={orderLoading}>
                  {orderLoading ? t('track.searching') : t('track.search')}
                </button>
              </form>
            ) : (
              <form className="order-track-form" onSubmit={lookupRepair}>
                <label className="order-track-field">
                  <span>{t('track.repairIdLabel')}</span>
                  <input
                    className="order-track-input order-track-input--mono"
                    placeholder={t('track.repairIdPh')}
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                </label>
                <label className="order-track-field">
                  <span>
                    {t('track.phoneLabelField')}{' '}
                    <em className="order-track-optional">({t('track.phoneOptional')})</em>
                  </span>
                  <input
                    type="tel"
                    className="order-track-input"
                    placeholder={t('track.repairPhonePh')}
                    value={repairPhone}
                    onChange={(e) => {
                      setRepairPhone(e.target.value);
                      setPhone(e.target.value);
                    }}
                  />
                </label>
                <button type="submit" className="btn btn-primary premium-btn order-track-submit" disabled={repairLoading}>
                  {repairLoading ? t('track.searching') : t('track.repairSearch')}
                </button>
              </form>
            )}

            {activeTab === 'order' && orderError && <div className="alert alert-error">{orderError}</div>}
            {activeTab === 'repair' && repairError && <div className="alert alert-error">{repairError}</div>}

            <a
              className="order-track-whatsapp"
              href={helpWhatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('track.needHelpWhatsApp')}
            </a>
          </section>

          {activeTab === 'order' && displayOrder && (
            <section className="order-track-result glass-card">
              {isCustomer && selectedFromList ? (
                <CustomerOrderCard
                  order={displayOrder}
                  userPhone={user?.phone || displayOrder.phone || ''}
                  showTrackLink={false}
                />
              ) : (
                <>
                  <div className="order-track-result-top">
                    <div>
                      <span className="order-track-result-kicker">{t('track.orderDetails')}</span>
                      <strong className="order-track-result-id">#{displayOrder.order_id}</strong>
                    </div>
                    <span className={`order-status-pill status-${customerStatus}`}>
                      {t(`track.status_${customerStatus}`) || customerStatus}
                    </span>
                  </div>

                  <div className="order-track-status-banner" role="status">
                    <div>
                      <span className="order-track-result-kicker">{t('track.liveStatus') || 'Live status'}</span>
                      <strong>{t(`track.status_${customerStatus}`) || customerStatus}</strong>
                    </div>
                    {(displayOrder.postex_tracking || displayOrder.tracking_number) && (
                      <p className="order-track-tracking">
                        {t('track.courierTracking') || 'Courier tracking'}:{' '}
                        <strong>{displayOrder.postex_tracking || displayOrder.tracking_number}</strong>
                      </p>
                    )}
                  </div>

                  <div className="order-track-result-head">
                    <div>
                      <h2>{displayOrder.customer_name}</h2>
                      <p>{displayOrder.city}</p>
                    </div>
                  </div>

                  <OrderTimeline order={displayOrder} statusHistory={displayOrder.status_history} />

                  {displayOrder.shipping_address?.text && (
                    <p className="order-track-address">
                      📍 {t('track.deliveryAddress')}: {displayOrder.shipping_address.text}
                    </p>
                  )}

                  {displayOrder.rider_phone && (
                    <div className="order-track-rider glass-card">
                      <p><strong>{t('track.riderPhone')}:</strong> {displayOrder.rider_phone}</p>
                      {Number(displayOrder.delivery_charge) > 0 && (
                        <p><strong>{t('track.deliveryCharge')}:</strong> {formatPrice(displayOrder.delivery_charge)}</p>
                      )}
                    </div>
                  )}

                  <ul className="order-track-items">
                    {displayOrder.items.map((item, idx) => (
                      <li key={idx}>
                        {item.name} ×{item.qty}
                        <span>{formatPrice(item.price * item.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="order-track-total">{t('track.total')}: <strong>{formatPrice(displayOrder.total_amount)}</strong></p>

                  <OrderCancelRequest
                    order={displayOrder}
                    phone={phone || displayOrder.phone || ''}
                    onUpdated={(next) => {
                      if (!next) return;
                      if (selectedFromList) {
                        setMyOrders((prev) =>
                          prev.map((o) =>
                            o.id === displayOrder.id || o.order_id === displayOrder.order_id
                              ? { ...o, ...next }
                              : o
                          )
                        );
                      } else {
                        setOrder((prev) => (prev ? { ...prev, ...next } : prev));
                      }
                    }}
                  />

                  <OrderHelpActions orderId={displayOrder.order_id} phone={phone || displayOrder.phone} />

                  {['delivered', 'shipped', 'out_for_delivery', 'payment_verified', 'rider_assigned', 'waiting_for_rider', 'paid'].includes(customerStatus) && (
                    <OrderFeedbackForm
                      orderId={displayOrder.order_id}
                      phone={phone || displayOrder.phone}
                      orderItems={displayOrder.items}
                      existing={displayOrder.customer_feedback}
                    />
                  )}
                </>
              )}
            </section>
          )}

          {activeTab === 'repair' && repair && (
            <section className="order-track-result glass-card repair-track-result">
              <div className="order-track-result-top">
                <div>
                  <span className="order-track-result-kicker">{t('track.repairIdLabel')}</span>
                  <strong className="order-track-result-id">#{repair.booking_ref}</strong>
                </div>
                <span className={`order-status-pill status-${repair.status}`}>
                  {t(`track.repair_status_${repair.status}`) || repair.status}
                </span>
              </div>

              <div className="order-track-result-head">
                <div>
                  <h2>{repair.customer_name}</h2>
                  <p>{repair.device_brand} {repair.device_model}</p>
                </div>
              </div>

              <RepairTimeline status={repair.status} statusHistory={repair.status_history} />

              {repair.issue && (
                <p className="repair-track-issue">
                  <strong>{t('track.repairIssue')}:</strong> {repair.issue}
                </p>
              )}

              {repair.estimated_repair_time && (
                <p className="repair-track-meta">
                  <strong>{t('track.repairEstTime')}:</strong> {repair.estimated_repair_time}
                </p>
              )}

              {repair.estimated_cost != null && Number(repair.estimated_cost) > 0 && (
                <p className="repair-track-cost">
                  <strong>{t('track.repairEstCost')}:</strong> {formatPrice(repair.estimated_cost)}
                  <small>{t('track.repairCostNote')}</small>
                </p>
              )}

              <RepairPhotosGrid photosBefore={repair.photos_before} photosAfter={repair.photos_after} />

              {isCustomer ? (
                <RepairChatButton booking={repair} onClick={() => setChatRepair(repair)} />
              ) : (
                <RepairChatLoginPrompt />
              )}

              {(repair.status_history || []).length > 0 && (
                <div className="repair-status-notifications glass-card">
                  <h4>{t('track.repairNotifications')}</h4>
                  <ul className="repair-status-notifications-list">
                    {[...(repair.status_history || [])].reverse().map((entry, idx) => (
                      <li key={`${entry.status}-${entry.at}-${idx}`}>
                        <span className={`order-status-pill status-${entry.status}`}>
                          {t(`track.repair_status_${entry.status}`) || entry.status}
                        </span>
                        <small>{entry.at ? new Date(entry.at).toLocaleString() : ''}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <p className="order-track-back">
          {isCustomer ? (
            <Link to="/account">{t('nav.myOrders')} →</Link>
          ) : null}
          {isCustomer ? ' · ' : null}
          <Link to="/shop">← {t('track.backShop')}</Link>
          {activeTab === 'repair' && (
            <> · <Link to="/repair">{t('track.newRepair')}</Link></>
          )}
        </p>
      </div>

      {chatRepair ? (
        <RepairChatModal
          booking={chatRepair}
          mode="customer"
          onClose={() => {
            setChatRepair(null);
            lookupRepairFromState();
          }}
        />
      ) : null}
    </main>
  );
}
