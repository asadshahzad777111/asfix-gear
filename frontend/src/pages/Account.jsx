import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';

export default function Account() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, messageData] = await Promise.all([
        api.getMyOrders(),
        api.getMyMessages(),
      ]);
      setOrders(orderData);
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

  const handleLogout = async () => {
    await logout();
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
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
              <p className="loading">{t('common.loading')}</p>
            ) : tab === 'orders' ? (
              orders.length === 0 ? (
                <div className="account-empty">
                  <p>{t('account.noOrders')}</p>
                  <Link to="/shop" className="btn btn-primary">{t('nav.shop')}</Link>
                </div>
              ) : (
                <ul className="account-list">
                  {orders.map((order) => (
                    <li key={order.id} className="account-list-item">
                      <div>
                        <strong>#{order.order_id || order.id}</strong>
                        <span>{order.shipping_status}</span>
                      </div>
                      <p>{formatPrice(order.total_amount)} · {order.city || '—'}</p>
                      <p className="account-list-meta">{new Date(order.created_at).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
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
