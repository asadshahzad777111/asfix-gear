import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createToken, hashPassword, sessionExpiry, verifyPassword } from './auth/crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

export const LOW_STOCK_THRESHOLD = 5;

export class StockError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StockError';
    this.details = details;
  }
}

const DEFAULT_DATA = {
  meta: {
    nextProductId: 1,
    nextServiceId: 1,
    nextBookingId: 1,
    nextMessageId: 1,
    nextUserId: 1,
    nextOrderId: 1,
  },
  users: [],
  sessions: [],
  products: [],
  repair_services: [],
  repair_bookings: [],
  contact_messages: [],
  orders: [],
  verification_codes: [],
  settings: {
    shop: {
      manual_override: null,
      updated_at: null,
      updated_by: null,
    },
  },
};

function migrateData(data) {
  data.meta = data.meta || {};
  data.users = data.users || [];
  data.sessions = data.sessions || [];
  data.products = data.products || [];
  data.repair_services = data.repair_services || [];
  data.repair_bookings = data.repair_bookings || [];
  data.contact_messages = data.contact_messages || [];
  data.orders = data.orders || [];
  data.verification_codes = data.verification_codes || [];
  data.settings = data.settings || {};
  data.settings.shop = data.settings.shop || {
    manual_override: null,
    updated_at: null,
    updated_by: null,
  };
  if (!data.meta.nextUserId) data.meta.nextUserId = 1;
  if (!data.meta.nextOrderId) data.meta.nextOrderId = 1;
  if (!data.meta.nextVerificationCodeId) data.meta.nextVerificationCodeId = 1;

  for (const msg of data.contact_messages) {
    if (msg.staff_reply == null) msg.staff_reply = '';
    if (msg.replied_at == null) msg.replied_at = null;
  }

  for (const product of data.products) {
    if (product.warranty == null) product.warranty = '';
    if (product.cost_price == null) product.cost_price = 0;
  }

  const nowIso = new Date().toISOString();

  for (const order of data.orders) {
    if (!order.order_id) order.order_id = formatOrderId(order.id);
    if (order.gmail == null) order.gmail = '';
    if (!order.status_history) {
      order.status_history = [
        { status: order.shipping_status || 'pending', at: order.created_at || nowIso, by: null },
      ];
    }
    if (!order.activity_log) order.activity_log = [];
    if (!order.updated_at) order.updated_at = order.created_at || nowIso;
    if (order.shipping_status === 'confirmed') order.shipping_status = 'payment_verified';
  }

  for (const booking of data.repair_bookings) {
    if (!booking.booking_ref) booking.booking_ref = formatBookingRef(booking.id);
    if (!booking.status_history) {
      booking.status_history = [
        { status: booking.status || 'pending', at: booking.created_at || nowIso, by: null },
      ];
    }
    if (!booking.activity_log) booking.activity_log = [];
    if (!booking.updated_at) booking.updated_at = booking.created_at || nowIso;
  }

  for (const user of data.users) {
    if (user.name == null) user.name = user.username || String(user.email || '').split('@')[0] || '';
    if (user.phone == null) user.phone = '';
    if (user.blocked == null) user.blocked = user.active === false;
    user.active = !user.blocked;
    if (user.last_login == null) user.last_login = null;
    if (user.created_by == null) user.created_by = null;
  }

  for (const order of data.orders) {
    if (order.customer_user_id == null) order.customer_user_id = null;
    if (order.stock_deducted == null) order.stock_deducted = false;
    if (order.customer_feedback == null) order.customer_feedback = null;
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.cost_price == null) item.cost_price = 0;
      }
    }
  }

  for (const msg of data.contact_messages) {
    if (msg.customer_user_id == null) msg.customer_user_id = null;
  }

  data.sessions = data.sessions.filter((s) => s.expires_at > nowIso);
  data.verification_codes = (data.verification_codes || []).filter((c) => c.expires_at > nowIso);
  return data;
}

function writeDataAtomic(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmp = `${DATA_FILE}.tmp`;
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    writeDataAtomic(DEFAULT_DATA);
  }
}

const LOCK_FILE = path.join(DATA_DIR, '.data.lock');
const LOCK_MAX_SPINS = 200;
// If the process holding the lock dies mid-write (Ctrl+C, nodemon restart,
// terminal closed, crash) without reaching the `finally` cleanup, the lock
// file is left behind forever. Every future request that mutates data —
// including OTP verification for signup/login/password-reset — would then
// spin for the full LOCK_MAX_SPINS window and permanently fail with "Data
// store is busy", which from a user typing in a *correct* 6-digit code looks
// exactly like "the page just doesn't move forward", with no code-level bug
// to find. Treat any lock file older than this as abandoned and reclaim it.
const LOCK_STALE_MS = 3000;

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function acquireDataLock() {
  for (let i = 0; i < LOCK_MAX_SPINS; i += 1) {
    try {
      fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
      return;
    } catch {
      try {
        const stat = fs.statSync(LOCK_FILE);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(LOCK_FILE);
          continue;
        }
      } catch {
        /* lock file vanished between the failed write and this check — fine, just retry */
      }
      sleepSync(5);
    }
  }
  throw new Error('Data store is busy — please try again');
}

function releaseDataLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    /* lock already released */
  }
}

function readDataRaw() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function readData() {
  const parsed = readDataRaw();
  const before = JSON.stringify(parsed);
  const data = migrateData(parsed);
  if (JSON.stringify(data) !== before) {
    writeDataAtomic(data);
  }
  return data;
}

function writeData(data) {
  writeDataAtomic(data);
}

function withData(mutator) {
  acquireDataLock();
  try {
    const data = readData();
    const result = mutator(data);
    writeData(data);
    return result;
  } finally {
    releaseDataLock();
  }
}

function now() {
  return new Date().toISOString();
}

export function formatOrderId(id) {
  return `ASF-${1000 + Number(id)}`;
}

export function formatBookingRef(id) {
  return `ASF-R-${1000 + Number(id)}`;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function statusLabel(status) {
  const labels = {
    pending: 'Pending Verification',
    payment_verified: 'Payment Verified',
    shipped: 'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    in_progress: 'In Progress',
    completed: 'Completed',
  };
  return labels[status] || status;
}

function sortProducts(products) {
  return [...products].sort((a, b) => {
    const discountDiff = (b.discount_percent || 0) - (a.discount_percent || 0);
    if (discountDiff !== 0) return discountDiff;
    const featuredDiff = (b.featured || 0) - (a.featured || 0);
    if (featuredDiff !== 0) return featuredDiff;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export function getStats() {
  const data = readData();
  return {
    products: data.products.length,
    services: data.repair_services.length,
    bookings: data.repair_bookings.length,
  };
}

export function getProducts(filters = {}) {
  const { category, featured, search, on_sale, brand } = filters;
  let products = readData().products;

  if (category && category !== 'all') {
    products = products.filter((p) => p.category === category);
  }
  if (brand && brand !== 'all') {
    products = products.filter((p) => String(p.brand || '').toLowerCase() === String(brand).toLowerCase());
  }
  if (featured === 'true') {
    products = products.filter((p) => Number(p.featured) === 1);
  }
  if (on_sale === 'true') {
    products = products.filter((p) => Number(p.discount_percent) > 0);
  }
  if (search) {
    const term = String(search).toLowerCase();
    products = products.filter(
      (p) =>
        String(p.name).toLowerCase().includes(term) ||
        String(p.description).toLowerCase().includes(term) ||
        String(p.brand || '').toLowerCase().includes(term) ||
        String(p.compatible_models || '').toLowerCase().includes(term)
    );
  }

  return sortProducts(products);
}

export function getProductCategories() {
  const categories = [...new Set(readData().products.map((p) => p.category))];
  return categories.sort((a, b) => a.localeCompare(b));
}

export function getProductById(id) {
  const numId = Number(id);
  return readData().products.find((p) => p.id === numId) || null;
}

export function createProduct(input) {
  return withData((data) => {
    const id = data.meta.nextProductId++;
    const product = {
      id,
      name: input.name,
      category: input.category,
      brand: String(input.brand || '').trim(),
      compatible_models: String(input.compatible_models || '').trim(),
      price: Number(input.price),
      cost_price: Math.max(0, Number(input.cost_price) || 0),
      description: String(input.description || '').trim(),
      image: input.image || '',
      stock: Number(input.stock) || 0,
      featured: input.featured ? 1 : 0,
      discount_percent: Math.min(90, Math.max(0, Number(input.discount_percent) || 0)),
      warranty: String(input.warranty || '').trim(),
      created_at: now(),
      // Ownership: whoever adds a product is the only one (besides a Super
      // Admin) who can edit its details/stock/discount going forward — keeps
      // staff from stepping on each other's listings.
      created_by: input.created_by ?? null,
      created_by_name: String(input.created_by_name || '').trim(),
    };
    data.products.push(product);
    return product;
  });
}

export function updateProduct(id, input) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.products.findIndex((p) => p.id === numId);
    if (index === -1) return null;

    const existing = data.products[index];
    const discount =
      input.discount_percent != null
        ? Math.min(90, Math.max(0, Number(input.discount_percent) || 0))
        : existing.discount_percent;

    const updated = {
      ...existing,
      name: input.name ?? existing.name,
      category: input.category ?? existing.category,
      brand: input.brand != null ? String(input.brand).trim() : existing.brand ?? '',
      compatible_models:
        input.compatible_models != null
          ? String(input.compatible_models).trim()
          : existing.compatible_models ?? '',
      price: input.price != null ? Number(input.price) : existing.price,
      cost_price:
        input.cost_price != null ? Math.max(0, Number(input.cost_price) || 0) : existing.cost_price ?? 0,
      description: input.description ?? existing.description,
      image: input.image ?? existing.image,
      stock: input.stock != null ? Number(input.stock) : existing.stock,
      featured:
        input.featured != null ? (input.featured ? 1 : 0) : existing.featured,
      discount_percent: discount,
      warranty: input.warranty != null ? String(input.warranty).trim() : existing.warranty ?? '',
    };

    data.products[index] = updated;
    return updated;
  });
}

/**
 * Manual stock adjustment for sales/restocks that happen outside the
 * website (walk-in / offline customers, physical restock counts, etc.).
 * `delta` is signed: negative to remove stock sold offline, positive to add
 * newly restocked units. Every adjustment is appended to the product's
 * `stock_log` so staff can audit who changed what and why later.
 */
export function adjustProductStock(id, delta, { reason = 'offline_sale', note = '', staffName = '' } = {}) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.products.findIndex((p) => p.id === numId);
    if (index === -1) return null;

    const change = Math.trunc(Number(delta));
    if (!change) throw new Error('Stock change amount is required');

    const product = data.products[index];
    const currentStock = Number(product.stock) || 0;
    const nextStock = Math.max(0, currentStock + change);

    const logEntry = {
      at: now(),
      delta: nextStock - currentStock,
      reason,
      note: String(note || '').trim().slice(0, 200),
      staff: String(staffName || '').trim().slice(0, 60),
      resulting_stock: nextStock,
    };

    const stockLog = Array.isArray(product.stock_log) ? product.stock_log : [];
    product.stock = nextStock;
    product.stock_log = [...stockLog, logEntry].slice(-50);

    return product;
  });
}

export function setProductDiscount(id, discountPercent) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.products.findIndex((p) => p.id === numId);
    if (index === -1) return null;

    const discount = Math.min(90, Math.max(0, Number(discountPercent) || 0));
    data.products[index] = { ...data.products[index], discount_percent: discount };
    return data.products[index];
  });
}

export function deleteProduct(id) {
  return withData((data) => {
    const numId = Number(id);
    const before = data.products.length;
    data.products = data.products.filter((p) => p.id !== numId);
    return before !== data.products.length;
  });
}

export function countProducts() {
  return readData().products.length;
}

export function countProductsByCategory(category) {
  return readData().products.filter((p) => p.category === category).length;
}

export function insertProducts(items) {
  return withData((data) => {
    for (const item of items) {
      const id = data.meta.nextProductId++;
      data.products.push({
        id,
        name: item.name,
        category: item.category,
        price: Number(item.price),
        cost_price: Math.max(0, Number(item.cost_price) || 0),
        description: item.description,
        image: item.image || '',
        stock: Number(item.stock) || 0,
        featured: item.featured ? 1 : 0,
        discount_percent: Math.min(90, Math.max(0, Number(item.discount_percent) || 0)),
        warranty: String(item.warranty || '').trim(),
        created_at: now(),
      });
    }
  });
}

// Used for any response that goes to a customer/public request — strips
// internal-only fields (cost/profit, who added it, offline stock-adjustment
// history) that have no business being visible outside the staff dashboard.
export function stripProductCost(product) {
  if (!product) return product;
  const { cost_price: _omit, created_by: _cb, created_by_name: _cbn, stock_log: _log, ...rest } = product;
  return rest;
}

function restoreOrderStock(data, order) {
  for (const item of order.items || []) {
    const productId = Number(item.product_id);
    const qty = Math.max(1, Number(item.qty || 1));
    if (!productId) continue;
    const index = data.products.findIndex((p) => p.id === productId);
    if (index >= 0) {
      data.products[index].stock = Math.max(0, Number(data.products[index].stock || 0) + qty);
    }
  }
}

function prepareOrderItems(rawItems, products) {
  const normalized = [];
  for (const item of rawItems) {
    const productId = Number(item.product_id);
    const qty = Math.max(1, Math.min(99, Number(item.qty || 1)));
    if (!productId) {
      throw new StockError('Invalid product in order');
    }
    const product = products.find((p) => p.id === productId);
    if (!product) {
      throw new StockError(`Product not found: ${String(item.name || productId).trim()}`);
    }
    if (Number(product.stock || 0) < qty) {
      throw new StockError(
        `Insufficient stock for "${product.name}" — only ${product.stock} left`,
        {
          product_id: product.id,
          name: product.name,
          available: product.stock,
          requested: qty,
        }
      );
    }
    normalized.push({
      product_id: productId,
      name: String(item.name || product.name).trim(),
      qty,
      price: Number(item.price) || 0,
      cost_price: Math.max(0, Number(product.cost_price) || 0),
    });
  }
  return normalized;
}

function deductOrderStock(products, items) {
  for (const item of items) {
    const index = products.findIndex((p) => p.id === item.product_id);
    if (index >= 0) {
      products[index].stock = Math.max(0, Number(products[index].stock || 0) - item.qty);
    }
  }
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getReportDateRange(period, fromStr, toStr) {
  const now = new Date();
  if (period === 'day') {
    return { start: startOfDay(now), end: endOfDay(now), label: 'today' };
  }
  if (period === 'week') {
    const start = startOfDay(now);
    const day = start.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - mondayOffset);
    return { start, end: endOfDay(now), label: 'this_week' };
  }
  if (period === 'range' && fromStr && toStr) {
    const start = startOfDay(new Date(fromStr));
    const end = endOfDay(new Date(toStr));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return null;
    }
    return { start, end, label: 'custom' };
  }
  return { start: startOfDay(now), end: endOfDay(now), label: 'today' };
}

function summarizeOrderFinancials(items) {
  const sale_total = items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 1), 0);
  const cost_total = items.reduce((sum, i) => sum + Number(i.cost_price || 0) * Number(i.qty || 1), 0);
  return { sale_total, cost_total, profit: sale_total - cost_total };
}

export function getSalesReport({ period = 'day', from, to } = {}) {
  const range = getReportDateRange(period, from, to);
  if (!range) {
    return { error: 'Invalid date range' };
  }

  const orders = getOrders().filter((o) => {
    if (o.shipping_status === 'cancelled') return false;
    const created = new Date(o.created_at);
    return created >= range.start && created <= range.end;
  });

  const rows = orders.map((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const totals = summarizeOrderFinancials(items);
    return {
      id: order.id,
      order_id: order.order_id,
      customer_name: order.customer_name,
      phone: order.phone,
      created_at: order.created_at,
      shipping_status: order.shipping_status,
      items: items.map((i) => ({
        name: i.name,
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0,
        cost_price: Number(i.cost_price) || 0,
        sale_line: Number(i.price || 0) * Number(i.qty || 1),
        cost_line: Number(i.cost_price || 0) * Number(i.qty || 1),
      })),
      ...totals,
    };
  });

  const summary = rows.reduce(
    (acc, row) => ({
      order_count: acc.order_count + 1,
      sale_total: acc.sale_total + row.sale_total,
      cost_total: acc.cost_total + row.cost_total,
      profit: acc.profit + row.profit,
    }),
    { order_count: 0, sale_total: 0, cost_total: 0, profit: 0 }
  );

  return {
    period,
    range: {
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      label: range.label,
    },
    summary,
    orders: rows,
  };
}

export function getRepairServices() {
  return [...readData().repair_services].sort((a, b) => a.id - b.id);
}

export function countRepairServices() {
  return readData().repair_services.length;
}

export function insertRepairServices(items) {
  return withData((data) => {
    for (const item of items) {
      const id = data.meta.nextServiceId++;
      data.repair_services.push({
        id,
        name: item.name,
        description: item.description,
        price_from: Number(item.price_from),
        duration: item.duration,
        icon: item.icon,
      });
    }
  });
}

function enrichBooking(booking, services) {
  const service = services.find((s) => s.id === booking.service_id);
  return {
    ...booking,
    service_name: service?.name ?? null,
  };
}

export function createRepairBooking(input) {
  return withData((data) => {
    const id = data.meta.nextBookingId++;
    const createdAt = now();
    const booking = {
      id,
      booking_ref: formatBookingRef(id),
      customer_name: input.customer_name,
      phone: input.phone,
      alternative_contact: input.alternative_contact || '',
      device_brand: input.device_brand,
      device_model: input.device_model,
      issue: input.issue,
      issue_types: Array.isArray(input.issue_types) ? input.issue_types : [],
      issue_other: input.issue_other || '',
      estimated_repair_time: input.estimated_repair_time || '',
      screen_quality: input.screen_quality || '',
      dead_mobile_acknowledged: Boolean(input.dead_mobile_acknowledged),
      terms_accepted: Boolean(input.terms_accepted),
      service_id: input.service_id != null ? Number(input.service_id) : null,
      preferred_date: input.preferred_date || '',
      status: 'pending',
      status_history: [{ status: 'pending', at: createdAt, by: null }],
      activity_log: [],
      updated_at: createdAt,
      created_at: createdAt,
    };
    data.repair_bookings.push(booking);
    return enrichBooking(booking, data.repair_services);
  });
}

export function getRepairBookings() {
  const data = readData();
  return [...data.repair_bookings]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((booking) => enrichBooking(booking, data.repair_services));
}

export function updateBookingStatus(id, status, updatedBy = null) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.repair_bookings.findIndex((b) => b.id === numId);
    if (index === -1) return null;

    const existing = data.repair_bookings[index];
    if (existing.status === status) return existing;

    const at = now();
    const history = [...(existing.status_history || []), { status, at, by: updatedBy?.id ?? null }];
    const activity_log = [...(existing.activity_log || [])];
    if (updatedBy?.username) {
      activity_log.push({
        at,
        message: `Status updated to ${statusLabel(status)} by Staff: ${updatedBy.username}`,
        by: updatedBy.id,
      });
    }

    data.repair_bookings[index] = {
      ...existing,
      status,
      status_history: history,
      activity_log,
      updated_at: at,
    };
    return data.repair_bookings[index];
  });
}

export function createContactMessage(input) {
  return withData((data) => {
    const id = data.meta.nextMessageId++;
    const message = {
      id,
      name: input.name,
      email: input.email,
      phone: input.phone || '',
      message: input.message,
      customer_user_id: input.customer_user_id ?? null,
      created_at: now(),
    };
    data.contact_messages.push(message);
    return message;
  });
}

export function getContactMessages() {
  return [...readData().contact_messages].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );
}

export function replyContactMessage(id, staff_reply) {
  return withData((data) => {
    const index = data.contact_messages.findIndex((m) => m.id === Number(id));
    if (index === -1) return null;
    data.contact_messages[index] = {
      ...data.contact_messages[index],
      staff_reply: String(staff_reply || '').trim(),
      replied_at: now(),
    };
    return data.contact_messages[index];
  });
}

export function createOrder(input) {
  return withData((data) => {
    const rawItems = Array.isArray(input.items) ? input.items : [];
    const items = prepareOrderItems(rawItems, data.products);
    deductOrderStock(data.products, items);

    const id = data.meta.nextOrderId++;
    const total = items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 1), 0);
    const createdAt = now();
    const order = {
      id,
      order_id: formatOrderId(id),
      customer_name: input.customer_name,
      phone: input.phone,
      city: input.city || '',
      payment_mode: input.payment_mode || 'jazzcash',
      items,
      total_amount: total,
      shipping_status: 'pending',
      gmail: '',
      notes: input.notes || '',
      customer_user_id: input.customer_user_id ?? null,
      stock_deducted: true,
      status_history: [{ status: 'pending', at: createdAt, by: null }],
      activity_log: [],
      updated_at: createdAt,
      created_at: createdAt,
    };
    data.orders.push(order);
    return order;
  });
}

export function getOrders() {
  return [...readData().orders].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );
}

export function updateOrderStatus(id, shipping_status, updatedBy = null) {
  return withData((data) => {
    const index = data.orders.findIndex((o) => o.id === Number(id));
    if (index === -1) return null;

    const existing = data.orders[index];
    if (existing.shipping_status === shipping_status) return existing;

    const at = now();
    const wasCancelled = existing.shipping_status === 'cancelled';
    const isCancelled = shipping_status === 'cancelled';
    let stockDeducted = Boolean(existing.stock_deducted);

    if (!wasCancelled && isCancelled && stockDeducted) {
      restoreOrderStock(data, existing);
      stockDeducted = false;
    }

    const history = [
      ...(existing.status_history || []),
      { status: shipping_status, at, by: updatedBy?.id ?? null },
    ];
    const activity_log = [...(existing.activity_log || [])];
    if (updatedBy?.username) {
      let message = `Status updated to ${statusLabel(shipping_status)} by Staff: ${updatedBy.username}`;
      if (!wasCancelled && isCancelled && existing.stock_deducted) {
        message += ' — stock restored';
      }
      activity_log.push({
        at,
        message,
        by: updatedBy.id,
      });
    }

    data.orders[index] = {
      ...existing,
      shipping_status,
      stock_deducted: stockDeducted,
      status_history: history,
      activity_log,
      updated_at: at,
    };
    return data.orders[index];
  });
}

export function updateOrderGmail(id, gmail, phone) {
  return withData((data) => {
    const index = data.orders.findIndex((o) => o.id === Number(id));
    if (index === -1) return null;

    const existing = data.orders[index];
    if (normalizePhone(existing.phone) !== normalizePhone(phone)) return null;

    data.orders[index] = {
      ...existing,
      gmail: String(gmail || '').trim().toLowerCase(),
      updated_at: now(),
    };
    return data.orders[index];
  });
}

const PROFIT_STATUSES = new Set([
  'pending',
  'payment_verified',
  'shipped',
  'out_for_delivery',
  'delivered',
]);

export function getProfitReport() {
  const data = readData();
  let revenue = 0;
  let cost = 0;
  let orderCount = 0;
  const byProduct = new Map();

  for (const order of data.orders) {
    if (!PROFIT_STATUSES.has(order.shipping_status)) continue;
    orderCount += 1;
    for (const item of order.items || []) {
      const qty = Math.max(1, Number(item.qty || 1));
      const salePrice = Number(item.price || 0);
      const unitCost = Number(item.cost_price) || 0;
      const lineRevenue = salePrice * qty;
      const lineCost = unitCost * qty;
      revenue += lineRevenue;
      cost += lineCost;

      const key = Number(item.product_id) || String(item.name || 'unknown');
      const row = byProduct.get(key) || {
        product_id: item.product_id ?? null,
        name: item.name || 'Unknown',
        qty: 0,
        revenue: 0,
        cost: 0,
      };
      row.qty += qty;
      row.revenue += lineRevenue;
      row.cost += lineCost;
      byProduct.set(key, row);
    }
  }

  const products = [...byProduct.values()]
    .map((row) => ({
      ...row,
      profit: row.revenue - row.cost,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const lowStock = data.products
    .filter((p) => Number(p.stock) > 0 && Number(p.stock) <= LOW_STOCK_THRESHOLD)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock }))
    .sort((a, b) => a.stock - b.stock);

  return {
    order_count: orderCount,
    revenue,
    cost,
    profit: revenue - cost,
    margin_percent: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0,
    products,
    low_stock: lowStock,
    out_of_stock_count: data.products.filter((p) => Number(p.stock) <= 0).length,
  };
}

export function trackOrder(orderId, phone) {
  const data = readData();
  const key = String(orderId || '').trim().toUpperCase().replace(/^#/, '');
  const phoneKey = normalizePhone(phone);

  const order = data.orders.find((o) => {
    const ref = String(o.order_id || formatOrderId(o.id)).toUpperCase();
    const idMatch =
      ref === key ||
      ref === `ASF-${key}` ||
      key === `ASF-${1000 + o.id}` ||
      String(o.id) === key;
    const phoneMatch = normalizePhone(o.phone) === phoneKey;
    return idMatch && phoneMatch;
  });

  if (!order) return null;

  return {
    order_id: order.order_id,
    customer_name: order.customer_name,
    city: order.city,
    payment_mode: order.payment_mode,
    items: order.items,
    total_amount: order.total_amount,
    shipping_status: order.shipping_status,
    status_history: order.status_history || [],
    customer_feedback: order.customer_feedback || null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

export function submitOrderFeedback(orderId, phone, { rating, comment = '' }) {
  return withData((data) => {
    const key = String(orderId || '').trim().toUpperCase().replace(/^#/, '');
    const phoneKey = normalizePhone(phone);
    const stars = Number(rating);

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw new Error('Please select a satisfaction rating from 1 to 5');
    }

    const commentText = String(comment || '').trim().slice(0, 500);

    const index = data.orders.findIndex((o) => {
      const ref = String(o.order_id || formatOrderId(o.id)).toUpperCase();
      const idMatch =
        ref === key ||
        ref === `ASF-${key}` ||
        key === `ASF-${1000 + o.id}` ||
        String(o.id) === key;
      return idMatch && normalizePhone(o.phone) === phoneKey;
    });

    if (index === -1) return null;

    const order = data.orders[index];
    if (!['delivered', 'shipped', 'out_for_delivery', 'payment_verified'].includes(order.shipping_status)) {
      throw new Error('Feedback is available after your order is confirmed or delivered');
    }
    if (order.customer_feedback?.rating) {
      throw new Error('Feedback already submitted for this order');
    }

    order.customer_feedback = {
      rating: stars,
      comment: commentText,
      submitted_at: now(),
    };
    order.updated_at = now();
    return order;
  });
}

/* ── Auth / Users ── */

export function isUserBlocked(user) {
  if (!user) return true;
  return Boolean(user.blocked) || user.active === false;
}

export function ensureSuperAdmin({ email, username, password, name }) {
  return withData((data) => {
    const exists = data.users.some((u) => u.role === 'super_admin');
    if (exists) return null;

    const id = data.meta.nextUserId++;
    const userKey = String(username).trim().toLowerCase();
    const user = {
      id,
      name: String(name || username).trim() || userKey,
      email: String(email).trim().toLowerCase(),
      username: userKey,
      password_hash: hashPassword(password),
      role: 'super_admin',
      active: true,
      blocked: false,
      created_at: now(),
      last_login: null,
      created_by: null,
    };
    data.users.push(user);
    return user;
  });
}

/** Align super-admin Gmail with seed defaults (e.g. after typo fix on deploy). */
export function syncSuperAdminEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  return withData((data) => {
    const index = data.users.findIndex((u) => u.role === 'super_admin');
    if (index === -1) return { user: null, changed: false };

    const user = data.users[index];
    if (user.email === normalized) return { user, changed: false };

    user.email = normalized;
    return { user, changed: true };
  });
}

export function getUserById(id) {
  return readData().users.find((u) => u.id === Number(id)) || null;
}

export function findUserByLogin(login) {
  const key = String(login).trim().toLowerCase();
  const phoneKey = normalizePhone(login);
  return readData().users.find(
    (u) =>
      u.email === key ||
      u.username === key ||
      (phoneKey && normalizePhone(u.phone) === phoneKey)
  ) || null;
}

export function authenticateUser(login, password) {
  const user = findUserByLogin(login);
  if (!user) return { ok: false, reason: 'invalid' };
  if (isUserBlocked(user)) return { ok: false, reason: 'blocked' };
  if (!verifyPassword(password, user.password_hash)) return { ok: false, reason: 'invalid' };
  return { ok: true, user };
}

export function recordLastLogin(userId) {
  return withData((data) => {
    const index = data.users.findIndex((u) => u.id === Number(userId));
    if (index === -1) return null;
    data.users[index].last_login = now();
    return data.users[index];
  });
}

export function createSession(userId) {
  return withData((data) => {
    const token = createToken();
    const session = {
      token,
      user_id: Number(userId),
      created_at: now(),
      expires_at: sessionExpiry(7),
    };
    data.sessions.push(session);
    return session;
  });
}

export function getSessionByToken(token) {
  const data = readData();
  const session = data.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (session.expires_at <= now()) {
    withData((d) => {
      d.sessions = d.sessions.filter((s) => s.token !== token);
    });
    return null;
  }
  return session;
}

export function deleteSession(token) {
  return withData((data) => {
    data.sessions = data.sessions.filter((s) => s.token !== token);
  });
}

export function listUsers() {
  return readData()
    .users.map(({ password_hash, ...rest }) => rest)
    .sort((a, b) => a.id - b.id);
}

export function createCustomer({ name, email, phone, username, password, password_hash }) {
  return withData((data) => {
    const emailKey = String(email || '').trim().toLowerCase();
    const phoneKey = normalizePhone(phone);
    const userKey = String(username || '').trim().toLowerCase();

    if (!userKey) {
      throw new Error('Username is required');
    }
    if (!emailKey && !phoneKey) {
      throw new Error('Gmail or phone number is required');
    }
    if (emailKey && !emailKey.endsWith('@gmail.com')) {
      throw new Error('Please use a @gmail.com address');
    }
    if (data.users.some((u) => u.username === userKey)) {
      throw new Error('Username already taken');
    }
    if (emailKey && data.users.some((u) => u.email === emailKey)) {
      throw new Error('Gmail already registered');
    }
    if (phoneKey && data.users.some((u) => normalizePhone(u.phone) === phoneKey)) {
      throw new Error('Phone number already registered');
    }

    const id = data.meta.nextUserId++;
    const user = {
      id,
      name: String(name).trim(),
      email: emailKey,
      phone: phoneKey,
      username: userKey,
      password_hash: password_hash || hashPassword(password),
      role: 'customer',
      active: true,
      blocked: false,
      created_at: now(),
      last_login: null,
      created_by: null,
    };
    data.users.push(user);
    return user;
  });
}

export function getOrdersByCustomerId(customerId) {
  const id = Number(customerId);
  return getOrders().filter((o) => o.customer_user_id === id);
}

export function getContactMessagesByCustomerId(customerId) {
  const id = Number(customerId);
  return getContactMessages().filter((m) => m.customer_user_id === id);
}

export function createUser({ email, name, username, password, role, createdBy }) {
  return withData((data) => {
    const emailKey = String(email).trim().toLowerCase();
    const displayName = String(name || username || emailKey.split('@')[0]).trim();
    const userKey = String(username || emailKey.split('@')[0]).trim().toLowerCase();

    if (!emailKey.endsWith('@gmail.com')) {
      throw new Error('Staff must register with a @gmail.com address');
    }
    if (data.users.some((u) => u.email === emailKey)) {
      throw new Error('Gmail already registered');
    }
    if (data.users.some((u) => u.username === userKey)) {
      throw new Error('Username already taken');
    }

    const id = data.meta.nextUserId++;
    const user = {
      id,
      name: displayName,
      email: emailKey,
      username: userKey,
      password_hash: hashPassword(password),
      role,
      active: true,
      blocked: false,
      created_at: now(),
      last_login: null,
      created_by: createdBy ?? null,
    };
    data.users.push(user);
    return user;
  });
}

export function resetSuperAdminPassword(password) {
  return withData((data) => {
    const index = data.users.findIndex((u) => u.role === 'super_admin');
    if (index === -1) return null;

    data.users[index].password_hash = hashPassword(password);
    data.sessions = [];
    return data.users[index];
  });
}

export function updateUser(id, patch) {
  return withData((data) => {
    const index = data.users.findIndex((u) => u.id === Number(id));
    if (index === -1) return null;

    const user = data.users[index];
    if (patch.role != null) user.role = patch.role;
    if (patch.name != null) user.name = String(patch.name).trim();
    if (patch.active != null) {
      user.active = Boolean(patch.active);
      user.blocked = !user.active;
    }
    if (patch.blocked != null) {
      user.blocked = Boolean(patch.blocked);
      user.active = !user.blocked;
    }
    data.users[index] = user;
    return user;
  });
}

export function toggleUserBlock(id, blocked) {
  return withData((data) => {
    const index = data.users.findIndex((u) => u.id === Number(id));
    if (index === -1) return null;

    const user = data.users[index];
    user.blocked = Boolean(blocked);
    user.active = !user.blocked;
    data.users[index] = user;

    if (user.blocked) {
      data.sessions = data.sessions.filter((s) => s.user_id !== user.id);
    }
    return user;
  });
}

export function resetUserPassword(id, password) {
  return withData((data) => {
    const index = data.users.findIndex((u) => u.id === Number(id));
    if (index === -1) return null;

    data.users[index].password_hash = hashPassword(password);
    data.sessions = data.sessions.filter((s) => s.user_id !== Number(id));
    return data.users[index];
  });
}

export function deleteUser(id) {
  return withData((data) => {
    const numId = Number(id);
    const before = data.users.length;
    data.users = data.users.filter((u) => u.id !== numId);
    data.sessions = data.sessions.filter((s) => s.user_id !== numId);
    return before !== data.users.length;
  });
}

export function deactivateUser(id) {
  return toggleUserBlock(id, true);
}

/* ── Verification codes ── */

export function createVerificationCode({ purpose, channel, target, payload, codeHash, expiresAt }) {
  return withData((data) => {
    const targetKey = String(target).trim().toLowerCase();
    data.verification_codes = (data.verification_codes || []).filter(
      (c) => !(c.purpose === purpose && c.target === targetKey)
    );

    const id = data.meta.nextVerificationCodeId || 1;
    data.meta.nextVerificationCodeId = id + 1;

    const entry = {
      id,
      purpose,
      channel,
      target: targetKey,
      code_hash: codeHash,
      payload: payload || {},
      attempts: 0,
      created_at: now(),
      expires_at: expiresAt,
    };
    data.verification_codes.push(entry);
    return entry;
  });
}

export function verifyAndConsumeCode({ purpose, target, code, verifyFn }) {
  return withData((data) => {
    const targetKey = String(target).trim().toLowerCase();
    const phoneKey = normalizePhone(target);
    const index = (data.verification_codes || []).findIndex((c) => {
      if (c.purpose !== purpose) return false;
      if (c.target === targetKey) return true;
      if (phoneKey && normalizePhone(c.target) === phoneKey) return true;
      return false;
    });

    if (index === -1) return { ok: false, reason: 'not_found' };

    const entry = data.verification_codes[index];
    if (entry.expires_at <= now()) {
      data.verification_codes.splice(index, 1);
      return { ok: false, reason: 'expired' };
    }

    if (entry.attempts >= 5) {
      data.verification_codes.splice(index, 1);
      return { ok: false, reason: 'too_many_attempts' };
    }

    entry.attempts += 1;

    if (!verifyFn(code, entry.code_hash)) {
      return { ok: false, reason: 'invalid' };
    }

    const payload = { ...entry.payload };
    data.verification_codes.splice(index, 1);
    return { ok: true, payload, channel: entry.channel };
  });
}

export function updateCustomerProfile(userId, { name }) {
  return withData((data) => {
    const index = data.users.findIndex((u) => u.id === Number(userId));
    if (index === -1) return null;

    const user = data.users[index];
    if (user.role !== 'customer') return null;

    if (name != null) {
      const trimmed = String(name).trim();
      if (!trimmed || trimmed.length > 120) {
        throw new Error('Name is required (max 120 characters)');
      }
      user.name = trimmed;
    }

    data.users[index] = user;
    return user;
  });
}

export function changeCustomerPassword(userId, currentPassword, newPassword) {
  return withData((data) => {
    const index = data.users.findIndex((u) => u.id === Number(userId));
    if (index === -1) return { ok: false, reason: 'not_found' };

    const user = data.users[index];
    if (user.role !== 'customer') return { ok: false, reason: 'forbidden' };
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return { ok: false, reason: 'invalid_password' };
    }

    user.password_hash = hashPassword(newPassword);
    data.users[index] = user;
    return { ok: true, user };
  });
}

/* ── Shop status ── */

export function getShopSettings() {
  return readData().settings?.shop || {
    manual_override: null,
    updated_at: null,
    updated_by: null,
  };
}

export function setShopManualOverride(manual_override, userId) {
  return withData((data) => {
    if (!data.settings) data.settings = {};
    if (!data.settings.shop) {
      data.settings.shop = { manual_override: null, updated_at: null, updated_by: null };
    }
    data.settings.shop.manual_override = manual_override;
    data.settings.shop.updated_at = now();
    data.settings.shop.updated_by = userId ?? null;
    return data.settings.shop;
  });
}
