import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import useLiveUpdates from '../hooks/useLiveUpdates';
import './order-notifications.css';

const DISMISS_MS = 6500;
const MAX_TOASTS = 4;

const OrderNotificationContext = createContext(null);

function customerStatusFromEvent(data) {
  if (data.payment_status === 'pending_payment') return 'pending_payment';
  if (data.delivery_status === 'waiting_for_rider') return 'waiting_for_rider';
  if (data.delivery_status === 'rider_assigned') return 'rider_assigned';
  if (data.delivery_status === 'delivered') return 'delivered';
  if (data.shipping_status === 'cancelled') return 'cancelled';
  return data.shipping_status || 'pending';
}

function ToastStack({ toasts, onDismiss, onView }) {
  const { t } = useTranslation();
  if (toasts.length === 0) return null;

  return (
    <div className="order-notif-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const statusKey = `track.status_${toast.status}`;
        const statusLabel = t(statusKey);
        const title = toast.kind === 'order_created'
          ? t('orderNotif.orderPlaced')
          : t('orderNotif.orderUpdated');
        const body = t('orderNotif.body', {
          orderId: toast.orderId,
          status: statusLabel === statusKey ? toast.status : statusLabel,
        });

        return (
          <article key={toast.id} className={`order-notif-toast status-${toast.status}`}>
            <button
              type="button"
              className="order-notif-body"
              onClick={() => onView(toast)}
            >
              <span className="order-notif-icon" aria-hidden>📦</span>
              <span className="order-notif-text">
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
            </button>
            <button
              type="button"
              className="order-notif-close"
              onClick={() => onDismiss(toast.id)}
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </article>
        );
      })}
    </div>
  );
}

export function OrderNotificationProvider({ children }) {
  const { isCustomer, user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const timersRef = useMemo(() => new Map(), []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.delete(id);
    }
  }, [timersRef]);

  const pushToast = useCallback((toast) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { ...toast, id }]);
    const timer = window.setTimeout(() => dismiss(id), DISMISS_MS);
    timersRef.set(id, timer);
  }, [dismiss, timersRef]);

  const viewOrder = useCallback((toast) => {
    dismiss(toast.id);
    const orderId = toast.orderId || '';
    const phone = encodeURIComponent(user?.phone || '');
    if (orderId) {
      navigate(`/track?orderId=${encodeURIComponent(orderId)}${phone ? `&phone=${phone}` : ''}`);
    } else {
      navigate('/account');
    }
  }, [dismiss, navigate, user?.phone]);

  useLiveUpdates({
    enabled: isCustomer,
    onEvent: (event, data) => {
      if (event !== 'order_updated' && event !== 'order_created') return;
      if (!data?.order_id) return;
      pushToast({
        kind: event === 'order_created' ? 'order_created' : 'order_updated',
        orderId: data.order_id,
        status: customerStatusFromEvent(data),
        shipping_status: data.shipping_status,
      });
    },
  });

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <OrderNotificationContext.Provider value={value}>
      {children}
      {isCustomer ? (
        <ToastStack toasts={toasts} onDismiss={dismiss} onView={viewOrder} />
      ) : null}
    </OrderNotificationContext.Provider>
  );
}

export function useOrderNotifications() {
  return useContext(OrderNotificationContext);
}
