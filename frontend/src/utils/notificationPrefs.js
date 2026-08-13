/**
 * Notification preferences for AsFix staff (POS/Admin) and customers.
 * Stored in localStorage on this device / APK WebView.
 */

export const STAFF_NOTIF_PREFS_KEY = 'asfix_staff_notif_prefs_v1';
export const CUSTOMER_NOTIF_PREFS_KEY = 'asfix_customer_notif_prefs_v1';

export const STAFF_DEFAULTS = {
  /** Master: show any staff order-related notifications */
  orderShow: true,
  orderSound: true,
  orderToast: true,
  orderPhone: true,
  cancelShow: true,
  cancelSound: true,
  /** Future / soft: repair booking alerts */
  repairShow: true,
  /** Contact / shop messages */
  messageShow: true,
  /** When ON, customers who opted in can get new-arrival alerts from this device session */
  customerNewArrivals: true,
  /** When ON, customers who opted in can get discount / sale alerts */
  customerDiscounts: true,
};

export const CUSTOMER_DEFAULTS = {
  /** Order placed / status updates */
  orderUpdates: true,
  /** New products in shop */
  newArrivals: true,
  /** Sale / discount products */
  discounts: true,
  sound: false,
};

function readJson(key, defaults) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...defaults };
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

function writeJson(key, next) {
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  try {
    window.dispatchEvent(new CustomEvent('asfix-notif-prefs', { detail: { key, prefs: next } }));
  } catch {
    /* ignore */
  }
  return next;
}

export function getStaffNotifPrefs() {
  return readJson(STAFF_NOTIF_PREFS_KEY, STAFF_DEFAULTS);
}

export function setStaffNotifPrefs(patch) {
  const next = { ...getStaffNotifPrefs(), ...patch };
  return writeJson(STAFF_NOTIF_PREFS_KEY, next);
}

export function getCustomerNotifPrefs() {
  return readJson(CUSTOMER_NOTIF_PREFS_KEY, CUSTOMER_DEFAULTS);
}

export function setCustomerNotifPrefs(patch) {
  const next = { ...getCustomerNotifPrefs(), ...patch };
  return writeJson(CUSTOMER_NOTIF_PREFS_KEY, next);
}

export function staffAllowsOrderAlert() {
  const p = getStaffNotifPrefs();
  return Boolean(p.orderShow);
}

export function staffAllowsOrderSound() {
  const p = getStaffNotifPrefs();
  return Boolean(p.orderShow && p.orderSound);
}

export function staffAllowsOrderToast() {
  const p = getStaffNotifPrefs();
  return Boolean(p.orderShow && p.orderToast);
}

export function staffAllowsOrderPhone() {
  const p = getStaffNotifPrefs();
  return Boolean(p.orderShow && p.orderPhone);
}

export function staffAllowsCancelAlert() {
  const p = getStaffNotifPrefs();
  return Boolean(p.cancelShow);
}

export function staffAllowsCancelSound() {
  const p = getStaffNotifPrefs();
  return Boolean(p.cancelShow && p.cancelSound);
}

export function customerAllowsOrderUpdates() {
  return Boolean(getCustomerNotifPrefs().orderUpdates);
}

export function customerAllowsNewArrivals() {
  return Boolean(getCustomerNotifPrefs().newArrivals);
}

export function customerAllowsDiscounts() {
  return Boolean(getCustomerNotifPrefs().discounts);
}
