/**
 * Lightweight customer shop alerts: new arrivals + discounts.
 * Runs once per session when customer has prefs ON and staff allows.
 */
import { api } from '../api/client';
import {
  customerAllowsDiscounts,
  customerAllowsNewArrivals,
  getStaffNotifPrefs,
} from './notificationPrefs';

const SEEN_PRODUCTS_KEY = 'asfix_customer_seen_product_ids_v1';
const DISCOUNT_SEEN_KEY = 'asfix_customer_seen_discount_ids_v1';
const SESSION_FLAG = 'asfix_customer_shop_alert_ran';

function readIdSet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeIdSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set].slice(-400)));
  } catch {
    /* ignore */
  }
}

function showBrowser(title, body, tag) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag, renotify: true });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      n.close();
    };
  } catch {
    /* ignore */
  }
}

function productIsOnSale(p) {
  return Number(p?.discount_percent) > 0 || Boolean(p?.on_sale) || Boolean(p?.discount_enabled);
}

/**
 * Call from customer session (OrderNotificationCenter or Shop).
 * First visit after install only seeds seen IDs (no blast).
 */
export async function maybeAlertCustomerShopUpdates({ navigate } = {}) {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(SESSION_FLAG)) return;
  sessionStorage.setItem(SESSION_FLAG, '1');

  const staff = getStaffNotifPrefs();
  const wantArrivals = customerAllowsNewArrivals() && staff.customerNewArrivals !== false;
  const wantDiscounts = customerAllowsDiscounts() && staff.customerDiscounts !== false;
  if (!wantArrivals && !wantDiscounts) return;

  let products = [];
  try {
    products = await api.getProducts();
    if (!Array.isArray(products)) products = products?.products || [];
  } catch {
    return;
  }
  if (!products.length) return;

  const allIds = products.map((p) => String(p.id)).filter(Boolean);
  const seenProducts = readIdSet(SEEN_PRODUCTS_KEY);
  const seenDiscounts = readIdSet(DISCOUNT_SEEN_KEY);
  const firstRun = seenProducts.size === 0;

  if (firstRun) {
    writeIdSet(SEEN_PRODUCTS_KEY, new Set(allIds));
    writeIdSet(
      DISCOUNT_SEEN_KEY,
      new Set(products.filter(productIsOnSale).map((p) => String(p.id)))
    );
    return;
  }

  if (wantArrivals) {
    const fresh = products.filter((p) => p.id != null && !seenProducts.has(String(p.id)));
    if (fresh.length > 0) {
      const top = fresh[0];
      const title = 'New arrival';
      const body =
        fresh.length === 1
          ? `${top.name || 'New product'} — AsFix & Gear`
          : `${fresh.length} new products — AsFix & Gear`;
      showBrowser(title, body, 'asfix-new-arrival');
      if (typeof navigate === 'function') {
        /* optional deep link reserved */
      }
    }
  }

  if (wantDiscounts) {
    const sales = products.filter(
      (p) => productIsOnSale(p) && p.id != null && !seenDiscounts.has(String(p.id))
    );
    if (sales.length > 0) {
      const top = sales[0];
      const pct = Number(top.discount_percent) || 0;
      const title = 'Discount alert';
      const body =
        sales.length === 1
          ? `${top.name || 'Sale item'}${pct ? ` — ${pct}% off` : ''}`
          : `${sales.length} items on sale — AsFix & Gear`;
      showBrowser(title, body, 'asfix-discount');
    }
  }

  writeIdSet(SEEN_PRODUCTS_KEY, new Set([...seenProducts, ...allIds]));
  writeIdSet(
    DISCOUNT_SEEN_KEY,
    new Set([
      ...seenDiscounts,
      ...products.filter(productIsOnSale).map((p) => String(p.id)),
    ])
  );
}
