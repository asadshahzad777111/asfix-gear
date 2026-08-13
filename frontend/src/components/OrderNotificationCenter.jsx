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
  alertStaffCancelRequest,
  attachLocalNotificationOpenHandler,
  ensureStaffNotifyPermissions,
  getSeenOnlineOrderId,
  isOnlineCustomerOrder,
  markSeenOnlineOrderId,
  maxOnlineOrderId,
  pickNewOnlineOrders,
} from '../utils/staffOrderNotify';
import {
  customerAllowsOrderUpdates,
  staffAllowsCancelAlert,
  staffAllowsOrderAlert,
  staffAllowsOrderToast,
} from '../utils/notificationPrefs';
import { maybeAlertCustomerShopUpdates } from '../utils/customerShopNotify';
import './order-notifications.css';

const DISMISS_MS = 6500;
const STAFF_DISMISS_MS = 14000;
const MAX_TOASTS = 4;
const STAFF_POLL_MS = 40_000;
const CUSTOMER_PERM_KEY = 'asfix_customer_notif_perm_asked';

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

function showCustomerBrowserNotification(title, body, onClick) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      tag: `asfix-cust-${Date.now()}`,
      renotify: true,
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      onClick?.();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

async function ensureCustomerNotifyPermissions() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    if (localStorage.getItem(CUSTOMER_PERM_KEY)) {
      return Notification.permission === 'granted';
    }
    localStorage.setItem(CUSTOMER_PERM_KEY, '1');
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

function ToastStack({ toasts, onDismiss, onView, onStaffAction }) {
  const { t } = useTranslation();
  if (toasts.length === 0) return null;

  return (
    <div className="order-notif-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const isStaffCancel = toast.kind === 'staff_cancel_request';
        const isStaffNew = toast.kind === 'staff_new_order';
        const isStaff = isStaffNew || isStaffCancel;
        let title;
        let body;
        if (isStaffCancel) {
          title = t('orderNotif.staffCancelRequest');
          body = t('orderNotif.staffCancelBody', {
            orderId: toast.orderId,
            name: toast.customerName || 'Customer',
            postex: toast.postexBooked ? ' · PostEx booked' : '',
          });
        } else if (isStaffNew) {
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
            {isStaffNew ? (
              <div className="order-notif-actions">
                <button
                  type="button"
                  className="order-notif-action"
                  onClick={() => onStaffAction(toast, 'open')}
                >
                  {t('orderNotif.openAdmin')}
                </button>
                <button
                  type="button"
                  className="order-notif-action order-notif-action--primary"
                  onClick={() => onStaffAction(toast, 'postex')}
                >
                  {t('orderNotif.bookPostex')}
                </button>
              </div>
            ) : null}
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
  const { t } = useTranslation();
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
    (orderId, ship) => {
      navigate(adminOrderDeepLink(orderId, ship ? { ship } : {}));
    },
    [navigate]
  );

  const handleStaffNewOrder = useCallback(
    async (orderLike) => {
      if (!isStaff || !isOnlineCustomerOrder(orderLike)) return;
      if (!staffAllowsOrderAlert()) {
        if (orderLike.id != null) markSeenOnlineOrderId(orderLike.id);
        return;
      }
      const key = String(orderLike.id || orderLike.order_id || '');
      if (!key || alertingRef.current.has(key)) return;
      alertingRef.current.add(key);
      window.setTimeout(() => alertingRef.current.delete(key), 60_000);

      const orderId = orderLike.order_id || orderLike.id;
      const totalLabel = formatRs(orderLike.total_amount);
      if (staffAllowsOrderToast()) {
        pushToast(
          {
            kind: 'staff_new_order',
            orderId,
            numericId: orderLike.id,
            customerName: orderLike.customer_name || 'Customer',
            totalLabel,
            status: 'pending',
            fulfillment: orderLike.fulfillment_method || '',
          },
          STAFF_DISMISS_MS
        );
      }
      try {
        await alertStaffNewOrder(orderLike, { onOpen: openStaffOrder });
      } catch {
        /* best-effort */
      }
      if (orderLike.id != null) markSeenOnlineOrderId(orderLike.id);
    },
    [isStaff, openStaffOrder, pushToast]
  );

  const handleStaffCancelRequest = useCallback(
    async (orderLike) => {
      if (!isStaff || !isOnlineCustomerOrder(orderLike)) return;
      if (!staffAllowsCancelAlert()) return;
      const key = `cancel-${orderLike.id || orderLike.order_id || ''}`;
      if (!key || alertingRef.current.has(key)) return;
      alertingRef.current.add(key);
      window.setTimeout(() => alertingRef.current.delete(key), 60_000);

      const orderId = orderLike.order_id || orderLike.id;
      pushToast(
        {
          kind: 'staff_cancel_request',
          orderId,
          customerName: orderLike.customer_name || 'Customer',
          postexBooked: Boolean(orderLike.cancel_postex_booked_at_request || orderLike.postex_tracking),
          status: 'cancelled',
        },
        STAFF_DISMISS_MS
      );
      try {
        await alertStaffCancelRequest(orderLike, { onOpen: openStaffOrder });
      } catch {
        /* best-effort */
      }
    },
    [isStaff, openStaffOrder, pushToast]
  );

  const viewOrder = useCallback(
    (toast) => {
      dismiss(toast.id);
      if (toast.kind === 'staff_new_order' || toast.kind === 'staff_cancel_request') {
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

  const staffAction = useCallback(
    async (toast, action) => {
      dismiss(toast.id);
      if (action === 'postex') {
        openStaffOrder(toast.orderId, 'postex');
        return;
      }
      openStaffOrder(toast.orderId);
    },
    [dismiss, openStaffOrder]
  );

  useEffect(() => {
    if (!isStaff) return undefined;
    void ensureStaffNotifyPermissions();
    void attachLocalNotificationOpenHandler((path) => navigate(path));
    return undefined;
  }, [isStaff, navigate]);

  useEffect(() => {
    if (!isCustomer) return undefined;
    void ensureCustomerNotifyPermissions();
    void maybeAlertCustomerShopUpdates({ navigate });
    return undefined;
  }, [isCustomer, navigate]);

  useLiveUpdates({
    enabled: isCustomer || isStaff,
    onEvent: (event, data) => {
      if (isStaff && event === 'order_created' && data) {
        void handleStaffNewOrder(data);
        return;
      }
      if (isStaff && event === 'order_cancel_requested' && data) {
        void handleStaffCancelRequest(data);
        return;
      }
      if (!isCustomer) return;
      if (!customerAllowsOrderUpdates()) return;
      if (event !== 'order_updated' && event !== 'order_created') return;
      if (!data?.order_id) return;
      const status = customerStatusFromEvent(data);
      const statusKey = `track.status_${status}`;
      const statusLabel = t(statusKey);
      const title =
        event === 'order_created' ? t('orderNotif.orderPlaced') : t('orderNotif.orderUpdated');
      const body = t('orderNotif.body', {
        orderId: data.order_id,
        status: statusLabel === statusKey ? status : statusLabel,
      });
      pushToast({
        kind: event === 'order_created' ? 'order_created' : 'order_updated',
        orderId: data.order_id,
        status,
        shipping_status: data.shipping_status,
      });
      showCustomerBrowserNotification(title, body, () => {
        const phone = encodeURIComponent(user?.phone || '');
        navigate(
          `/track?orderId=${encodeURIComponent(data.order_id)}${phone ? `&phone=${phone}` : ''}`
        );
      });
    },
  });

  // Poll fallback for staff (SSE may miss while POS is backgrounded)
  useEffect(() => {
    if (!isStaff) return undefined;

    const scan = async () => {
      try {
        const orders = await (api.getOrderNotifyFeed?.() || api.getOrders());
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
        /* ignore — counter may lack full /orders; notify-feed covers it */
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
        <ToastStack
          toasts={toasts}
          onDismiss={dismiss}
          onView={viewOrder}
          onStaffAction={staffAction}
        />
      ) : null}
    </OrderNotificationContext.Provider>
  );
}

export function useOrderNotifications() {
  return useContext(OrderNotificationContext);
}
