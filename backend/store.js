import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createToken, hashPassword, sessionExpiry, verifyPassword } from './auth/crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

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
  }

  for (const msg of data.contact_messages) {
    if (msg.customer_user_id == null) msg.customer_user_id = null;
  }

  data.sessions = data.sessions.filter((s) => s.expires_at > nowIso);
  data.verification_codes = (data.verification_codes || []).filter((c) => c.expires_at > nowIso);
  return data;
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
  }
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const data = migrateData(JSON.parse(raw));
  writeData(data);
  return data;
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function withData(mutator) {
  const data = readData();
  const result = mutator(data);
  writeData(data);
  return result;
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
  const { category, featured, search, on_sale } = filters;
  let products = readData().products;

  if (category && category !== 'all') {
    products = products.filter((p) => p.category === category);
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
        String(p.description).toLowerCase().includes(term)
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
      price: Number(input.price),
      description: input.description,
      image: input.image || '',
      stock: Number(input.stock) || 0,
      featured: input.featured ? 1 : 0,
      discount_percent: Math.min(90, Math.max(0, Number(input.discount_percent) || 0)),
      warranty: String(input.warranty || '').trim(),
      created_at: now(),
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
      price: input.price != null ? Number(input.price) : existing.price,
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
    const id = data.meta.nextOrderId++;
    const items = Array.isArray(input.items) ? input.items : [];
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
    const history = [
      ...(existing.status_history || []),
      { status: shipping_status, at, by: updatedBy?.id ?? null },
    ];
    const activity_log = [...(existing.activity_log || [])];
    if (updatedBy?.username) {
      activity_log.push({
        at,
        message: `Status updated to ${statusLabel(shipping_status)} by Staff: ${updatedBy.username}`,
        by: updatedBy.id,
      });
    }

    data.orders[index] = {
      ...existing,
      shipping_status,
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
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
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

export function createCustomer({ name, email, phone, username, password }) {
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
      password_hash: hashPassword(password),
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
