/**
 * Staff new-order alerts: in-app toast (caller), browser Notification,
 * Capacitor Local Notifications (AsFix POS APK) with sound + vibrate.
 */
import { Capacitor } from '@capacitor/core';
import { isNativePosApp } from './nativePosPrint.js';
import {
  staffAllowsCancelAlert,
  staffAllowsCancelSound,
  staffAllowsOrderAlert,
  staffAllowsOrderPhone,
  staffAllowsOrderSound,
} from './notificationPrefs.js';

const CHANNEL_ID = 'asfix_new_orders';
const SEEN_KEY = 'asfix_staff_seen_online_order_id';
const PERM_ASKED_KEY = 'asfix_staff_notif_perm_asked';

let channelReady = false;
let listenerReady = false;
let audioCtx = null;

function formatRs(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'Rs —';
  return `Rs ${n.toLocaleString('en-PK')}`;
}

export function isOnlineCustomerOrder(orderOrEvent) {
  if (!orderOrEvent) return false;
  const src = String(orderOrEvent.source || 'online');
  if (src === 'counter_sale' || src === 'counter_return' || src === 'counter_draft') return false;
  return true;
}

export function getSeenOnlineOrderId() {
  const n = Number(localStorage.getItem(SEEN_KEY) || 0);
  return Number.isFinite(n) ? n : 0;
}

export function markSeenOnlineOrderId(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return;
  const prev = getSeenOnlineOrderId();
  if (n > prev) localStorage.setItem(SEEN_KEY, String(n));
}

export function adminOrderDeepLink(orderId, opts = {}) {
  const q = encodeURIComponent(String(orderId || '').trim());
  const ship = String(opts.ship || '').trim().toLowerCase();
  const shipParam = ship === 'postex' ? `&ship=${ship}` : '';
  return q ? `/admin?tab=orders&q=${q}${shipParam}` : '/admin?tab=orders';
}

async function getLocalNotifications() {
  if (!isNativePosApp()) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    return mod.LocalNotifications;
  } catch (err) {
    console.warn('[StaffNotify] LocalNotifications unavailable:', err?.message || err);
    return null;
  }
}

export async function ensureStaffNotifyPermissions() {
  if (typeof window === 'undefined') return { native: false, browser: false };

  let native = false;
  const LN = await getLocalNotifications();
  if (LN) {
    try {
      let perm = await LN.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LN.requestPermissions();
      }
      native = perm.display === 'granted';
      if (native && !channelReady) {
        await LN.createChannel({
          id: CHANNEL_ID,
          name: 'New online orders',
          description: 'Alert when a customer places an online order',
          importance: 5,
          sound: 'default',
          vibration: true,
          visibility: 1,
        });
        channelReady = true;
      }
    } catch (err) {
      console.warn('[StaffNotify] Native permission failed:', err?.message || err);
    }
  }

  let browser = false;
  if (typeof Notification !== 'undefined') {
    try {
      if (Notification.permission === 'granted') browser = true;
      else if (Notification.permission !== 'denied' && !localStorage.getItem(PERM_ASKED_KEY)) {
        localStorage.setItem(PERM_ASKED_KEY, '1');
        const result = await Notification.requestPermission();
        browser = result === 'granted';
      } else {
        browser = Notification.permission === 'granted';
      }
    } catch {
      /* ignore */
    }
  }

  return { native, browser };
}

/** Short beep — works in foreground WebView / browser without native plugin. */
export function playNewOrderChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const now = audioCtx.currentTime;
    const tones = [880, 1174, 1318];
    tones.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02 + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + i * 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + 0.22 + i * 0.12);
    });
  } catch {
    /* ignore autoplay blocks */
  }
  try {
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  } catch {
    /* ignore */
  }
}

function buildAlertCopy(order) {
  const orderId = order.order_id || order.id || '—';
  const name = String(order.customer_name || 'Customer').trim() || 'Customer';
  const total = formatRs(order.total_amount);
  const title = `New order #${orderId}`;
  const body = `${name} — ${total}`;
  return { orderId, name, total, title, body };
}

async function showBrowserNotification(order, { onClick } = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  // Prefer native Local Notifications inside Capacitor (avoids duplicate trays)
  if (isNativePosApp()) return;
  const { title, body, orderId } = buildAlertCopy(order);
  try {
    const n = new Notification(title, {
      body,
      tag: `asfix-order-${orderId}`,
      renotify: true,
      requireInteraction: true,
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      onClick?.(orderId);
      n.close();
    };
  } catch (err) {
    console.warn('[StaffNotify] Browser notification failed:', err?.message || err);
  }
}

async function showNativeLocalNotification(order) {
  const LN = await getLocalNotifications();
  if (!LN) return;
  const { title, body, orderId } = buildAlertCopy(order);
  const numericId = Number(order.id) || Math.floor(Date.now() % 2_000_000_000);
  try {
    await ensureStaffNotifyPermissions();
    await LN.schedule({
      notifications: [
        {
          id: numericId,
          title,
          body,
          channelId: CHANNEL_ID,
          sound: 'default',
          smallIcon: undefined,
          extra: {
            orderId: String(orderId),
            path: adminOrderDeepLink(orderId),
          },
        },
      ],
    });
  } catch (err) {
    console.warn('[StaffNotify] Local notification failed:', err?.message || err);
  }
}

/**
 * Register once: tapping a local notification opens Admin for that order.
 * @param {(path: string) => void} navigateFn
 */
export async function attachLocalNotificationOpenHandler(navigateFn) {
  if (listenerReady || !isNativePosApp()) return;
  const LN = await getLocalNotifications();
  if (!LN) return;
  try {
    await LN.addListener('localNotificationActionPerformed', (event) => {
      const extra = event?.notification?.extra || {};
      const path = extra.path || adminOrderDeepLink(extra.orderId);
      if (path) navigateFn(path);
    });
    listenerReady = true;
  } catch (err) {
    console.warn('[StaffNotify] Listener failed:', err?.message || err);
  }
}

/**
 * Full staff alert for one new online order.
 * @param {object} order — needs order_id, customer_name, total_amount, id
 * @param {{ onOpen?: (orderId: string) => void }} [opts]
 */
export async function alertStaffNewOrder(order, opts = {}) {
  if (!isOnlineCustomerOrder(order)) return;
  if (!staffAllowsOrderAlert()) {
    if (order.id != null) markSeenOnlineOrderId(order.id);
    return null;
  }
  const { orderId } = buildAlertCopy(order);
  if (staffAllowsOrderSound()) playNewOrderChime();
  if (staffAllowsOrderPhone()) {
    await ensureStaffNotifyPermissions();
    await Promise.all([
      showNativeLocalNotification(order),
      showBrowserNotification(order, {
        onClick: (id) => opts.onOpen?.(id),
      }),
    ]);
  }
  if (order.id != null) markSeenOnlineOrderId(order.id);
  return orderId;
}

/**
 * Staff alert when customer requests cancel/refund.
 */
export async function alertStaffCancelRequest(order, opts = {}) {
  if (!isOnlineCustomerOrder(order)) return;
  if (!staffAllowsCancelAlert()) return null;
  const orderId = order.order_id || order.id || '—';
  const name = String(order.customer_name || 'Customer').trim() || 'Customer';
  const postex = Boolean(order.cancel_postex_booked_at_request || order.postex_tracking);
  const title = postex
    ? `Cancel request #${orderId} · PostEx booked`
    : `Cancel request #${orderId}`;
  const body = `${name} wants to cancel — refund request${postex ? ' (PostEx already booked)' : ''}`;
  if (staffAllowsCancelSound()) playNewOrderChime();
  await ensureStaffNotifyPermissions();
  try {
    const LN = await getLocalNotifications();
    if (LN) {
      const numericId = (Number(order.id) || Date.now()) % 2_000_000_000;
      await LN.schedule({
        notifications: [
          {
            id: numericId + 900_000,
            title,
            body,
            channelId: CHANNEL_ID,
            sound: 'default',
            extra: { orderId: String(orderId), path: adminOrderDeepLink(orderId) },
          },
        ],
      });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && !isNativePosApp()) {
      const n = new Notification(title, { body, tag: `asfix-cancel-${orderId}`, renotify: true });
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          /* ignore */
        }
        opts.onOpen?.(orderId);
        n.close();
      };
    }
  } catch (err) {
    console.warn('[StaffNotify] Cancel alert failed:', err?.message || err);
  }
  return orderId;
}

export function pickNewOnlineOrders(orders, sinceId) {
  const floor = Number(sinceId) || 0;
  return (orders || [])
    .filter((o) => isOnlineCustomerOrder(o) && Number(o.id) > floor)
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export function maxOnlineOrderId(orders) {
  let max = 0;
  for (const o of orders || []) {
    if (!isOnlineCustomerOrder(o)) continue;
    const id = Number(o.id);
    if (id > max) max = id;
  }
  return max;
}

export function isCapacitorNative() {
  try {
    return Capacitor.isNativePlatform?.() === true || isNativePosApp();
  } catch {
    return false;
  }
}
