import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import OrderTimeline from '../components/OrderTimeline';
import OrderFeedbackForm from '../components/OrderFeedbackForm';

export default function OrderTrack() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [orderId, setOrderId] = useState(params.get('orderId') || '');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (e) => {
    e?.preventDefault();
    if (!orderId.trim() || !phone.trim()) {
      setError(t('track.errRequired'));
      return;
    }
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const data = await api.trackOrder(orderId.trim(), phone.trim());
      setOrder(data);
    } catch (err) {
      setError(err.message || t('track.notFound'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get('orderId') && params.get('phone')) {
      lookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page order-track-page">
      <section className="order-track-hero glass-card">
        <span className="section-eyebrow">{t('track.eyebrow')}</span>
        <h1>{t('track.title')}</h1>
        <p>{t('track.subtitle')}</p>

        <form className="order-track-form" onSubmit={lookup}>
          <input
            placeholder={t('track.orderIdPh')}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
          <input
            type="tel"
            placeholder={t('track.phonePh')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button type="submit" className="btn btn-primary premium-btn" disabled={loading}>
            {loading ? t('track.searching') : t('track.search')}
          </button>
        </form>
        {error && <div className="alert alert-error">{error}</div>}
      </section>

      {order && (
        <section className="order-track-result glass-card">
          <div className="order-track-result-head">
            <div>
              <h2>#{order.order_id}</h2>
              <p>{order.customer_name} · {order.city}</p>
            </div>
            <span className={`order-status-pill status-${order.shipping_status}`}>
              {t(`track.status_${order.shipping_status}`) || order.shipping_status}
            </span>
          </div>

          <OrderTimeline status={order.shipping_status} statusHistory={order.status_history} />

          <ul className="order-track-items">
            {order.items.map((item, idx) => (
              <li key={idx}>
                {item.name} ×{item.qty}
                <span>{formatPrice(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="order-track-total">{t('track.total')}: <strong>{formatPrice(order.total_amount)}</strong></p>

          {['delivered', 'shipped', 'out_for_delivery', 'payment_verified'].includes(order.shipping_status) && (
            <OrderFeedbackForm
              orderId={order.order_id}
              phone={phone}
              existing={order.customer_feedback}
            />
          )}
        </section>
      )}

      <p className="order-track-back">
        <Link to="/shop">← {t('track.backShop')}</Link>
      </p>
    </main>
  );
}
