import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import useLiveUpdates from '../hooks/useLiveUpdates';
import { api } from '../api/client';
import { startVisibilityPoll } from '../utils/visibilityPoll';
import {
  adminOrderDeepLink,
  alertStaffNewOrder,
  attachLocalNotificationOpenHandler,
  ensureStaffNotifyPermissions,
  getSeenOnlineOrderId,
  isOnlineCustomerOrder,
  markSeenOnlineOrderId,
  maxOnlineOrderId,
  pickNewOnlineOrders,
} from '../utils/staffOrderNotify';
import './order-notifications.css';

const DISMISS_MS = 6500;
const STAFF_DISMISS_MS = 12000;
const MAX_TOASTS = 4;
const STAFF_POLL_MS = 40_000;

const OrderNotificationContext = createContext(null);

function customerStatusFromEvent(data) {
  if (data.payment_status === 'pending_payment') return 'pending_payment';
  if (data.delivery_status === 'waiting_for_rider') return 'waiting_for_rider';
  if (data.delivery_status === 'rider_assigned') return 'rider_assigned';
  if (data.delivery_status === 'delivered') return 'delivered';
  if (data.shipping_status === 'cancelled') return 'cancelled';
  return data.shipping_status || 'pending';
}

function formatRs(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `Rs ${n.toLocaleString('en-PK')}`;
}

function ToastStack({ toasts, onDismiss, onView }) {
  const { t } = useTranslation();
  if (toasts.length === 0) return null;

  return (
    <div className="order-notif-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const isStaff = toast.kind === 'staff_new_order';
        let title;
        let body;
        if (isStaff) {
          title = t('orderNotif.staffNewOrder');
          body = t('orderNotif.staffBody', {
            orderId: toast.orderId,
            name: toast.customerName || 'Customer',
            total: toast.totalLabel || '',
          });
        } else {
          const statusKey = `track.status_${toast.status}`;
          const statusLabel = t(statusKey);
          title =
            toast.kind === 'order_created'
              ? t('orderNotif.orderPlaced')
              : t('orderNotif.orderUpdated');
          body = t('orderNotif.body', {
            orderId: toast.orderId,
            status: statusLabel === statusKey ? toast.status : statusLabel,
          });
        }

        return (
          <article
            key={toast.id}
            className={`order-notif-toast status-${toast.status || 'pending'}${isStaff ? ' order-notif-toast--staff' : ''}`}
          >
            <button type="button" className="order-notif-body" onClick={() => onView(toast)}>
              <span className="order-notif-icon" aria-hidden>
                {isStaff ? '🔔' : '📦'}
              </span>
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
  const { isCustomer, isStaff, user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const timersRef = useMemo(() => new Map(), []);
  const alertingRef = useRef(new Set());

  const dismiss = useCallback(
    (id) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      const timer = timersRef.get(id);
      if (timer) {
        clearTimeout(timer);
        timersRef.delete(id);
      }
    },
    [timersRef]
  );

  const pushToast = useCallback(
    (toast, dismissMs = DISMISS_MS) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { ...toast, id }]);
      const timer = window.setTimeout(() => dismiss(id), dismissMs);
      timersRef.set(id, timer);
    },
    [dismiss, timersRef]
  );

  const openStaffOrder = useCallback(
    (orderId) => {
      navigate(adminOrderDeepLink(orderId));
    },
    [navigate]
  );

  const handleStaffNewOrder = useCallback(
    async (orderLike) => {
      if (!isStaff || !isOnlineCustomerOrder(orderLike)) return;
      const key = String(orderLike.id || orderLike.order_id || '');
      if (!key || alertingRef.current.has(key)) return;
      alertingRef.current.add(key);
      window.setTimeout(() => alertingRef.current.delete(key), 60_000);

      const orderId = orderLike.order_id || orderLike.id;
      const totalLabel = formatRs(orderLike.total_amount);
      pushToast(
        {
          kind: 'staff_new_order',
          orderId,
          customerName: orderLike.customer_name || 'Customer',
          totalLabel,
          status: 'pending',
        },
        STAFF_DISMISS_MS
      );
      try {
        await alertStaffNewOrder(orderLike, { onOpen: openStaffOrder });
      } catch {
        /* best-effort */
      }
      if (orderLike.id != null) markSeenOnlineOrderId(orderLike.id);
    },
    [isStaff, openStaffOrder, pushToast]
  );

  const viewOrder = useCallback(
    (toast) => {
      dismiss(toast.id);
      if (toast.kind === 'staff_new_order') {
        openStaffOrder(toast.orderId);
        return;
      }
      const orderId = toast.orderId || '';
      const phone = encodeURIComponent(user?.phone || '');
      if (orderId) {
        navigate(`/track?orderId=${encodeURIComponent(orderId)}${phone ? `&phone=${phone}` : ''}`);
      } else {
        navigate('/account');
      }
    },
    [dismiss, navigate, openStaffOrder, user?.phone]
  );

  useEffect(() => {
    if (!isStaff) return undefined;
    void ensureStaffNotifyPermissions();
    void attachLocalNotificationOpenHandler((path) => navigate(path));
    return undefined;
  }, [isStaff, navigate]);

  useLiveUpdates({
    enabled: isCustomer || isStaff,
    onEvent: (event, data) => {
      if (isStaff && event === 'order_created' && data) {
        void handleStaffNewOrder(data);
        return;
      }
      if (!isCustomer) return;
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

  // Poll fallback for staff (SSE may miss while POS is backgrounded)
  useEffect(() => {
    if (!isStaff) return undefined;

    const scan = async () => {
      try {
        const orders = await api.getOrders();
        const seen = getSeenOnlineOrderId();
        const fresh = pickNewOnlineOrders(orders, seen);
        const maxId = maxOnlineOrderId(orders);
        if (seen === 0 && maxId > 0) {
          // First run after install — don't blast every historical order
          markSeenOnlineOrderId(maxId);
          return;
        }
        for (const o of fresh) {
          await handleStaffNewOrder(o);
        }
        if (maxId > seen) markSeenOnlineOrderId(maxId);
      } catch {
        /* ignore */
      }
    };

    void scan();
    return startVisibilityPoll(scan, STAFF_POLL_MS);
  }, [isStaff, handleStaffNewOrder]);

  const value = useMemo(() => ({ pushToast, alertStaffNewOrder: handleStaffNewOrder }), [
    pushToast,
    handleStaffNewOrder,
  ]);

  return (
    <OrderNotificationContext.Provider value={value}>
      {children}
      {isCustomer || isStaff ? (
        <ToastStack toasts={toasts} onDismiss={dismiss} onView={viewOrder} />
      ) : null}
    </OrderNotificationContext.Provider>
  );
}

export function useOrderNotifications() {
  return useContext(OrderNotificationContext);
}
