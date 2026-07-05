import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import OrderTimeline from '../components/OrderTimeline';
import RepairTimeline from '../components/RepairTimeline';
import RepairPhotosGrid from '../components/RepairPhotosGrid';
import OrderFeedbackForm from '../components/OrderFeedbackForm';
import OrderHelpActions from '../components/OrderHelpActions';
import BackButton from '../components/BackButton';
import { getOrderCustomerStatus } from '../utils/orderStatus';

export default function OrderTrack() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const initialTab = params.get('tab') === 'repair' ? 'repair' : 'order';

  const [activeTab, setActiveTab] = useState(initialTab);

  const [orderId, setOrderId] = useState(params.get('orderId') || '');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [order, setOrder] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);

  const [bookingId, setBookingId] = useState(params.get('bookingId') || '');
  const [repairPhone, setRepairPhone] = useState(params.get('phone') || '');
  const [repair, setRepair] = useState(null);
  const [repairError, setRepairError] = useState('');
  const [repairLoading, setRepairLoading] = useState(false);

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
    if (!orderId.trim() || !phone.trim()) {
      setOrderError(t('track.errRequired'));
      return;
    }
    setOrderLoading(true);
    setOrderError('');
    setOrder(null);
    try {
      const data = await api.trackOrder(orderId.trim(), phone.trim());
      setOrder(data);
      const next = new URLSearchParams({ orderId: orderId.trim(), phone: phone.trim() });
      setParams(next, { replace: true });
    } catch (err) {
      setOrderError(err.message || t('track.notFound'));
    } finally {
      setOrderLoading(false);
    }
  };

  const lookupRepair = async (e) => {
    e?.preventDefault();
    if (!bookingId.trim() || !repairPhone.trim()) {
      setRepairError(t('track.repairErrRequired'));
      return;
    }
    setRepairLoading(true);
    setRepairError('');
    setRepair(null);
    try {
      const data = await api.trackRepair(bookingId.trim(), repairPhone.trim());
      setRepair(data);
      const next = new URLSearchParams({
        tab: 'repair',
        bookingId: bookingId.trim(),
        phone: repairPhone.trim(),
      });
      setParams(next, { replace: true });
    } catch (err) {
      setRepairError(err.message || t('track.repairNotFound'));
    } finally {
      setRepairLoading(false);
    }
  };

  useEffect(() => {
    if (initialTab === 'repair' && params.get('bookingId') && params.get('phone')) {
      lookupRepair();
    } else if (params.get('orderId') && params.get('phone') && initialTab === 'order') {
      lookupOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customerStatus = order ? getOrderCustomerStatus(order) : null;

  return (
    <main className="page order-track-page">
      <div className="container" style={{ paddingTop: '1rem' }}>
        <BackButton className="back-nav-btn--spaced" />
      </div>
      <section className="order-track-hero glass-card">
        <span className="section-eyebrow">{t('track.pageEyebrow')}</span>
        <h1>{t('track.pageTitle')}</h1>
        <p>{t('track.pageSubtitle')}</p>

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

        {activeTab === 'order' ? (
          <form className="order-track-form" onSubmit={lookupOrder}>
            <input
              placeholder={t('track.orderIdPh')}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
            <input
              type="tel"
              placeholder={t('track.phonePh')}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setRepairPhone(e.target.value);
              }}
            />
            <button type="submit" className="btn btn-primary premium-btn" disabled={orderLoading}>
              {orderLoading ? t('track.searching') : t('track.search')}
            </button>
          </form>
        ) : (
          <form className="order-track-form" onSubmit={lookupRepair}>
            <input
              placeholder={t('track.repairIdPh')}
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
            />
            <input
              type="tel"
              placeholder={t('track.repairPhonePh')}
              value={repairPhone}
              onChange={(e) => {
                setRepairPhone(e.target.value);
                setPhone(e.target.value);
              }}
            />
            <button type="submit" className="btn btn-primary premium-btn" disabled={repairLoading}>
              {repairLoading ? t('track.searching') : t('track.repairSearch')}
            </button>
          </form>
        )}

        {activeTab === 'order' && orderError && <div className="alert alert-error">{orderError}</div>}
        {activeTab === 'repair' && repairError && <div className="alert alert-error">{repairError}</div>}
      </section>

      {activeTab === 'order' && order && (
        <section className="order-track-result glass-card">
          <div className="order-success-id-card order-track-id-card">
            <span className="order-success-id-label">{t('track.orderIdLabel')}</span>
            <strong className="order-success-id-value">#{order.order_id}</strong>
            <p className="order-success-save-id">{t('track.saveIdHint')}</p>
          </div>

          <div className="order-track-result-head">
            <div>
              <h2>{order.customer_name}</h2>
              <p>{order.city}</p>
            </div>
            <span className={`order-status-pill status-${customerStatus}`}>
              {t(`track.status_${customerStatus}`) || customerStatus}
            </span>
          </div>

          <OrderTimeline order={order} statusHistory={order.status_history} />

          {order.shipping_address?.text && (
            <p className="order-track-address">
              📍 {t('track.deliveryAddress')}: {order.shipping_address.text}
            </p>
          )}

          {order.rider_phone && (
            <div className="order-track-rider glass-card">
              <p><strong>{t('track.riderPhone')}:</strong> {order.rider_phone}</p>
              {Number(order.delivery_charge) > 0 && (
                <p><strong>{t('track.deliveryCharge')}:</strong> {formatPrice(order.delivery_charge)}</p>
              )}
            </div>
          )}

          <ul className="order-track-items">
            {order.items.map((item, idx) => (
              <li key={idx}>
                {item.name} ×{item.qty}
                <span>{formatPrice(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="order-track-total">{t('track.total')}: <strong>{formatPrice(order.total_amount)}</strong></p>

          <OrderHelpActions orderId={order.order_id} phone={phone} />

          {['delivered', 'shipped', 'out_for_delivery', 'payment_verified', 'rider_assigned', 'waiting_for_rider', 'paid'].includes(customerStatus) && (
            <OrderFeedbackForm
              orderId={order.order_id}
              phone={phone}
              existing={order.customer_feedback}
            />
          )}
        </section>
      )}

      {activeTab === 'repair' && repair && (
        <section className="order-track-result glass-card repair-track-result">
          <div className="order-success-id-card order-track-id-card">
            <span className="order-success-id-label">{t('track.repairIdLabel')}</span>
            <strong className="order-success-id-value">#{repair.booking_ref}</strong>
            <p className="order-success-save-id">{t('track.repairSaveIdHint')}</p>
          </div>

          <div className="order-track-result-head">
            <div>
              <h2>{repair.customer_name}</h2>
              <p>{repair.device_brand} {repair.device_model}</p>
            </div>
            <span className={`order-status-pill status-${repair.status}`}>
              {t(`track.repair_status_${repair.status}`) || repair.status}
            </span>
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

      <p className="order-track-back">
        <Link to="/shop">← {t('track.backShop')}</Link>
        {activeTab === 'repair' && (
          <> · <Link to="/repair">{t('track.newRepair')}</Link></>
        )}
      </p>
    </main>
  );
}
