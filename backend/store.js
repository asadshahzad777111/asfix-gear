import { createToken, hashPassword, sessionExpiry, verifyPassword } from './auth/crypto.js';
import { formatOrderId, formatBookingRef } from './store/data-migration.js';
import { readData, withData, getStorageBackend, initStorage, isStorageReady } from './store/storage.js';
import { productMatchesSearch } from './utils/product-search.js';
import { slugify, ensureUniqueSlug, isValidSlug } from './utils/slug.js';

export { slugify, ensureUniqueSlug, isValidSlug };

const MAX_TAGS = 20;
const MAX_TAG_LEN = 40;

export function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const tag = String(raw || '').trim().slice(0, MAX_TAG_LEN);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function resolveProductSlug(data, { slug, name, excludeId }) {
  const raw = String(slug ?? '').trim() ? slugify(slug) : slugify(name);
  if (!raw) return '';
  if (!isValidSlug(raw)) throw new Error('Invalid product slug');
  return ensureUniqueSlug(data.products, raw, excludeId);
}

export { getStorageBackend, initStorage, isStorageReady };
export { formatOrderId, formatBookingRef };

export const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_POS_SETTINGS = {
  posReturnWindowHours: 24,
  posDiscountMaxPercentWithoutPin: 10,
  posDiscountMaxAmountWithoutPin: 500,
};

const DEFAULT_CUSTOM_BILL_OWN = {
  shopName: 'AsFix & Gear',
  shopPlace: 'Lahore',
  shopPhone: '',
  logoSource: 'own',
  scannerSource: 'own',
  includeLogo: true,
  includeQr: true,
  qrPayload: '',
};

const DEFAULT_CUSTOM_BILL_ASFIN = {
  shopName: 'ASPLYWOOD',
  shopPlace: 'Lahore',
  shopPhone: '',
  logoSource: 'asfin',
  scannerSource: 'asfin',
  includeLogo: true,
  includeQr: true,
  qrPayload: 'https://asfins.com',
};

const DEFAULT_CUSTOM_BILL_OTHER = {
  shopName: 'Osama Center',
  shopPlace: 'Trade World',
  shopPhone: '',
  logoSource: 'none',
  scannerSource: 'none',
  includeLogo: false,
  includeQr: false,
  qrPayload: '',
};

function clampPosStr(value, max, fallback = '') {
  const text = value == null ? '' : String(value).trim().slice(0, max);
  return text || fallback;
}

function normalizeMediaSource(value, fallback = 'none') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'own' || raw === 'asfin' || raw === 'custom' || raw === 'none') return raw;
  return fallback;
}

function resolveLogoSource(src = {}, fallback = 'none') {
  if (src.logoSource != null && String(src.logoSource).trim() !== '') {
    return normalizeMediaSource(src.logoSource, fallback);
  }
  if (src.includeLogo) return 'custom';
  return normalizeMediaSource(fallback, 'none');
}

function resolveScannerSource(src = {}, fallback = 'none') {
  if (src.scannerSource != null && String(src.scannerSource).trim() !== '') {
    return normalizeMediaSource(src.scannerSource, fallback);
  }
  if (src.includeQr) return 'custom';
  return normalizeMediaSource(fallback, 'none');
}

function normalizeCustomBillProfile(raw, fallback) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const logoSource = resolveLogoSource(src, fallback.logoSource);
  const scannerSource = resolveScannerSource(src, fallback.scannerSource);
  return {
    shopName: clampPosStr(src.shopName ?? fallback.shopName, 80, fallback.shopName),
    shopPlace: clampPosStr(src.shopPlace ?? fallback.shopPlace, 80),
    shopPhone: clampPosStr(src.shopPhone ?? fallback.shopPhone, 40),
    logoSource,
    scannerSource,
    includeLogo: logoSource !== 'none',
    includeQr: scannerSource !== 'none',
    qrPayload: clampPosStr(src.qrPayload ?? fallback.qrPayload, 500),
  };
}

function normalizeCustomBillPosFields(input = {}) {
  const active = String(input.customBillActiveProfile || '').trim().toLowerCase();
  return {
    customBillActiveProfile:
      active === 'asfin' ? 'asfin' : active === 'other' ? 'other' : 'own',
    customBillOwn: normalizeCustomBillProfile(input.customBillOwn, DEFAULT_CUSTOM_BILL_OWN),
    customBillAsfin: normalizeCustomBillProfile(input.customBillAsfin, DEFAULT_CUSTOM_BILL_ASFIN),
    customBillOther: normalizeCustomBillProfile(input.customBillOther, DEFAULT_CUSTOM_BILL_OTHER),
  };
}

/** Salable units only — low stock (>0) remains orderable until stock hits 0. */
export function normalizeProductStock(stock) {
  const n = Number(stock);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export const PRODUCT_STATUSES = ['published', 'draft'];

export function normalizeProductStatus(status, fallback = 'published') {
  const value = String(status ?? fallback).trim().toLowerCase();
  if (!PRODUCT_STATUSES.includes(value)) {
    throw new Error('Invalid product status');
  }
  return value;
}

export function isPublishedProduct(product) {
  return (product?.status || 'published') === 'published';
}

export class StockError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StockError';
    this.details = details;
  }
}

function now() {
  return new Date().toISOString();
}

function staffAuditUser(user = {}) {
  const name = String(user.name || user.username || user.email || '').trim();
  return {
    id: user.id ?? null,
    name: name.slice(0, 120),
    role: String(user.role || '').trim().slice(0, 40),
  };
}

function appendAuditLog(data, action, payload = {}) {
  if (!Array.isArray(data.audit_logs)) data.audit_logs = [];
  if (!data.meta.nextAuditId) {
    data.meta.nextAuditId = data.audit_logs.reduce((max, log) => Math.max(max, Number(log.id) || 0), 0) + 1;
  }
  const actor = staffAuditUser(payload.actor);
  const entry = {
    id: data.meta.nextAuditId++,
    action: String(action || '').trim().slice(0, 80),
    entity_type: String(payload.entity_type || '').trim().slice(0, 80),
    entity_id: payload.entity_id ?? null,
    at: now(),
    actor_user_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    summary: String(payload.summary || '').trim().slice(0, 300),
    details: payload.details && typeof payload.details === 'object' ? payload.details : {},
  };
  data.audit_logs.unshift(entry);
  data.audit_logs = data.audit_logs.slice(0, 2000);
  return entry;
}

export function getAuditLogs({ action, actorUserId, limit = 250 } = {}) {
  let logs = Array.isArray(readData().audit_logs) ? readData().audit_logs : [];
  if (action && action !== 'all') {
    logs = logs.filter((log) => log.action === action);
  }
  if (actorUserId != null && actorUserId !== '' && actorUserId !== 'all') {
    logs = logs.filter((log) => String(log.actor_user_id) === String(actorUserId));
  }
  const n = Math.max(1, Math.min(500, Number(limit) || 250));
  return logs.slice(0, n);
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/** ASF-1001 / asf 1001 / #1001 / 1001 → ASF1001 or 1001 (case/space/dash insensitive). */
export function normalizeTrackRef(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/^#/, '')
    .replace(/[^A-Z0-9]/g, '');
}

function orderMatchesTrackRef(order, rawKey) {
  const key = normalizeTrackRef(rawKey);
  if (!key) return false;
  const id = Number(order.id);
  const formatted = formatOrderId(id); // ASF-1001
  const candidates = new Set([
    normalizeTrackRef(order.order_id),
    normalizeTrackRef(formatted),
    normalizeTrackRef(String(id)),
    normalizeTrackRef(String(1000 + id)),
    normalizeTrackRef(`ASF${1000 + id}`),
  ]);
  return candidates.has(key);
}

function repairMatchesTrackRef(booking, rawKey) {
  const key = normalizeTrackRef(rawKey);
  if (!key) return false;
  const id = Number(booking.id);
  const formatted = formatBookingRef(id); // ASF-R-1001
  const candidates = new Set([
    normalizeTrackRef(booking.booking_ref),
    normalizeTrackRef(formatted),
    normalizeTrackRef(String(id)),
    normalizeTrackRef(String(1000 + id)),
    normalizeTrackRef(`ASFR${1000 + id}`),
    normalizeTrackRef(`R${1000 + id}`),
  ]);
  return candidates.has(key);
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
    pending_payment: 'Pending Payment',
    paid: 'Paid',
    waiting_for_rider: 'Waiting for Rider',
    rider_assigned: 'Rider Assigned',
  };
  return labels[status] || status;
}

export function orderCustomerStatus(order) {
  if (order.payment_status === 'pending_payment') return 'pending_payment';
  if (order.delivery_status === 'waiting_for_rider') return 'waiting_for_rider';
  if (order.delivery_status === 'rider_assigned') return 'rider_assigned';
  if (order.delivery_status === 'delivered') return 'delivered';
  if (order.shipping_status === 'cancelled') return 'cancelled';
  return order.shipping_status || 'pending';
}

function textValue(value, max) {
  return String(value || '').trim().slice(0, max);
}

function composeStructuredAddress(input) {
  return [
    input.houseNumber,
    input.streetAddress,
    input.landmark,
    input.city,
    input.region,
    input.postalCode,
    input.country,
  ].filter(Boolean).join(', ');
}

function validateShippingAddress(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = textValue(raw.fullName || raw.name, 120);
  const phone = textValue(raw.phone, 30);
  const country = textValue(raw.country, 80) || 'Pakistan';
  const region = textValue(raw.region || raw.province || raw.state, 80);
  const city = textValue(raw.city, 80);
  const postalCode = textValue(raw.postalCode || raw.zip || raw.zipCode, 20);
  const streetAddress = textValue(raw.streetAddress || raw.addressLine1 || raw.text, 220);
  const houseNumber = textValue(raw.houseNumber || raw.building || raw.unit, 80);
  const landmark = textValue(raw.landmark, 120);
  const notes = textValue(raw.notes, 300);
  const composed = composeStructuredAddress({
    houseNumber,
    streetAddress,
    landmark,
    city,
    region,
    postalCode,
    country,
  });
  const text = textValue(raw.text, 500) || composed;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!name || !phone || !text) {
    throw new Error('Delivery address requires name, phone, and address details');
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Drop a map pin for delivery location');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid map coordinates');
  }
  return {
    name,
    fullName: name,
    phone,
    country,
    region,
    city,
    postalCode,
    streetAddress,
    houseNumber,
    landmark,
    notes,
    text,
    lat,
    lng,
  };
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
  const { category, featured, search, on_sale, brand, stock_status, status } = filters;
  let products = readData().products;

  if (status && status !== 'all') {
    products = products.filter((p) => (p.status || 'published') === status);
  }

  if (category && category !== 'all') {
    const cat = String(category).trim().toLowerCase();
    products = products.filter(
      (p) => String(p.category || '').trim().toLowerCase() === cat
    );
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
  if (stock_status === 'out_of_stock') {
    products = products.filter((p) => (Number(p.stock) || 0) <= 0);
  } else if (stock_status === 'low_stock') {
    products = products.filter((p) => {
      const n = Number(p.stock) || 0;
      return n > 0 && n <= LOW_STOCK_THRESHOLD;
    });
  } else if (stock_status === 'in_stock') {
    products = products.filter((p) => (Number(p.stock) || 0) > LOW_STOCK_THRESHOLD);
  }
  if (search) {
    products = products.filter((p) => productMatchesSearch(p, search));
  }

  return sortProducts(products);
}

export function getProductCategories({ includeDrafts = false } = {}) {
  const data = readData();
  let products = data.products;
  if (!includeDrafts) {
    products = products.filter((p) => isPublishedProduct(p));
  }
  const fromProducts = products.map((p) => p.category).filter(Boolean);
  const fromRegistry = (data.settings?.product_categories || []).map((c) => c.name);
  const categories = [...new Set([...fromRegistry, ...fromProducts])];
  return categories.sort((a, b) => a.localeCompare(b));
}

export function getProductById(id) {
  const numId = Number(id);
  return readData().products.find((p) => p.id === numId) || null;
}

export function getProductBySlug(slug) {
  const normalized = slugify(String(slug || '').trim());
  if (!normalized) return null;
  return (
    readData().products.find((p) => slugify(p.slug || '') === normalized) || null
  );
}

const MAX_GALLERY_IMAGES = 8;

export function normalizeGallery(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, MAX_GALLERY_IMAGES);
}

export function createProduct(input) {
  return withData((data) => {
    const id = data.meta.nextProductId++;
    const slug = resolveProductSlug(data, { slug: input.slug, name: input.name });
    const product = {
      id,
      name: input.name,
      category: input.category,
      brand: String(input.brand || '').trim(),
      compatible_models: String(input.compatible_models || '').trim(),
      price: Number(input.price),
      cost_price: Math.max(0, Number(input.cost_price) || 0),
      description: String(input.description || '').trim(),
      slug,
      tags: normalizeTags(input.tags),
      image: input.image || '',
      hover_image: String(input.hover_image || '').trim(),
      gallery: normalizeGallery(input.gallery),
      stock: Number(input.stock) || 0,
      featured: input.featured ? 1 : 0,
      discount_percent: Math.min(90, Math.max(0, Number(input.discount_percent) || 0)),
      warranty: String(input.warranty || '').trim(),
      sale_count: Math.max(0, Number(input.sale_count) || 0),
      purchase_count: Math.max(0, Number(input.purchase_count) || 0),
      created_at: now(),
      // Ownership: whoever adds a product is the only one (besides a Super
      // Admin) who can edit its details/stock/discount going forward — keeps
      // staff from stepping on each other's listings.
      created_by: input.created_by ?? null,
      created_by_name: String(input.created_by_name || '').trim(),
      status: normalizeProductStatus(input.status, 'published'),
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
      slug:
        input.slug != null || input.name != null
          ? resolveProductSlug(data, {
              slug: input.slug != null ? input.slug : existing.slug,
              name: input.name ?? existing.name,
              excludeId: numId,
            })
          : existing.slug ?? '',
      tags: input.tags != null ? normalizeTags(input.tags) : existing.tags ?? [],
      image: input.image ?? existing.image,
      hover_image:
        input.hover_image != null ? String(input.hover_image || '').trim() : existing.hover_image ?? '',
      gallery: input.gallery != null ? normalizeGallery(input.gallery) : existing.gallery ?? [],
      stock: input.stock != null ? Number(input.stock) : existing.stock,
      sale_count:
        input.sale_count != null ? Math.max(0, Number(input.sale_count) || 0) : existing.sale_count ?? 0,
      purchase_count:
        input.purchase_count != null
          ? Math.max(0, Number(input.purchase_count) || 0)
          : existing.purchase_count ?? 0,
      featured:
        input.featured != null ? (input.featured ? 1 : 0) : existing.featured,
      discount_percent: discount,
      warranty: input.warranty != null ? String(input.warranty).trim() : existing.warranty ?? '',
      status:
        input.status != null
          ? normalizeProductStatus(input.status, existing.status || 'published')
          : existing.status || 'published',
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
export function adjustProductStock(id, delta, {
  reason = 'offline_sale',
  note = '',
  staffName = '',
  actor = null,
} = {}) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.products.findIndex((p) => p.id === numId);
    if (index === -1) return null;

    const change = Math.trunc(Number(delta));
    if (!change) throw new Error('Stock change amount is required');

    const product = data.products[index];
    const currentStock = Number(product.stock) || 0;
    const nextStock = Math.max(0, currentStock + change);
    const cleanReason = String(reason || 'manual_adjust').trim().slice(0, 80);
    const cleanNote = String(note || '').trim().slice(0, 200);

    const logEntry = {
      at: now(),
      delta: nextStock - currentStock,
      reason: cleanReason,
      note: cleanNote,
      staff: String(staffName || '').trim().slice(0, 60),
      resulting_stock: nextStock,
    };

    const stockLog = Array.isArray(product.stock_log) ? product.stock_log : [];
    product.stock = nextStock;
    if (logEntry.delta < 0) {
      product.sale_count = Math.max(0, Number(product.sale_count || 0) + Math.abs(logEntry.delta));
    } else if (logEntry.delta > 0 && reason === 'restock') {
      product.purchase_count = Math.max(0, Number(product.purchase_count || 0) + logEntry.delta);
    }
    product.stock_log = [...stockLog, logEntry].slice(-50);
    appendAuditLog(data, 'stock_adjust', {
      actor,
      entity_type: 'product',
      entity_id: product.id,
      summary: `${product.name}: stock ${currentStock} -> ${nextStock}`,
      details: {
        product_id: product.id,
        product_name: product.name,
        before_stock: currentStock,
        after_stock: nextStock,
        delta: nextStock - currentStock,
        reason: cleanReason,
        note: cleanNote,
      },
    });

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

export function deleteProduct(id, { actor = null } = {}) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.products.findIndex((p) => p.id === numId);
    if (index === -1) return false;
    const [deleted] = data.products.splice(index, 1);
    appendAuditLog(data, 'product_delete', {
      actor,
      entity_type: 'product',
      entity_id: deleted.id,
      summary: `Deleted product: ${deleted.name}`,
      details: {
        product_id: deleted.id,
        product_name: deleted.name,
        category: deleted.category,
        stock: deleted.stock,
        price: deleted.price,
      },
    });
    return true;
  });
}

export function duplicateProduct(id, input = {}) {
  return withData((data) => {
    const existing = data.products.find((p) => p.id === Number(id));
    if (!existing) return null;
    const newId = data.meta.nextProductId++;
    const copyName = `${existing.name} (Copy)`;
    const slug = resolveProductSlug(data, { slug: '', name: copyName });
    const copy = {
      ...existing,
      id: newId,
      name: copyName,
      slug,
      tags: Array.isArray(existing.tags) ? [...existing.tags] : [],
      featured: 0,
      gallery: Array.isArray(existing.gallery) ? [...existing.gallery] : [],
      created_at: now(),
      created_by: input.created_by ?? existing.created_by,
      created_by_name: String(input.created_by_name || existing.created_by_name || '').trim(),
      stock_log: [],
      status: 'draft',
    };
    data.products.push(copy);
    return copy;
  });
}

export function bulkDeleteProducts(ids = [], { actor = null } = {}) {
  const idSet = new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
  if (!idSet.size) return 0;
  return withData((data) => {
    const deleted = data.products.filter((p) => idSet.has(p.id));
    data.products = data.products.filter((p) => !idSet.has(p.id));
    for (const product of deleted) {
      appendAuditLog(data, 'product_delete', {
        actor,
        entity_type: 'product',
        entity_id: product.id,
        summary: `Deleted product: ${product.name}`,
        details: {
          product_id: product.id,
          product_name: product.name,
          category: product.category,
          stock: product.stock,
          price: product.price,
          bulk: true,
        },
      });
    }
    return deleted.length;
  });
}

export function getAdminDashboardStats() {
  const data = readData();
  const products = data.products;
  const orders = data.orders || [];
  const bookings = data.repair_bookings || [];
  const lowStock = products.filter((p) => {
    const n = Number(p.stock) || 0;
    return n > 0 && n <= LOW_STOCK_THRESHOLD;
  }).length;
  return {
    products: products.length,
    orders: orders.length,
    pendingOrders: orders.filter((o) => o.shipping_status === 'pending').length,
    lowStock,
    outOfStock: products.filter((p) => (Number(p.stock) || 0) <= 0).length,
    onSale: products.filter((p) => Number(p.discount_percent) > 0).length,
    featured: products.filter((p) => Number(p.featured) === 1).length,
    bookings: bookings.length,
    pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    unreadMessages: (data.contact_messages || []).filter((m) => !m.staff_reply).length,
    unreadRepairChats: (data.repair_messages || []).filter(
      (m) => m.sender === 'customer' && !m.read_by_staff
    ).length,
  };
}

export function countProducts() {
  return readData().products.length;
}

export function countProductsByCategory(category) {
  return readData().products.filter((p) => p.category === category).length;
}

const MAX_CATEGORY_NAME_LEN = 80;

function categoryProductCounts(data) {
  const counts = new Map();
  for (const p of data.products || []) {
    const name = String(p.category || '').trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

function ensureUniqueCategorySlug(categories, baseSlug, excludeId = null) {
  const root = slugify(baseSlug);
  if (!root) return '';
  let candidate = root;
  let n = 2;
  const taken = (s) =>
    categories.some((c) => c.slug === s && Number(c.id) !== Number(excludeId));
  while (taken(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

function categoryDescendantIds(categories, rootId) {
  const ids = new Set([Number(rootId)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parent_id != null && ids.has(Number(c.parent_id)) && !ids.has(Number(c.id))) {
        ids.add(Number(c.id));
        changed = true;
      }
    }
  }
  return ids;
}

export function listProductCategories() {
  const data = readData();
  const categories = data.settings?.product_categories || [];
  const counts = categoryProductCounts(data);
  return categories
    .map((c) => ({
      ...c,
      product_count: counts.get(c.name) || 0,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function createProductCategory(input) {
  return withData((data) => {
    if (!data.settings) data.settings = {};
    if (!Array.isArray(data.settings.product_categories)) {
      data.settings.product_categories = [];
    }
    if (!data.meta.nextCategoryId) data.meta.nextCategoryId = 1;

    const name = String(input.name || '').trim().slice(0, MAX_CATEGORY_NAME_LEN);
    if (!name) throw new Error('Category name is required');

    const list = data.settings.product_categories;
    if (list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A category with this name already exists');
    }

    let parent_id = input.parent_id != null && input.parent_id !== '' ? Number(input.parent_id) : null;
    if (parent_id != null) {
      if (!list.some((c) => c.id === parent_id)) {
        throw new Error('Parent category not found');
      }
    }

    const slugInput = String(input.slug || '').trim() ? input.slug : name;
    const slug = ensureUniqueCategorySlug(list, slugInput);
    if (!isValidSlug(slug)) throw new Error('Invalid category slug');

    const id = data.meta.nextCategoryId++;
    const category = {
      id,
      name,
      slug,
      parent_id,
      created_at: now(),
    };
    list.push(category);
    return { ...category, product_count: 0 };
  });
}

export function updateProductCategory(id, input) {
  return withData((data) => {
    const numId = Number(id);
    const list = data.settings?.product_categories || [];
    const index = list.findIndex((c) => c.id === numId);
    if (index === -1) return null;

    const existing = list[index];
    const counts = categoryProductCounts(data);
    const productCount = counts.get(existing.name) || 0;

    const next = { ...existing };

    if (input.name != null) {
      const name = String(input.name).trim().slice(0, MAX_CATEGORY_NAME_LEN);
      if (!name) throw new Error('Category name is required');
      if (name !== existing.name) {
        if (productCount > 0) {
          throw new Error(
            `Cannot rename — ${productCount} product(s) use this category. Create a new category instead.`
          );
        }
        if (list.some((c) => c.id !== numId && c.name.toLowerCase() === name.toLowerCase())) {
          throw new Error('A category with this name already exists');
        }
        next.name = name;
      }
    }

    if (input.slug != null) {
      const slug = ensureUniqueCategorySlug(list, input.slug || next.name, numId);
      if (!isValidSlug(slug)) throw new Error('Invalid category slug');
      next.slug = slug;
    }

    if (input.parent_id !== undefined) {
      let parent_id = input.parent_id != null && input.parent_id !== '' ? Number(input.parent_id) : null;
      if (parent_id === numId) throw new Error('A category cannot be its own parent');
      if (parent_id != null) {
        if (!list.some((c) => c.id === parent_id)) {
          throw new Error('Parent category not found');
        }
        const descendants = categoryDescendantIds(list, numId);
        if (descendants.has(parent_id)) {
          throw new Error('Invalid parent — would create a circular hierarchy');
        }
      }
      next.parent_id = parent_id;
    }

    list[index] = next;
    return { ...next, product_count: counts.get(next.name) || 0 };
  });
}

export function deleteProductCategory(id) {
  return withData((data) => {
    const numId = Number(id);
    const list = data.settings?.product_categories || [];
    const index = list.findIndex((c) => c.id === numId);
    if (index === -1) return { deleted: false, reason: 'not_found' };

    const existing = list[index];
    const counts = categoryProductCounts(data);
    const productCount = counts.get(existing.name) || 0;
    if (productCount > 0) {
      return {
        deleted: false,
        reason: 'in_use',
        product_count: productCount,
        message: `Cannot delete — ${productCount} product(s) use this category`,
      };
    }

    const hasChildren = list.some((c) => Number(c.parent_id) === numId);
    if (hasChildren) {
      return {
        deleted: false,
        reason: 'has_children',
        message: 'Cannot delete — move or delete child categories first',
      };
    }

    list.splice(index, 1);
    return { deleted: true };
  });
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
      data.products[index].sale_count = Math.max(
        0,
        Number(data.products[index].sale_count || 0) - qty
      );
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
    if (!isPublishedProduct(product)) {
      throw new StockError(`"${product.name}" is no longer available`);
    }
    if (normalizeProductStock(product.stock) < qty) {
      const available = normalizeProductStock(product.stock);
      throw new StockError(
        `Insufficient stock for "${product.name}" — only ${available} left`,
        {
          product_id: product.id,
          name: product.name,
          available,
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
      products[index].sale_count = Math.max(0, Number(products[index].sale_count || 0) + item.qty);
    }
  }
}

function orderItemsSubtotal(items) {
  return items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 1), 0);
}

function currentSalePrice(product) {
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) return 0;
  const discount = Math.min(90, Math.max(0, Number(product.discount_percent) || 0));
  return Math.round(price * (1 - discount / 100));
}

function prepareCounterDraftItems(rawItems, products) {
  const normalized = [];
  for (const item of rawItems) {
    const productId = Number(item?.product_id);
    const qty = Number(item?.qty);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new StockError('Invalid product in draft');
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new StockError('Quantity must be between 1 and 99');
    }
    const product = products.find((p) => p.id === productId);
    if (!product) {
      throw new StockError(`Product not found: ${productId}`);
    }
    if (!isPublishedProduct(product)) {
      throw new StockError(`"${product.name}" is no longer available`);
    }
    const override = Number(item?.price);
    const unitPrice = Number.isFinite(override) && override >= 0
      ? Math.round(override)
      : currentSalePrice(product);
    normalized.push({
      product_id: productId,
      name: String(product.name || item.name || 'Item').trim(),
      qty,
      price: unitPrice,
      cost_price: Math.max(0, Number(product.cost_price) || 0),
    });
  }
  return normalized;
}

function normalizeOrderDiscount(input = {}, subtotal = 0) {
  const type = String(input.discount_type || 'fixed').trim().toLowerCase() === 'percent' ? 'percent' : 'fixed';
  let percent = Number(input.discount_percent);
  let amount = Number(input.discount_amount);

  if (type === 'percent') {
    percent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
    amount = Math.round((subtotal * percent) / 100);
  } else {
    percent = subtotal > 0 && Number.isFinite(amount) ? (amount / subtotal) * 100 : 0;
  }

  amount = Number.isFinite(amount) ? Math.max(0, Math.min(Math.round(amount), Math.round(subtotal))) : 0;
  percent = amount > 0 && subtotal > 0
    ? Number(((amount / subtotal) * 100).toFixed(2))
    : 0;

  return {
    discount_type: amount > 0 ? type : 'fixed',
    discount_amount: amount,
    discount_percent: type === 'percent' ? percent : null,
  };
}

function isReturnOrder(order) {
  return order?.source === 'counter_return' || order?.transaction_type === 'return';
}

function isCounterOrder(order) {
  return order?.source === 'counter_sale' || order?.source === 'counter_return';
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

function summarizeOrderFinancials(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const sign = isReturnOrder(order) ? -1 : 1;
  const gross = orderItemsSubtotal(items);
  const sale_total = Number.isFinite(Number(order?.total_amount))
    ? Number(order.total_amount)
    : gross * sign;
  const cost_total = items.reduce(
    (sum, i) => sum + Number(i.cost_price || 0) * Number(i.qty || 1),
    0
  ) * sign;
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
    const totals = summarizeOrderFinancials(order);
    const sign = isReturnOrder(order) ? -1 : 1;
    const gross = orderItemsSubtotal(items);
    const net = Number(totals.sale_total) || 0;
    const lineScale = gross > 0 ? net / gross : sign;
    const discountAmount = Math.max(0, Number(order.discount_amount) || 0);
    return {
      id: order.id,
      order_id: order.order_id,
      customer_name: order.customer_name,
      phone: order.phone,
      created_at: order.created_at,
      shipping_status: order.shipping_status,
      source: order.source || 'online',
      transaction_type: order.transaction_type || (isReturnOrder(order) ? 'return' : 'sale'),
      original_order_id: order.original_order_id ?? null,
      original_order_ref: order.original_order_ref || '',
      refund_method: order.refund_method || '',
      subtotal: Number.isFinite(Number(order.subtotal)) ? Number(order.subtotal) : gross * sign,
      discount_amount: discountAmount,
      discount_type: order.discount_type || 'fixed',
      discount_percent: order.discount_percent ?? null,
      net_total: net,
      items: items.map((i) => ({
        name: i.name,
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0,
        cost_price: Number(i.cost_price) || 0,
        sale_line: Math.round(Number(i.price || 0) * Number(i.qty || 1) * lineScale),
        cost_line: Number(i.cost_price || 0) * Number(i.qty || 1) * sign,
      })),
      ...totals,
    };
  });

  const summary = rows.reduce(
    (acc, row) => ({
      order_count: acc.order_count + 1,
      subtotal: acc.subtotal + (Number(row.subtotal) || 0),
      discount_amount: acc.discount_amount + (Number(row.discount_amount) || 0),
      sale_total: acc.sale_total + row.sale_total,
      net_total: acc.net_total + row.net_total,
      cost_total: acc.cost_total + row.cost_total,
      profit: acc.profit + row.profit,
    }),
    { order_count: 0, subtotal: 0, discount_amount: 0, sale_total: 0, net_total: 0, cost_total: 0, profit: 0 }
  );

  const topProductsMap = new Map();
  const dailyMap = new Map();

  for (const row of rows) {
    const dayKey = String(row.created_at || '').slice(0, 10);
    if (dayKey) {
      const dayRow = dailyMap.get(dayKey) || {
        date: dayKey,
        order_count: 0,
        sale_total: 0,
        profit: 0,
      };
      dayRow.order_count += 1;
      dayRow.sale_total += row.sale_total;
      dayRow.profit += row.profit;
      dailyMap.set(dayKey, dayRow);
    }

    for (const item of row.items || []) {
      const key = String(item.name || 'Unknown').trim();
      const lineSale = Number(item.sale_line) || 0;
      const lineQty = (Number(item.qty) || 1) * (row.transaction_type === 'return' ? -1 : 1);
      const existing = topProductsMap.get(key) || {
        name: key,
        qty: 0,
        revenue: 0,
        profit: 0,
      };
      existing.qty += lineQty;
      existing.revenue += lineSale;
      existing.profit += lineSale - (Number(item.cost_line) || 0);
      topProductsMap.set(key, existing);
    }
  }

  const top_products = [...topProductsMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const daily_chart = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    period,
    range: {
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      label: range.label,
    },
    summary,
    top_products,
    daily_chart,
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

const MAX_REPAIR_PHOTOS = 4;

function normalizePhotoUrls(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, MAX_REPAIR_PHOTOS);
}

/** Customer-safe repair view — no internal staff notes or activity log. */
export function sanitizePublicBooking(booking, services = []) {
  const enriched = enrichBooking(booking, services);
  return {
    id: enriched.id,
    booking_ref: enriched.booking_ref,
    customer_name: enriched.customer_name,
    device_brand: enriched.device_brand,
    device_model: enriched.device_model,
    issue: enriched.issue,
    estimated_repair_time: enriched.estimated_repair_time || '',
    estimated_cost: enriched.estimated_cost ?? null,
    status: enriched.status,
    status_history: enriched.status_history || [],
    photos_before: enriched.photos_before || [],
    photos_after: enriched.photos_after || [],
    created_at: enriched.created_at,
    updated_at: enriched.updated_at,
    service_name: enriched.service_name,
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
      estimated_cost: input.estimated_cost != null ? Number(input.estimated_cost) : null,
      photos_before: normalizePhotoUrls(input.photos_before),
      photos_after: normalizePhotoUrls(input.photos_after),
      customer_user_id: input.customer_user_id != null ? Number(input.customer_user_id) : null,
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
    return enrichBooking(data.repair_bookings[index], data.repair_services);
  });
}

export function updateBookingEstimatedCost(id, estimated_cost, staffUser = null) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.repair_bookings.findIndex((b) => b.id === numId);
    if (index === -1) return null;

    const existing = data.repair_bookings[index];
    const at = now();
    let cost = null;
    if (estimated_cost != null && estimated_cost !== '') {
      const n = Number(estimated_cost);
      if (!Number.isFinite(n) || n < 0 || n > 9_999_999) {
        throw new Error('Estimated cost must be between 0 and 9,999,999');
      }
      cost = Math.round(n);
    }

    const activity_log = [...(existing.activity_log || [])];
    if (staffUser?.username) {
      activity_log.push({
        at,
        message: cost != null
          ? `Estimated cost set to PKR ${cost.toLocaleString('en-PK')} by Staff: ${staffUser.username}`
          : `Estimated cost cleared by Staff: ${staffUser.username}`,
        by: staffUser.id,
      });
    }

    data.repair_bookings[index] = {
      ...existing,
      estimated_cost: cost,
      activity_log,
      updated_at: at,
    };
    return enrichBooking(data.repair_bookings[index], data.repair_services);
  });
}

export function updateBookingPhotos(id, { photos_before, photos_after }, staffUser = null) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.repair_bookings.findIndex((b) => b.id === numId);
    if (index === -1) return null;

    const existing = data.repair_bookings[index];
    const at = now();
    const next = { ...existing, updated_at: at };
    const activity_log = [...(existing.activity_log || [])];

    if (photos_before !== undefined) {
      next.photos_before = normalizePhotoUrls(photos_before);
      if (staffUser?.username) {
        activity_log.push({
          at,
          message: `Before photos updated (${next.photos_before.length}) by Staff: ${staffUser.username}`,
          by: staffUser.id,
        });
      }
    }
    if (photos_after !== undefined) {
      next.photos_after = normalizePhotoUrls(photos_after);
      if (staffUser?.username) {
        activity_log.push({
          at,
          message: `After photos updated (${next.photos_after.length}) by Staff: ${staffUser.username}`,
          by: staffUser.id,
        });
      }
    }

    next.activity_log = activity_log;
    data.repair_bookings[index] = next;
    return enrichBooking(data.repair_bookings[index], data.repair_services);
  });
}

export function trackRepairBooking(bookingRef, phone) {
  const data = readData();
  const phoneKey = normalizePhone(phone);
  const requirePhone = Boolean(phoneKey);

  const booking = data.repair_bookings.find((b) => {
    if (!repairMatchesTrackRef(b, bookingRef)) return false;
    if (!requirePhone) return true;
    return (
      normalizePhone(b.phone) === phoneKey ||
      (b.alternative_contact && normalizePhone(b.alternative_contact) === phoneKey)
    );
  });

  if (!booking) return null;
  return sanitizePublicBooking(booking, data.repair_services);
}

export function getRepairBookingsForCustomer({ userId, phone }) {
  const data = readData();
  const phoneKey = normalizePhone(phone);
  const uid = userId != null ? Number(userId) : null;

  return [...data.repair_bookings]
    .filter((b) => {
      if (uid && b.customer_user_id === uid) return true;
      if (phoneKey && normalizePhone(b.phone) === phoneKey) return true;
      if (phoneKey && b.alternative_contact && normalizePhone(b.alternative_contact) === phoneKey) {
        return true;
      }
      return false;
    })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((b) => ({
      ...sanitizePublicBooking(b, data.repair_services),
      unread_repair_messages: getUnreadRepairMessageCountByBooking(b.id, 'customer'),
    }));
}

export function addStaffNoteToBooking(id, noteText, staffUser) {
  return withData((data) => {
    const numId = Number(id);
    const index = data.repair_bookings.findIndex((b) => b.id === numId);
    if (index === -1) return null;

    const existing = data.repair_bookings[index];
    const text = String(noteText || '').trim().slice(0, 2000);
    if (!text) return null;

    const at = now();
    const notes = [...(existing.staff_notes || [])];
    notes.push({
      id: notes.length + 1,
      text,
      at,
      by: staffUser?.id ?? null,
      by_name: staffUser?.name || staffUser?.username || 'Staff',
    });

    data.repair_bookings[index] = {
      ...existing,
      staff_notes: notes,
      updated_at: at,
    };
    return enrichBooking(data.repair_bookings[index], data.repair_services);
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

export function updateContactMessage(id, input = {}) {
  return withData((data) => {
    const index = data.contact_messages.findIndex((m) => m.id === Number(id));
    if (index === -1) return null;
    const existing = data.contact_messages[index];
    const next = { ...existing };
    if (input.message != null) {
      next.message = String(input.message).trim().slice(0, 2000);
    }
    if (input.staff_reply != null) {
      const reply = String(input.staff_reply).trim();
      next.staff_reply = reply;
      next.replied_at = reply ? now() : null;
    }
    data.contact_messages[index] = next;
    return next;
  });
}

export function deleteContactMessage(id) {
  return withData((data) => {
    const numId = Number(id);
    const before = data.contact_messages.length;
    data.contact_messages = data.contact_messages.filter((m) => m.id !== numId);
    return before !== data.contact_messages.length;
  });
}

const MAX_REPAIR_MESSAGE_LEN = 2000;

function sanitizeRepairMessageText(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, MAX_REPAIR_MESSAGE_LEN);
}

export function getRepairBookingById(id) {
  const data = readData();
  const numId = Number(id);
  const booking = data.repair_bookings.find((b) => b.id === numId);
  if (!booking) return null;
  return enrichBooking(booking, data.repair_services);
}

export function customerOwnsRepairBooking(booking, user) {
  if (!booking || !user) return false;
  const uid = Number(user.id);
  if (booking.customer_user_id != null && Number(booking.customer_user_id) === uid) return true;
  const userPhone = normalizePhone(user.phone);
  const bookingPhone = normalizePhone(booking.phone);
  return Boolean(userPhone && bookingPhone && userPhone === bookingPhone);
}

export function createRepairMessage(input) {
  return withData((data) => {
    const bookingId = Number(input.repair_booking_id);
    const booking = data.repair_bookings.find((b) => b.id === bookingId);
    if (!booking) return null;

    const body = sanitizeRepairMessageText(input.text);
    if (!body) return null;

    const sender = input.sender === 'staff' ? 'staff' : 'customer';
    const id = data.meta.nextRepairMessageId++;
    const created_at = now();
    const message = {
      id,
      repair_booking_id: bookingId,
      sender,
      sender_name: String(input.sender_name || '').trim().slice(0, 120),
      text: body,
      created_at,
      read_by_customer: sender === 'customer',
      read_by_staff: sender === 'staff',
    };
    if (!data.repair_messages) data.repair_messages = [];
    data.repair_messages.push(message);
    return message;
  });
}

export function getRepairMessagesByBookingId(bookingId) {
  const numId = Number(bookingId);
  return [...(readData().repair_messages || [])]
    .filter((m) => m.repair_booking_id === numId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export function markRepairMessagesRead(bookingId, role) {
  return withData((data) => {
    const numId = Number(bookingId);
    const field = role === 'staff' ? 'read_by_staff' : 'read_by_customer';
    for (const msg of data.repair_messages || []) {
      if (msg.repair_booking_id !== numId) continue;
      const shouldMark =
        role === 'staff'
          ? msg.sender === 'customer' && !msg.read_by_staff
          : msg.sender === 'staff' && !msg.read_by_customer;
      if (shouldMark) msg[field] = true;
    }
  });
}

export function countUnreadRepairMessagesForStaff() {
  return (readData().repair_messages || []).filter(
    (m) => m.sender === 'customer' && !m.read_by_staff
  ).length;
}

export function countUnreadRepairMessagesForCustomer(userId, phone) {
  const phoneKey = normalizePhone(phone);
  const uid = userId != null ? Number(userId) : null;
  const data = readData();
  const ownedBookingIds = new Set(
    data.repair_bookings
      .filter((b) => {
        if (uid && b.customer_user_id === uid) return true;
        if (phoneKey && normalizePhone(b.phone) === phoneKey) return true;
        return false;
      })
      .map((b) => b.id)
  );
  return (data.repair_messages || []).filter(
    (m) => ownedBookingIds.has(m.repair_booking_id) && m.sender === 'staff' && !m.read_by_customer
  ).length;
}

export function getUnreadRepairMessageCountByBooking(bookingId, forRole) {
  const numId = Number(bookingId);
  return (readData().repair_messages || []).filter((m) => {
    if (m.repair_booking_id !== numId) return false;
    if (forRole === 'staff') return m.sender === 'customer' && !m.read_by_staff;
    return m.sender === 'staff' && !m.read_by_customer;
  }).length;
}

export function getRepairChatsSummaryForStaff() {
  const data = readData();
  const byBooking = new Map();
  for (const msg of data.repair_messages || []) {
    const bid = msg.repair_booking_id;
    if (!byBooking.has(bid)) {
      byBooking.set(bid, { lastMessage: msg, unread: 0 });
    } else {
      const entry = byBooking.get(bid);
      if (String(msg.created_at) > String(entry.lastMessage.created_at)) {
        entry.lastMessage = msg;
      }
    }
    if (msg.sender === 'customer' && !msg.read_by_staff) {
      byBooking.get(bid).unread += 1;
    }
  }
  return [...byBooking.entries()]
    .map(([bookingId, { lastMessage, unread }]) => {
      const booking = data.repair_bookings.find((b) => b.id === bookingId);
      return {
        booking_id: bookingId,
        booking_ref: booking?.booking_ref || formatBookingRef(bookingId),
        customer_name: booking?.customer_name || '',
        device: booking ? `${booking.device_brand} ${booking.device_model}`.trim() : '',
        last_message: lastMessage,
        unread,
        updated_at: lastMessage.created_at,
      };
    })
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export function getCounterTodayStats({ user = null, date = new Date() } = {}) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const orders = (readData().orders || []).filter((order) => {
    if (!isCounterOrder(order) || order.shipping_status === 'cancelled') return false;
    if (
      user?.role === 'counter'
      && String(order.created_by_staff_id || '') !== String(user.id)
    ) {
      return false;
    }
    const created = new Date(order.created_at);
    return created >= dayStart && created <= dayEnd;
  });

  return orders.reduce((stats, order) => {
    const isReturn = isReturnOrder(order);
    if (order.source === 'counter_sale') stats.bills_today += 1;
    stats.today_sales += Number(order.total_amount || 0);
    for (const item of order.items || []) {
      const qty = Number(item.qty) || 0;
      stats.items_sold_today += isReturn ? -qty : qty;
    }
    return stats;
  }, {
    today_sales: 0,
    bills_today: 0,
    items_sold_today: 0,
  });
}

export function listCounterDrafts({ user = null } = {}) {
  let drafts = [...(readData().counter_drafts || [])].filter((draft) => draft.status !== 'converted');
  if (user?.role === 'counter') {
    drafts = drafts.filter((draft) => String(draft.created_by_staff_id || '') === String(user.id));
  }
  return drafts.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export function getCounterDraft(id, { user = null } = {}) {
  const draft = (readData().counter_drafts || []).find((entry) => Number(entry.id) === Number(id));
  if (!draft || draft.status === 'converted') return null;
  if (user?.role === 'counter' && String(draft.created_by_staff_id || '') !== String(user.id)) return null;
  return draft;
}

export function createCounterDraft(input = {}) {
  return withData((data) => {
    if (!Array.isArray(data.counter_drafts)) data.counter_drafts = [];
    if (!data.meta.nextCounterDraftId) data.meta.nextCounterDraftId = 1;

    const items = prepareCounterDraftItems(Array.isArray(input.items) ? input.items : [], data.products);
    if (!items.length || items.length > 20) {
      throw new StockError('Draft must include 1-20 items');
    }

    const subtotal = orderItemsSubtotal(items);
    const discount = normalizeOrderDiscount(input, subtotal);
    const total = Math.max(0, subtotal - discount.discount_amount);
    const staffActor = staffAuditUser(input.staff_user || {});
    const id = data.meta.nextCounterDraftId++;
    const createdAt = now();
    const draft = {
      id,
      draft_id: `DRAFT-${1000 + Number(id)}`,
      customer_name: String(input.customer_name || '').trim().slice(0, 120) || 'Walk-in Customer',
      phone: String(input.phone || '').trim().slice(0, 30),
      payment_mode: String(input.payment_mode || 'cash').trim().toLowerCase(),
      payment_note: String(input.payment_note || '').trim().slice(0, 500),
      items,
      subtotal,
      discount_amount: discount.discount_amount,
      discount_type: discount.discount_type,
      discount_percent: discount.discount_percent,
      grand_total: total,
      total_amount: total,
      status: 'open',
      created_by_staff_id: staffActor.id ?? input.staff_user_id ?? null,
      created_by_staff_name: staffActor.name || '',
      updated_at: createdAt,
      created_at: createdAt,
    };
    data.counter_drafts.unshift(draft);
    data.counter_drafts = data.counter_drafts.slice(0, 100);
    return draft;
  });
}

export function deleteCounterDraft(id, { user = null, convertedOrderId = null } = {}) {
  return withData((data) => {
    if (!Array.isArray(data.counter_drafts)) data.counter_drafts = [];
    const index = data.counter_drafts.findIndex((entry) => Number(entry.id) === Number(id));
    if (index === -1) return null;
    const draft = data.counter_drafts[index];
    if (user?.role === 'counter' && String(draft.created_by_staff_id || '') !== String(user.id)) return null;
    if (convertedOrderId != null) {
      data.counter_drafts[index] = {
        ...draft,
        status: 'converted',
        converted_order_id: Number(convertedOrderId),
        updated_at: now(),
      };
      return data.counter_drafts[index];
    }
    data.counter_drafts.splice(index, 1);
    return draft;
  });
}

export function createOrder(input) {
  return withData((data) => {
    const rawItems = Array.isArray(input.items) ? input.items : [];
    const items = prepareOrderItems(rawItems, data.products);
    deductOrderStock(data.products, items);

    const id = data.meta.nextOrderId++;
    const subtotal = orderItemsSubtotal(items);
    const discount = normalizeOrderDiscount(input, subtotal);
    const total = Math.max(0, subtotal - discount.discount_amount);
    const createdAt = now();
    const shippingStatus = input.shipping_status || 'pending';
    const paymentStatus = input.payment_status || 'pending_payment';
    const deliveryStatus = input.delivery_status ?? null;
    const staffActor = staffAuditUser(input.staff_user || {});
    const activityLog = input.activity_message
      ? [{
          at: createdAt,
          message: String(input.activity_message).trim().slice(0, 240),
          by: staffActor.id ?? input.staff_user_id ?? null,
        }]
      : [];
    const order = {
      id,
      order_id: formatOrderId(id),
      customer_name: input.customer_name,
      phone: input.phone,
      city: input.city || '',
      payment_mode: input.payment_mode || 'jazzcash',
      fulfillment_method: input.fulfillment_method === 'pickup' ? 'pickup' : 'delivery',
      items,
      subtotal,
      discount_amount: discount.discount_amount,
      discount_type: discount.discount_type,
      discount_percent: discount.discount_percent,
      grand_total: total,
      total_amount: total,
      shipping_status: shippingStatus,
      payment_status: paymentStatus,
      delivery_status: deliveryStatus,
      rider_phone: '',
      delivery_charge: 0,
      shipping_address: input.shipping_address || null,
      payment_proof_url: null,
      gmail: '',
      notes: input.notes || '',
      customer_user_id: input.customer_user_id ?? null,
      source: input.source || 'online',
      transaction_type: input.transaction_type || 'sale',
      created_by_staff_id: staffActor.id ?? input.staff_user_id ?? null,
      created_by_staff_name: staffActor.name || '',
      stock_deducted: true,
      status_history: [{ status: shippingStatus, at: createdAt, by: staffActor.id ?? input.staff_user_id ?? null }],
      activity_log: activityLog,
      updated_at: createdAt,
      created_at: createdAt,
    };
    data.orders.push(order);
    if (input.source === 'counter_sale') {
      appendAuditLog(data, 'bill_create', {
        actor: input.staff_user,
        entity_type: 'order',
        entity_id: order.id,
        summary: `Counter bill ${order.order_id} created for ${order.total_amount}`,
        details: {
          order_id: order.id,
          order_ref: order.order_id,
          total_amount: order.total_amount,
          subtotal: order.subtotal,
          discount_amount: order.discount_amount,
          discount_type: order.discount_type,
          discount_percent: order.discount_percent,
          payment_mode: order.payment_mode,
          customer_name: order.customer_name,
          items: order.items.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            qty: item.qty,
            price: item.price,
          })),
        },
      });
      if (order.discount_amount > 0 && input.discount_override_required) {
        appendAuditLog(data, 'large_discount', {
          actor: input.discount_override_user || input.staff_user,
          entity_type: 'order',
          entity_id: order.id,
          summary: `Large POS discount ${order.discount_amount} approved for ${order.order_id}`,
          details: {
            order_id: order.id,
            order_ref: order.order_id,
            subtotal: order.subtotal,
            discount_amount: order.discount_amount,
            discount_type: order.discount_type,
            discount_percent: order.discount_percent,
            created_by: staffAuditUser(input.staff_user || {}),
          },
        });
      }
    }
    return order;
  });
}

export function createCounterReturn(input) {
  return withData((data) => {
    const key = String(input.original_order_id || '').trim().toUpperCase();
    const original = data.orders.find((order) => (
      (order.source || 'online') === 'counter_sale'
      && (String(order.id) === key || String(order.order_id || '').trim().toUpperCase() === key)
    ));
    if (!original) {
      throw new StockError('Original counter sale not found');
    }

    const alreadyReturned = new Map();
    for (const order of data.orders) {
      if (!isReturnOrder(order) || Number(order.original_order_id) !== Number(original.id)) continue;
      for (const item of order.items || []) {
        const productId = Number(item.product_id);
        alreadyReturned.set(productId, (alreadyReturned.get(productId) || 0) + (Number(item.qty) || 0));
      }
    }

    const requested = Array.isArray(input.items) ? input.items : [];
    if (!requested.length || requested.length > 20) {
      throw new StockError('Return must include at least one item');
    }

    const returnItems = [];
    for (const raw of requested) {
      const productId = Number(raw?.product_id);
      const qty = Number(raw?.qty);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(qty) || qty <= 0 || qty > 99) {
        throw new StockError('Invalid return item quantity');
      }
      const sold = (original.items || []).find((item) => Number(item.product_id) === productId);
      if (!sold) throw new StockError('Return item was not on the original bill');
      const soldQty = Number(sold.qty) || 0;
      const remaining = soldQty - (alreadyReturned.get(productId) || 0);
      if (qty > remaining) {
        throw new StockError(`Cannot return more than remaining quantity for "${sold.name}"`, {
          product_id: productId,
          sold: soldQty,
          already_returned: alreadyReturned.get(productId) || 0,
          remaining,
          requested: qty,
        });
      }
      returnItems.push({
        product_id: productId,
        name: String(sold.name || 'Item').trim(),
        qty,
        price: Number(sold.price) || 0,
        cost_price: Math.max(0, Number(sold.cost_price) || 0),
      });
    }

    for (const item of returnItems) {
      const index = data.products.findIndex((product) => Number(product.id) === Number(item.product_id));
      if (index >= 0) {
        data.products[index].stock = Math.max(0, Number(data.products[index].stock || 0) + item.qty);
        data.products[index].sale_count = Math.max(0, Number(data.products[index].sale_count || 0) - item.qty);
      }
    }

    const id = data.meta.nextOrderId++;
    const createdAt = now();
    const staffActor = staffAuditUser(input.staff_user || {});
    const overrideActor = input.override_user ? staffAuditUser(input.override_user) : null;
    const subtotal = orderItemsSubtotal(returnItems);
    const refundMethod = ['cash', 'store_credit'].includes(String(input.refund_method || '').trim().toLowerCase())
      ? String(input.refund_method).trim().toLowerCase()
      : 'cash';
    const reason = String(input.reason || '').trim().slice(0, 500);
    const order = {
      id,
      order_id: formatOrderId(id),
      customer_name: original.customer_name || 'Walk-in Customer',
      phone: original.phone || '',
      city: original.city || '',
      payment_mode: refundMethod,
      fulfillment_method: original.fulfillment_method || 'pickup',
      items: returnItems,
      subtotal: -subtotal,
      discount_amount: 0,
      discount_type: 'fixed',
      discount_percent: null,
      grand_total: -subtotal,
      total_amount: -subtotal,
      return_amount: subtotal,
      refund_method: refundMethod,
      return_reason: reason,
      original_order_id: original.id,
      original_order_ref: original.order_id,
      transaction_type: 'return',
      shipping_status: 'returned',
      payment_status: 'refunded',
      delivery_status: 'returned',
      rider_phone: '',
      delivery_charge: 0,
      shipping_address: original.shipping_address || null,
      payment_proof_url: null,
      gmail: '',
      notes: reason ? `POS return: ${reason}` : 'POS return',
      customer_user_id: original.customer_user_id ?? null,
      source: 'counter_return',
      created_by_staff_id: staffActor.id ?? input.staff_user_id ?? null,
      created_by_staff_name: staffActor.name || '',
      stock_deducted: false,
      status_history: [{ status: 'returned', at: createdAt, by: staffActor.id ?? input.staff_user_id ?? null }],
      activity_log: [{
        at: createdAt,
        message: `POS return for ${original.order_id}${overrideActor ? ` approved by ${overrideActor.name}` : ''}`,
        by: staffActor.id ?? input.staff_user_id ?? null,
      }],
      updated_at: createdAt,
      created_at: createdAt,
    };

    data.orders.push(order);
    appendAuditLog(data, 'bill_return', {
      actor: input.staff_user,
      entity_type: 'order',
      entity_id: order.id,
      summary: `POS return ${order.order_id} linked to ${original.order_id} for ${subtotal}`,
      details: {
        return_order_id: order.id,
        return_order_ref: order.order_id,
        original_order_id: original.id,
        original_order_ref: original.order_id,
        refund_method: refundMethod,
        reason,
        return_amount: subtotal,
        override: overrideActor,
        items: returnItems.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          qty: item.qty,
          price: item.price,
        })),
      },
    });

    return order;
  });
}

export function getOrders() {
  return [...readData().orders].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );
}

function customerSummaryKey(order) {
  const email = String(order.gmail || '').trim().toLowerCase();
  const phone = normalizePhone(order.phone);
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  const name = String(order.customer_name || '').trim().toLowerCase();
  if (name) return `name:${name}`;
  return null;
}

/** Aggregate unique customers from order history (not auth accounts). */
export function getCustomerSummaries() {
  const byKey = new Map();
  const ordersByKey = new Map();

  for (const order of getOrders()) {
    const key = customerSummaryKey(order);
    if (!key) continue;

    const email = String(order.gmail || '').trim().toLowerCase();
    const existing = byKey.get(key) || {
      id: key,
      name: '',
      email: '',
      phone: '',
      order_count: 0,
      last_order_at: null,
      total_spent: 0,
    };

    if (!existing.name && order.customer_name) existing.name = order.customer_name;
    if (!existing.email && email) existing.email = email;
    if (!existing.phone && order.phone) existing.phone = order.phone;

    existing.order_count += 1;

    const created = order.created_at || null;
    if (created && (!existing.last_order_at || String(created) > String(existing.last_order_at))) {
      existing.last_order_at = created;
    }

    if (order.shipping_status !== 'cancelled') {
      existing.total_spent += Number(order.total_amount) || 0;
    }

    byKey.set(key, existing);

    if (!ordersByKey.has(key)) ordersByKey.set(key, []);
    ordersByKey.get(key).push({
      id: order.id,
      order_id: order.order_id,
      created_at: order.created_at,
      total_amount: order.total_amount,
      shipping_status: order.shipping_status,
      item_count: Array.isArray(order.items) ? order.items.length : 0,
    });
  }

  return [...byKey.values()]
    .map((customer) => {
      const recent = (ordersByKey.get(customer.id) || [])
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, 8)
        .map(({ id, order_id, created_at, total_amount, shipping_status, item_count }) => ({
          id,
          order_id,
          created_at,
          total_amount,
          shipping_status,
          item_count,
        }));
      return { ...customer, recent_orders: recent };
    })
    .sort((a, b) => String(b.last_order_at || '').localeCompare(String(a.last_order_at || '')));
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
  const phoneKey = normalizePhone(phone);
  const requirePhone = Boolean(phoneKey);

  const order = data.orders.find((o) => {
    if (!orderMatchesTrackRef(o, orderId)) return false;
    // Phone is optional — when provided, it must still match
    if (!requirePhone) return true;
    return normalizePhone(o.phone) === phoneKey;
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
    payment_status: order.payment_status || 'pending_payment',
    delivery_status: order.delivery_status ?? null,
    rider_phone: order.rider_phone || '',
    delivery_charge: Number(order.delivery_charge) || 0,
    shipping_address: order.shipping_address || null,
    customer_status: orderCustomerStatus(order),
    status_history: order.status_history || [],
    customer_feedback: order.customer_feedback || null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

function orderItemProductIds(order) {
  return (order.items || [])
    .map((item) => Number(item.product_id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function resolveFeedbackProductId(order, fb = {}) {
  const stored = Number(fb.product_id);
  const itemIds = orderItemProductIds(order);
  if (Number.isFinite(stored) && stored > 0 && itemIds.includes(stored)) {
    return stored;
  }
  return itemIds[0] || null;
}

function feedbackProductSnapshot(order, data, fb = {}) {
  const productId = resolveFeedbackProductId(order, fb);
  if (!productId) {
    return { product_id: null, product_name: null, product_image: null, product_category: null };
  }
  const product = data.products.find((p) => p.id === productId);
  const item = (order.items || []).find((i) => Number(i.product_id) === productId);
  return {
    product_id: productId,
    product_name: product?.name || item?.name || null,
    product_image: product?.image || null,
    product_category: product?.category || null,
  };
}

export function submitOrderFeedback(orderId, phone, { rating, comment = '', product_id = null }) {
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

    const itemIds = orderItemProductIds(order);
    let linkedProductId = null;
    if (product_id != null && product_id !== '') {
      const requested = Number(product_id);
      if (!Number.isFinite(requested) || requested <= 0 || !itemIds.includes(requested)) {
        throw new Error('Please select a product from your order');
      }
      linkedProductId = requested;
    } else if (itemIds.length === 1) {
      linkedProductId = itemIds[0];
    } else if (itemIds.length > 1) {
      linkedProductId = itemIds[0];
    }

    order.customer_feedback = {
      rating: stars,
      comment: commentText,
      status: 'pending',
      product_id: linkedProductId,
      submitted_at: now(),
      updated_at: now(),
    };
    order.updated_at = now();
    return order;
  });
}

const VALID_FEEDBACK_STATUS = new Set(['pending', 'published', 'hidden']);

function feedbackRow(order, data) {
  const fb = order.customer_feedback;
  if (!fb?.rating) return null;
  const product = feedbackProductSnapshot(order, data, fb);
  return {
    order_id: order.id,
    order_ref: order.order_id || formatOrderId(order.id),
    customer_name: order.customer_name || 'Customer',
    city: order.city || '',
    rating: fb.rating,
    comment: fb.comment || '',
    status: fb.status || 'pending',
    submitted_at: fb.submitted_at || order.updated_at,
    updated_at: fb.updated_at || fb.submitted_at || order.updated_at,
    ...product,
  };
}

export function listOrderFeedback() {
  return withData((data) =>
    data.orders
      .map((order) => feedbackRow(order, data))
      .filter(Boolean)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
  );
}

export function getPublishedReviews(limit = 12, { productId } = {}) {
  const pid = productId != null && productId !== '' ? Number(productId) : null;
  return withData((data) =>
    data.orders
      .map((order) => feedbackRow(order, data))
      .filter((row) => {
        if (!row || row.status !== 'published') return false;
        if (pid != null && Number.isFinite(pid)) {
          return Number(row.product_id) === pid;
        }
        return true;
      })
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
      .slice(0, limit)
  );
}

/** Customer attaches JazzCash/EasyPaisa/bank transfer screenshot after order. */
export function setOrderPaymentProof(orderId, { url, customerUserId, phone }) {
  return withData((data) => {
    const id = Number(orderId);
    const order = data.orders.find((o) => o.id === id);
    if (!order) return null;

    const ownsByUser =
      customerUserId != null && Number(order.customer_user_id) === Number(customerUserId);
    const ownsByPhone =
      phone && normalizePhone(order.phone) === normalizePhone(phone);
    if (!ownsByUser && !ownsByPhone) {
      throw new Error('Not authorized to update this order');
    }

    const mode = String(order.payment_mode || '').toLowerCase();
    if (!['jazzcash', 'easypaisa', 'bank'].includes(mode)) {
      throw new Error('Payment proof is only for JazzCash, EasyPaisa, or bank transfer');
    }
    if (order.payment_status === 'paid') {
      throw new Error('Payment already verified');
    }

    const proofUrl = String(url || '').trim();
    if (!/^https:\/\//i.test(proofUrl) || proofUrl.length > 500) {
      throw new Error('Invalid payment proof URL');
    }

    order.payment_proof_url = proofUrl;
    order.payment_proof_at = now();
    order.updated_at = now();
    return order;
  });
}

export function updateOrderFeedback(orderId, patch, staffUser = null) {
  return withData((data) => {
    const id = Number(orderId);
    const order = data.orders.find((o) => o.id === id);
    if (!order?.customer_feedback?.rating) return null;

    const fb = order.customer_feedback;
    if (patch.comment != null) {
      fb.comment = String(patch.comment).trim().slice(0, 500);
    }
    if (patch.rating != null) {
      const stars = Number(patch.rating);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      fb.rating = stars;
    }
    if (patch.status != null) {
      const status = String(patch.status).trim().toLowerCase();
      if (!VALID_FEEDBACK_STATUS.has(status)) {
        throw new Error('Invalid review status');
      }
      fb.status = status;
    }
    fb.updated_at = now();
    if (staffUser?.id) {
      fb.updated_by = staffUser.id;
      fb.updated_by_name = staffUser.name || staffUser.username || 'Staff';
    }
    order.updated_at = now();
    return feedbackRow(order, data);
  });
}

export function deleteOrderFeedback(orderId) {
  return withData((data) => {
    const id = Number(orderId);
    const order = data.orders.find((o) => o.id === id);
    if (!order?.customer_feedback?.rating) return false;
    order.customer_feedback = null;
    order.updated_at = now();
    return true;
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

export function findUserByGoogleId(googleId) {
  const id = String(googleId || '').trim();
  if (!id) return null;
  return readData().users.find((u) => u.google_id === id) || null;
}

function uniqueCustomerUsername(data, email) {
  let base = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
  base = base.replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 26);
  if (base.length < 3) base = `user${Date.now()}`.slice(0, 26);
  let candidate = base;
  let n = 0;
  while (data.users.some((u) => u.username === candidate)) {
    n += 1;
    candidate = `${base.slice(0, 22)}_${n}`;
  }
  return candidate;
}

/**
 * Customer Google Sign-In: find by google_id, link existing customer email, or create.
 * Staff accounts with the same email are rejected (STAFF_ACCOUNT).
 */
export function findOrCreateGoogleCustomer({ googleId, email, name }) {
  return withData((data) => {
    const sub = String(googleId || '').trim();
    const emailKey = String(email || '').trim().toLowerCase();
    const displayName = String(name || '').trim() || emailKey.split('@')[0] || 'Customer';

    if (!sub || !emailKey) {
      throw new Error('Invalid Google account');
    }

    let user = data.users.find((u) => u.google_id === sub);
    if (user) {
      if (isUserBlocked(user)) throw new Error('BLOCKED');
      if (STAFF_ROLES.includes(user.role)) throw new Error('STAFF_ACCOUNT');
      return { user, created: false };
    }

    user = data.users.find((u) => u.email === emailKey);
    if (user) {
      if (STAFF_ROLES.includes(user.role)) throw new Error('STAFF_ACCOUNT');
      if (isUserBlocked(user)) throw new Error('BLOCKED');
      user.google_id = sub;
      if (!String(user.name || '').trim()) user.name = displayName;
      return { user, created: false };
    }

    const username = uniqueCustomerUsername(data, emailKey);
    const id = data.meta.nextUserId++;
    user = {
      id,
      name: displayName,
      email: emailKey,
      phone: '',
      username,
      google_id: sub,
      password_hash: hashPassword(createToken()),
      role: 'customer',
      active: true,
      blocked: false,
      created_at: now(),
      last_login: null,
      created_by: null,
      addresses: [],
    };
    data.users.push(user);
    return { user, created: true };
  });
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

export const STAFF_ROLES = ['super_admin', 'admin', 'editor', 'counter'];

export function listStaffUsers() {
  return readData()
    .users.filter((u) => STAFF_ROLES.includes(u.role))
    .map(({ password_hash, ...rest }) => rest)
    .sort((a, b) => a.id - b.id);
}

export function listCustomerUsers() {
  return readData()
    .users.filter((u) => u.role === 'customer')
    .map(({ password_hash, ...rest }) => rest)
    .sort((a, b) => a.id - b.id);
}

/** Demote known shop clients that were wrongly saved as staff (persists to Mongo). */
export function fixMisassignedShopClients() {
  const emails = ['bossp0926@gmail.com', 'bintenaeem398@gmail.com'];
  let fixed = 0;
  for (const email of emails) {
    const user = readData().users.find((u) => String(u.email || '').toLowerCase() === email);
    if (user && ['admin', 'editor'].includes(user.role)) {
      updateUser(user.id, { role: 'customer' });
      fixed += 1;
    }
  }
  return fixed;
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
      addresses: [],
    };
    data.users.push(user);
    return user;
  });
}

export function getOrdersByCustomerId(customerId) {
  const user = getUserById(customerId);
  if (!user) return [];
  return getOrdersForCustomer(user);
}

/** Orders linked to account by user id, phone, or saved Gmail. */
export function getOrdersForCustomer(user) {
  if (!user) return [];
  const id = Number(user.id);
  const userPhone = normalizePhone(user.phone);
  const userEmail = String(user.email || '').trim().toLowerCase();
  const seen = new Set();
  const matched = [];

  for (const order of getOrders()) {
    const byId = Number(order.customer_user_id) === id;
    const byPhone = userPhone && normalizePhone(order.phone) === userPhone;
    const byEmail = userEmail && String(order.gmail || '').trim().toLowerCase() === userEmail;
    if (!byId && !byPhone && !byEmail) continue;
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    matched.push(order);
  }

  return matched.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
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
    if (patch.role != null) {
      const wasStaff = STAFF_ROLES.includes(user.role);
      user.role = patch.role;
      if (wasStaff && user.role === 'customer') {
        data.sessions = data.sessions.filter((s) => s.user_id !== user.id);
      }
    }
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

/* ── Customer delivery addresses ── */

function findCustomerUser(data, userId) {
  const user = data.users.find((u) => u.id === Number(userId));
  if (!user || user.role !== 'customer') return null;
  if (!Array.isArray(user.addresses)) user.addresses = [];
  return user;
}

export function getCustomerAddresses(userId) {
  const data = readData();
  const user = findCustomerUser(data, userId);
  if (!user) return [];
  return [...user.addresses].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function addCustomerAddress(userId, input) {
  return withData((data) => {
    const user = findCustomerUser(data, userId);
    if (!user) return null;

    const address = validateShippingAddress(input);
    const id = data.meta.nextAddressId++;
    const createdAt = now();
    const entry = {
      id,
      ...address,
      is_default: Boolean(input.is_default),
      created_at: createdAt,
      updated_at: createdAt,
    };

    if (entry.is_default || user.addresses.length === 0) {
      for (const a of user.addresses) a.is_default = false;
      entry.is_default = true;
    }

    user.addresses.push(entry);
    return entry;
  });
}

export function updateCustomerAddress(userId, addressId, input) {
  return withData((data) => {
    const user = findCustomerUser(data, userId);
    if (!user) return null;

    const index = user.addresses.findIndex((a) => a.id === Number(addressId));
    if (index === -1) return null;

    const existing = user.addresses[index];
    const patch = validateShippingAddress({
      name: input.name ?? existing.name,
      fullName: input.fullName ?? existing.fullName ?? existing.name,
      phone: input.phone ?? existing.phone,
      text: input.text ?? existing.text,
      country: input.country ?? existing.country,
      region: input.region ?? input.province ?? input.state ?? existing.region,
      city: input.city ?? existing.city,
      postalCode: input.postalCode ?? input.zip ?? input.zipCode ?? existing.postalCode,
      streetAddress: input.streetAddress ?? existing.streetAddress ?? existing.text,
      houseNumber: input.houseNumber ?? input.building ?? input.unit ?? existing.houseNumber,
      landmark: input.landmark ?? existing.landmark,
      notes: input.notes ?? existing.notes,
      lat: input.lat ?? existing.lat,
      lng: input.lng ?? existing.lng,
    });

    const updated = {
      ...existing,
      ...patch,
      is_default: input.is_default != null ? Boolean(input.is_default) : existing.is_default,
      updated_at: now(),
    };

    if (updated.is_default) {
      for (const a of user.addresses) a.is_default = false;
      updated.is_default = true;
    }

    user.addresses[index] = updated;
    return updated;
  });
}

export function deleteCustomerAddress(userId, addressId) {
  return withData((data) => {
    const user = findCustomerUser(data, userId);
    if (!user) return false;

    const before = user.addresses.length;
    const removed = user.addresses.find((a) => a.id === Number(addressId));
    user.addresses = user.addresses.filter((a) => a.id !== Number(addressId));
    if (user.addresses.length === before) return false;

    if (removed?.is_default && user.addresses.length > 0) {
      user.addresses[0].is_default = true;
    }
    return true;
  });
}

export function resolveCustomerAddress(userId, addressId) {
  const data = readData();
  const user = findCustomerUser(data, userId);
  if (!user) return null;
  const addr = user.addresses.find((a) => a.id === Number(addressId));
  if (!addr) return null;
  const {
    name,
    fullName,
    phone,
    country,
    region,
    city,
    postalCode,
    streetAddress,
    houseNumber,
    landmark,
    notes,
    text,
    lat,
    lng,
  } = validateShippingAddress(addr);
  return {
    name,
    fullName,
    phone,
    country,
    region,
    city,
    postalCode,
    streetAddress,
    houseNumber,
    landmark,
    notes,
    text,
    lat,
    lng,
  };
}

function appendOrderActivity(order, message, updatedBy, at) {
  const activity_log = [...(order.activity_log || [])];
  if (message) {
    activity_log.push({
      at,
      message,
      by: updatedBy?.id ?? null,
    });
  }
  return activity_log;
}

export function markOrderPaid(id, updatedBy = null) {
  return withData((data) => {
    const index = data.orders.findIndex((o) => o.id === Number(id));
    if (index === -1) return null;

    const existing = data.orders[index];
    if (existing.payment_status === 'paid') return existing;
    if (existing.shipping_status === 'cancelled') {
      throw new Error('Cannot mark a cancelled order as paid');
    }

    const at = now();
    const history = [
      ...(existing.status_history || []),
      { status: 'payment_verified', at, by: updatedBy?.id ?? null },
    ];
    const activity_log = appendOrderActivity(
      existing,
      updatedBy?.username
        ? `Payment marked as paid by Staff: ${updatedBy.username}`
        : 'Payment marked as paid',
      updatedBy,
      at
    );

    data.orders[index] = {
      ...existing,
      payment_status: 'paid',
      delivery_status: 'waiting_for_rider',
      shipping_status: 'payment_verified',
      status_history: history,
      activity_log,
      updated_at: at,
    };
    return data.orders[index];
  });
}

export function assignOrderRider(id, { rider_phone, delivery_charge }, updatedBy = null) {
  return withData((data) => {
    const index = data.orders.findIndex((o) => o.id === Number(id));
    if (index === -1) return null;

    const existing = data.orders[index];
    if (existing.payment_status !== 'paid') {
      throw new Error('Order must be paid before assigning a rider');
    }
    if (existing.delivery_status === 'delivered') {
      throw new Error('Order is already delivered');
    }

    const phone = String(rider_phone || '').trim().slice(0, 30);
    const charge = Number(delivery_charge);
    if (!phone) throw new Error('Rider phone is required');
    if (!Number.isFinite(charge) || charge < 0) {
      throw new Error('Delivery charge must be a valid amount');
    }

    const at = now();
    const history = [
      ...(existing.status_history || []),
      { status: 'out_for_delivery', at, by: updatedBy?.id ?? null },
    ];
    const activity_log = appendOrderActivity(
      existing,
      updatedBy?.username
        ? `Rider assigned (${phone}, PKR ${charge}) by Staff: ${updatedBy.username}`
        : `Rider assigned (${phone})`,
      updatedBy,
      at
    );

    data.orders[index] = {
      ...existing,
      rider_phone: phone,
      delivery_charge: Math.round(charge),
      delivery_status: 'rider_assigned',
      shipping_status: 'out_for_delivery',
      status_history: history,
      activity_log,
      updated_at: at,
    };
    return data.orders[index];
  });
}

export function markOrderDelivered(id, updatedBy = null) {
  return withData((data) => {
    const index = data.orders.findIndex((o) => o.id === Number(id));
    if (index === -1) return null;

    const existing = data.orders[index];
    if (existing.delivery_status === 'delivered') return existing;

    const at = now();
    const history = [
      ...(existing.status_history || []),
      { status: 'delivered', at, by: updatedBy?.id ?? null },
    ];
    const activity_log = appendOrderActivity(
      existing,
      updatedBy?.username
        ? `Marked delivered by Staff: ${updatedBy.username}`
        : 'Marked delivered',
      updatedBy,
      at
    );

    data.orders[index] = {
      ...existing,
      delivery_status: 'delivered',
      shipping_status: 'delivered',
      status_history: history,
      activity_log,
      updated_at: at,
    };
    return data.orders[index];
  });
}

export { validateShippingAddress };

/* ── iPhone repair rates ── */

function normalizeRateModel(model) {
  return String(model || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getRepairRates(filters = {}) {
  let rates = readData().repair_rates.filter((r) => r.active !== false);
  if (filters.model) {
    const m = normalizeRateModel(filters.model);
    rates = rates.filter((r) => normalizeRateModel(r.model) === m);
  }
  if (filters.part_type) {
    rates = rates.filter((r) => r.part_type === filters.part_type);
  }
  return rates.sort((a, b) => {
    const modelCmp = String(a.model).localeCompare(String(b.model));
    if (modelCmp !== 0) return modelCmp;
    return String(a.part_label).localeCompare(String(b.part_label));
  });
}

export function lookupRepairRate(model, part_type) {
  const m = normalizeRateModel(model);
  const pt = String(part_type || '').trim();
  return getRepairRates().find(
    (r) => normalizeRateModel(r.model) === m && r.part_type === pt
  ) || null;
}

export function countRepairRates() {
  return readData().repair_rates.length;
}

/** Idempotent seed — upsert by model + part_type key. */
export function upsertRepairRates(items) {
  const ts = now();
  return withData((data) => {
    data.repair_rates = data.repair_rates || [];
    if (!data.meta.nextRepairRateId) data.meta.nextRepairRateId = 1;

    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      const model = normalizeRateModel(item.model);
      const part_type = String(item.part_type || '').trim();
      const existing = data.repair_rates.find(
        (r) => normalizeRateModel(r.model) === model && r.part_type === part_type
      );

      const payload = {
        brand: item.brand || 'Apple iPhone',
        model,
        part_type,
        part_label: item.part_label || part_type,
        purchase_price: Number(item.purchase_price) || 0,
        fitting_labor_charges: Number(item.fitting_labor_charges) || 0,
        min_selling_price: Number(item.min_selling_price) || 0,
        max_selling_price: Number(item.max_selling_price) || 0,
        active: item.active !== false,
        updated_at: ts,
      };

      if (existing) {
        Object.assign(existing, payload);
        updated += 1;
      } else {
        data.repair_rates.push({ id: data.meta.nextRepairRateId++, ...payload });
        inserted += 1;
      }
    }

    return { inserted, updated, total: data.repair_rates.length };
  });
}

export function getRepairRateCatalog() {
  const rates = getRepairRates();
  const byModel = new Map();

  for (const rate of rates) {
    if (!byModel.has(rate.model)) {
      byModel.set(rate.model, []);
    }
    byModel.get(rate.model).push({
      part_type: rate.part_type,
      part_label: rate.part_label,
    });
  }

  return [...byModel.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([model, parts]) => ({
      model,
      brand: 'Apple iPhone',
      parts: parts.sort((a, b) => a.part_label.localeCompare(b.part_label)),
    }));
}

export function logRepairRateQuery(input) {
  return withData((data) => {
    data.repair_rate_queries = data.repair_rate_queries || [];
    if (!data.meta.nextRepairRateQueryId) data.meta.nextRepairRateQueryId = 1;

    const entry = {
      id: data.meta.nextRepairRateQueryId++,
      customer_user_id: input.customer_user_id ?? null,
      customer_name: input.customer_name || '',
      model: normalizeRateModel(input.model),
      part_type: input.part_type || '',
      part_label: input.part_label || '',
      response_type: input.response_type || 'rate',
      created_at: now(),
    };

    data.repair_rate_queries.push(entry);
    return entry;
  });
}

export function getRepairRateQueriesByCustomer(userId, limit = 30) {
  return readData()
    .repair_rate_queries.filter((q) => q.customer_user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
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

const DEFAULT_POS_QR_CARDS = [
  {
    id: 'jazzcash-03039227000',
    method: 'JazzCash',
    label: 'JazzCash',
    number: '03039227000',
    accountName: 'ASAD SHAHZAD',
    payload: '03039227000',
    enabled: true,
  },
  {
    id: 'easypaisa-03039227000',
    method: 'EasyPaisa',
    label: 'EasyPaisa',
    number: '03039227000',
    accountName: 'ASAD SHAHZAD',
    payload: '03039227000',
    enabled: true,
  },
  {
    id: 'jazzcash-03004405890',
    method: 'JazzCash',
    label: 'JazzCash',
    number: '03004405890',
    accountName: 'ASAD SHAHZAD',
    payload: '03004405890',
    enabled: true,
  },
  {
    id: 'easypaisa-03218858747',
    method: 'EasyPaisa',
    label: 'EasyPaisa',
    number: '03218858747',
    accountName: 'ASAD SHAHZAD',
    payload: '03218858747',
    enabled: true,
  },
  {
    id: 'meezan-iban',
    method: 'Meezan Bank',
    label: 'Meezan Bank',
    number: 'PK81MEZN0011590105485732',
    accountNumber: '11590105485732',
    iban: 'PK81MEZN0011590105485732',
    accountName: 'ASAD SHAHZAD',
    payload: 'PK81MEZN0011590105485732',
    enabled: true,
  },
];

function normalizePosQrCards(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_POS_QR_CARDS;
  return source.slice(0, 12).map((raw, index) => {
    const method = String(raw?.method || raw?.label || 'Pay').trim().slice(0, 40) || 'Pay';
    const number = String(raw?.number || '').trim().slice(0, 40);
    const iban = String(raw?.iban || '').trim().slice(0, 40);
    const accountNumber = String(raw?.accountNumber || '').trim().slice(0, 30);
    const accountName = String(raw?.accountName || '').trim().slice(0, 120);
    const payload = String(raw?.payload || iban || number || '').trim().slice(0, 80);
    return {
      id: String(raw?.id || `${method}-${number || index}`).trim().slice(0, 64),
      method,
      label: String(raw?.label || method).trim().slice(0, 40),
      number: number || iban,
      accountNumber,
      iban,
      accountName,
      payload: payload || number || iban,
      enabled: raw?.enabled !== false,
    };
  }).filter((c) => c.payload);
}

const DEFAULT_PAYMENT_SETTINGS = {
  jazzcash: { enabled: true, number: '03039227000', accountName: 'ASAD SHAHZAD' },
  easypaisa: { enabled: true, number: '03039227000', accountName: 'ASAD SHAHZAD' },
  bank: {
    enabled: true,
    accountName: 'ASAD SHAHZAD',
    accountNumber: '11590105485732',
    iban: 'PK81MEZN0011590105485732',
    bankName: 'Meezan Bank',
    branch: 'BATAPUR BRANCH LHR',
  },
  cod: { enabled: true },
  /** Premier PayFast — disabled until merchant credentials are configured. */
  payfast: { enabled: false },
  /** POS thermal Scan & Pay slips (JazzCash / EasyPaisa / Meezan). */
  posQrCards: DEFAULT_POS_QR_CARDS,
};

const DEFAULT_DELIVERY_SETTINGS = {
  lahore_fee: 150,
  outside_note:
    'Delivery fee for your city will be confirmed by staff on WhatsApp before dispatch.',
};

const DEFAULT_ADDRESS_SETTINGS = {
  addressStructuredFormEnabled: true,
  addressCourierSafeLocationEnabled: false,
  addressMapPickerEnabled: true,
};

function normalizePosSettings(input = {}) {
  const returnHours = Number(input.posReturnWindowHours);
  const discountPercent = Number(input.posDiscountMaxPercentWithoutPin);
  const discountAmount = Number(input.posDiscountMaxAmountWithoutPin);
  return {
    posReturnWindowHours:
      Number.isFinite(returnHours) && returnHours >= 0 && returnHours <= 24 * 30
        ? Math.round(returnHours)
        : DEFAULT_POS_SETTINGS.posReturnWindowHours,
    posDiscountMaxPercentWithoutPin:
      Number.isFinite(discountPercent) && discountPercent >= 0 && discountPercent <= 100
        ? Number(discountPercent.toFixed(2))
        : DEFAULT_POS_SETTINGS.posDiscountMaxPercentWithoutPin,
    posDiscountMaxAmountWithoutPin:
      Number.isFinite(discountAmount) && discountAmount >= 0 && discountAmount <= 1000000
        ? Math.round(discountAmount)
        : DEFAULT_POS_SETTINGS.posDiscountMaxAmountWithoutPin,
    ...normalizeCustomBillPosFields(input),
  };
}

export function getDeliverySettings() {
  const saved = readData().settings?.delivery || {};
  const fee = Number(saved.lahore_fee);
  return {
    lahore_fee: Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : DEFAULT_DELIVERY_SETTINGS.lahore_fee,
    outside_note:
      saved.outside_note != null && String(saved.outside_note).trim()
        ? String(saved.outside_note).trim().slice(0, 300)
        : DEFAULT_DELIVERY_SETTINGS.outside_note,
    updated_at: saved.updated_at ?? null,
    updated_by: saved.updated_by ?? null,
  };
}

export function setDeliverySettings(input, userId) {
  return withData((data) => {
    if (!data.settings) data.settings = {};
    const current = getDeliverySettings();
    const next = { ...current };

    if (input?.lahore_fee != null) {
      const fee = Number(input.lahore_fee);
      if (!Number.isFinite(fee) || fee < 0 || fee > 50000) {
        throw new Error('Lahore delivery fee must be between 0 and 50000');
      }
      next.lahore_fee = Math.round(fee);
    }
    if (input?.outside_note != null) {
      next.outside_note = String(input.outside_note).trim().slice(0, 300)
        || DEFAULT_DELIVERY_SETTINGS.outside_note;
    }

    const payload = {
      lahore_fee: next.lahore_fee,
      outside_note: next.outside_note,
      updated_at: now(),
      updated_by: userId ?? null,
    };
    data.settings.delivery = payload;
    return payload;
  });
}

export function getAddressSettings() {
  const saved = readData().settings?.address_settings || {};
  return {
    addressStructuredFormEnabled: saved.addressStructuredFormEnabled !== false,
    addressCourierSafeLocationEnabled: Boolean(saved.addressCourierSafeLocationEnabled),
    addressMapPickerEnabled: saved.addressMapPickerEnabled !== false,
    updated_at: saved.updated_at ?? null,
    updated_by: saved.updated_by ?? null,
  };
}

export function getPosSettings() {
  const saved = readData().settings?.pos || {};
  return {
    ...normalizePosSettings(saved),
    updated_at: saved.updated_at ?? null,
    updated_by: saved.updated_by ?? null,
  };
}

export function setPosSettings(input, userId) {
  return withData((data) => {
    if (!data.settings) data.settings = {};
    const next = normalizePosSettings({
      ...getPosSettings(),
      ...(input && typeof input === 'object' ? input : {}),
    });
    const payload = {
      ...next,
      updated_at: now(),
      updated_by: userId ?? null,
    };
    data.settings.pos = payload;
    return payload;
  });
}

/** Counter staff may update Custom-bill shop profiles only (not discount/return limits). */
export function setPosCustomBillSettings(input, userId) {
  return withData((data) => {
    if (!data.settings) data.settings = {};
    const current = getPosSettings();
    const body = input && typeof input === 'object' ? input : {};
    const custom = normalizeCustomBillPosFields({
      customBillActiveProfile:
        body.customBillActiveProfile != null
          ? body.customBillActiveProfile
          : current.customBillActiveProfile,
      customBillOwn:
        body.customBillOwn != null
          ? { ...current.customBillOwn, ...body.customBillOwn }
          : current.customBillOwn,
      customBillAsfin:
        body.customBillAsfin != null
          ? { ...current.customBillAsfin, ...body.customBillAsfin }
          : current.customBillAsfin,
      customBillOther:
        body.customBillOther != null
          ? { ...current.customBillOther, ...body.customBillOther }
          : current.customBillOther,
    });
    const payload = {
      ...normalizePosSettings({ ...current, ...custom }),
      updated_at: now(),
      updated_by: userId ?? null,
    };
    data.settings.pos = payload;
    return payload;
  });
}

function nextAsfinBillId(list) {
  const max = list.reduce((acc, row) => Math.max(acc, Number(row?.id) || 0), 0);
  return max + 1;
}

function normalizeAsfinBillItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 80)
    .map((row) => {
      const name = String(row?.name || '').trim().slice(0, 120);
      if (!name) return null;
      const qty = Math.max(1, Math.min(9999, Math.round(Number(row?.qty) || 1)));
      const price = Math.max(0, Math.min(10_000_000, Math.round(Number(row?.price ?? row?.rate) || 0)));
      return { name, qty, price };
    })
    .filter(Boolean);
}

/** Separate sheet for ASPLYWOOD / ASFIN custom bills (not AsFix counter sales). */
export function listAsfinBills({ limit = 200 } = {}) {
  const rows = Array.isArray(readData().asfin_bills) ? readData().asfin_bills : [];
  const capped = Math.max(1, Math.min(500, Number(limit) || 200));
  return [...rows]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, capped);
}

export function createAsfinBill(input = {}, user = {}) {
  return withData((data) => {
    if (!Array.isArray(data.asfin_bills)) data.asfin_bills = [];
    const items = normalizeAsfinBillItems(input.items);
    if (!items.length) throw new Error('Add at least one item');
    const subtotal = items.reduce((sum, row) => sum + row.price * row.qty, 0);
    const discountRaw = Math.round(Number(input.discount_amount) || 0);
    const discount_amount = Math.max(0, Math.min(subtotal, discountRaw));
    const totalFromItems = Math.max(0, subtotal - discount_amount);
    const clientTotal = Math.round(Number(input.total_amount));
    const total_amount = Number.isFinite(clientTotal) && clientTotal >= 0
      ? clientTotal
      : totalFromItems;
    const id = nextAsfinBillId(data.asfin_bills);
    const bill = {
      id,
      bill_id: String(input.bill_id || input.order_id || `AF-${id}`).trim().slice(0, 40),
      brand: 'asfin',
      shop_name: clampPosStr(input.shop_name || 'ASPLYWOOD', 80, 'ASPLYWOOD'),
      shop_place: clampPosStr(input.shop_place, 80),
      shop_phone: clampPosStr(input.shop_phone, 40),
      customer_name: clampPosStr(input.customer_name || 'Walk-in', 80, 'Walk-in'),
      phone: clampPosStr(input.phone, 40),
      device_name: clampPosStr(input.device_name, 80),
      notes: clampPosStr(input.notes, 500),
      receipt_date: clampPosStr(input.receipt_date, 40),
      receipt_time: clampPosStr(input.receipt_time, 20),
      items,
      subtotal,
      discount_amount,
      total_amount,
      created_at: now(),
      staff_user_id: user?.id ?? null,
      staff_name: clampPosStr(user?.username || user?.name || '', 80),
    };
    data.asfin_bills.push(bill);
    appendAuditLog(data, 'asfin_bill.create', {
      actor: staffAuditUser(user),
      bill_id: bill.bill_id,
      total_amount: bill.total_amount,
      items: bill.items,
    });
    return bill;
  });
}

export function deleteAsfinBill(id, user = {}) {
  return withData((data) => {
    if (!Array.isArray(data.asfin_bills)) data.asfin_bills = [];
    const numId = Number(id);
    const idx = data.asfin_bills.findIndex((row) => Number(row.id) === numId);
    if (idx < 0) return null;
    const [removed] = data.asfin_bills.splice(idx, 1);
    appendAuditLog(data, 'asfin_bill.delete', {
      actor: staffAuditUser(user),
      bill_id: removed?.bill_id,
      total_amount: removed?.total_amount,
    });
    return removed;
  });
}

export function setAddressSettings(input, userId) {
  return withData((data) => {
    if (!data.settings) data.settings = {};
    const current = getAddressSettings();
    const next = {
      ...DEFAULT_ADDRESS_SETTINGS,
      addressStructuredFormEnabled:
        input?.addressStructuredFormEnabled != null
          ? Boolean(input.addressStructuredFormEnabled)
          : current.addressStructuredFormEnabled,
      addressCourierSafeLocationEnabled:
        input?.addressCourierSafeLocationEnabled != null
          ? Boolean(input.addressCourierSafeLocationEnabled)
          : current.addressCourierSafeLocationEnabled,
      addressMapPickerEnabled:
        input?.addressMapPickerEnabled != null
          ? Boolean(input.addressMapPickerEnabled)
          : current.addressMapPickerEnabled,
      updated_at: now(),
      updated_by: userId ?? null,
    };
    data.settings.address_settings = next;
    return next;
  });
}

export function getStorefrontImages() {
  const saved = readData().settings?.storefront_images || {};
  return {
    category_images:
      saved.category_images && typeof saved.category_images === 'object'
        ? saved.category_images
        : {},
    hero_slides: Array.isArray(saved.hero_slides) ? saved.hero_slides : [],
    updated_at: saved.updated_at ?? null,
    updated_by: saved.updated_by ?? null,
  };
}

export function setStorefrontImages(input, userId) {
  return withData((data) => {
    if (!data.settings) data.settings = {};
    const current = getStorefrontImages();
    const nextCategory = { ...current.category_images };
    if (input?.category_images && typeof input.category_images === 'object') {
      for (const [key, value] of Object.entries(input.category_images)) {
        const k = String(key).trim().slice(0, 80);
        const v = String(value || '').trim().slice(0, 800);
        if (!k) continue;
        if (!v) {
          delete nextCategory[k];
        } else if (/^https?:\/\//i.test(v) || v.startsWith('/')) {
          nextCategory[k] = v;
        }
      }
    }
    let nextHero = current.hero_slides;
    if (Array.isArray(input?.hero_slides)) {
      nextHero = input.hero_slides
        .slice(0, 8)
        .map((s, i) => {
          const productId = s?.product_id != null && s?.product_id !== ''
            ? String(s.product_id).slice(0, 40)
            : null;
          const image = String(s?.image || '').trim().slice(0, 800);
          const mediaTypeRaw = String(s?.media_type || '').toLowerCase();
          const looksVideo = mediaTypeRaw === 'video'
            || /\.(mp4|webm|mov)(\?|#|$)/i.test(image);
          return {
            id: String(s?.id || (productId ? `product-${productId}` : `slide-${i}`)).slice(0, 40),
            image,
            media_type: looksVideo ? 'video' : 'image',
            title: String(s?.title || '').trim().slice(0, 120),
            subtitle: String(s?.subtitle || '').trim().slice(0, 200),
            href: String(s?.href || '/shop').trim().slice(0, 200),
            product_id: productId,
          };
        })
        .filter((s) => s.image && (/^https?:\/\//i.test(s.image) || s.image.startsWith('/')));
    }
    const payload = {
      category_images: nextCategory,
      hero_slides: nextHero,
      updated_at: now(),
      updated_by: userId ?? null,
    };
    data.settings.storefront_images = payload;
    return payload;
  });
}

export function getPaymentSettings() {
  const saved = readData().settings?.payments || {};
  return {
    jazzcash: { ...DEFAULT_PAYMENT_SETTINGS.jazzcash, ...(saved.jazzcash || {}) },
    easypaisa: { ...DEFAULT_PAYMENT_SETTINGS.easypaisa, ...(saved.easypaisa || {}) },
    bank: { ...DEFAULT_PAYMENT_SETTINGS.bank, ...(saved.bank || {}) },
    cod: { ...DEFAULT_PAYMENT_SETTINGS.cod, ...(saved.cod || {}) },
    payfast: { ...DEFAULT_PAYMENT_SETTINGS.payfast, ...(saved.payfast || {}) },
    posQrCards: normalizePosQrCards(saved.posQrCards),
    updated_at: saved.updated_at ?? null,
    updated_by: saved.updated_by ?? null,
  };
}

export function setPaymentSettings(input, userId) {
  return withData((data) => {
    if (!data.settings) data.settings = {};
    const saved = data.settings.payments || {};
    const next = {
      jazzcash: { ...DEFAULT_PAYMENT_SETTINGS.jazzcash, ...(saved.jazzcash || {}) },
      easypaisa: { ...DEFAULT_PAYMENT_SETTINGS.easypaisa, ...(saved.easypaisa || {}) },
      bank: { ...DEFAULT_PAYMENT_SETTINGS.bank, ...(saved.bank || {}) },
      cod: { ...DEFAULT_PAYMENT_SETTINGS.cod, ...(saved.cod || {}) },
      payfast: { ...DEFAULT_PAYMENT_SETTINGS.payfast, ...(saved.payfast || {}) },
      posQrCards: normalizePosQrCards(saved.posQrCards),
    };

    for (const key of ['jazzcash', 'easypaisa', 'bank', 'cod', 'payfast']) {
      if (!input[key]) continue;
      const patch = input[key];
      next[key] = {
        ...next[key],
        ...(patch.enabled != null ? { enabled: Boolean(patch.enabled) } : {}),
        ...(patch.number != null ? { number: String(patch.number).trim().slice(0, 20) } : {}),
        ...(patch.accountName != null ? { accountName: String(patch.accountName).trim().slice(0, 120) } : {}),
        ...(patch.accountNumber != null ? { accountNumber: String(patch.accountNumber).trim().slice(0, 30) } : {}),
        ...(patch.iban != null ? { iban: String(patch.iban).trim().slice(0, 40) } : {}),
        ...(patch.bankName != null ? { bankName: String(patch.bankName).trim().slice(0, 80) } : {}),
        ...(patch.branch != null ? { branch: String(patch.branch).trim().slice(0, 120) } : {}),
      };
    }

    if (Object.prototype.hasOwnProperty.call(input, 'posQrCards')) {
      next.posQrCards = normalizePosQrCards(input.posQrCards);
    }

    const payload = {
      ...next,
      updated_at: now(),
      updated_by: userId ?? null,
    };
    data.settings.payments = payload;
    return payload;
  });
}

/** Full store snapshot (same shape as data.json) for admin backup export. */
export function exportFullData() {
  return readData();
}

/* ── Cross-device thermal print queue ── */

export const PRINT_JOB_TARGETS = ['any', 'android', 'laptop', 'local'];
export const PRINT_JOB_STATUSES = ['pending', 'printing', 'done', 'failed', 'expired'];
export const PRINT_JOB_TTL_MS = 10 * 60_000;
const PRINT_JOB_MAX_TEXT = 32_000;
const PRINT_JOB_MAX_BASE64 = 128_000;
const PRINT_JOB_KEEP = 200;

function isJobExpired(job, at = Date.now()) {
  if (!job) return true;
  if (job.status === 'expired') return true;
  if (job.status !== 'pending' && job.status !== 'printing') return false;
  const expires = Date.parse(job.expires_at || '');
  return Number.isFinite(expires) && expires <= at;
}

function expirePrintJobsInPlace(data, at = Date.now()) {
  if (!Array.isArray(data.print_jobs)) data.print_jobs = [];
  for (const job of data.print_jobs) {
    if (job.status !== 'pending' && job.status !== 'printing') continue;
    if (!isJobExpired(job, at)) continue;
    job.status = 'expired';
    job.finished_at = now();
    job.error = job.error || 'expired';
  }
}

function publicPrintJob(job) {
  if (!job) return null;
  const expired = isJobExpired(job);
  return {
    id: job.id,
    status: expired && (job.status === 'pending' || job.status === 'printing') ? 'expired' : job.status,
    target: job.target,
    text: job.text,
    data_base64: job.data_base64 || null,
    thermal_width: job.thermal_width,
    order_id: job.order_id ?? null,
    order_ref: job.order_ref ?? null,
    created_by_staff_id: job.created_by_staff_id ?? null,
    created_by_staff_name: job.created_by_staff_name || '',
    created_at: job.created_at,
    expires_at: job.expires_at,
    claimed_by: job.claimed_by || null,
    claimed_at: job.claimed_at || null,
    finished_at: job.finished_at || null,
    error: expired && !job.error ? 'expired' : (job.error || null),
  };
}

function jobMatchesStation(job, station) {
  if (!job || job.status !== 'pending' || isJobExpired(job)) return false;
  if (job.target === 'any') return station === 'android' || station === 'laptop';
  return job.target === station;
}

export function createPrintJob(input = {}) {
  return withData((data) => {
    if (!Array.isArray(data.print_jobs)) data.print_jobs = [];
    if (!data.meta.nextPrintJobId) data.meta.nextPrintJobId = 1;
    expirePrintJobsInPlace(data);

    const text = String(input.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!text.trim()) throw new Error('Receipt text is required');
    if (text.length > PRINT_JOB_MAX_TEXT) throw new Error('Receipt text is too long');
    const dataBase64 = String(input.data_base64 || '').trim();
    if (dataBase64 && !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
      throw new Error('Receipt ESC/POS data is invalid');
    }
    if (dataBase64.length > PRINT_JOB_MAX_BASE64) {
      throw new Error('Receipt ESC/POS data is too long');
    }

    let target = String(input.target || 'any').trim().toLowerCase();
    if (!PRINT_JOB_TARGETS.includes(target)) target = 'any';
    if (target === 'local') {
      throw new Error('Use local print on the device — do not enqueue local jobs');
    }

    const thermalWidth = input.thermal_width === '80mm' ? '80mm' : '58mm';
    const staffActor = staffAuditUser(input.staff_user || {});
    const createdAt = now();
    const expiresAt = new Date(Date.now() + PRINT_JOB_TTL_MS).toISOString();
    const id = data.meta.nextPrintJobId++;

    let orderId = null;
    let orderRef = null;
    if (input.order_id != null && input.order_id !== '') {
      const asNum = Number(input.order_id);
      if (Number.isFinite(asNum) && asNum > 0) {
        const order = (data.orders || []).find((o) => Number(o.id) === asNum);
        if (order) {
          orderId = order.id;
          orderRef = order.order_id || String(order.id);
        } else {
          orderId = asNum;
          orderRef = String(input.order_ref || input.order_id).slice(0, 40);
        }
      } else {
        orderRef = String(input.order_id).trim().slice(0, 40);
        const order = (data.orders || []).find((o) => String(o.order_id || '') === orderRef);
        if (order) {
          orderId = order.id;
          orderRef = order.order_id || String(order.id);
        }
      }
    }
    if (!orderRef && input.order_ref) {
      orderRef = String(input.order_ref).trim().slice(0, 40);
    }

    const job = {
      id,
      status: 'pending',
      target,
      text,
      data_base64: dataBase64 || null,
      thermal_width: thermalWidth,
      order_id: orderId,
      order_ref: orderRef,
      created_by_staff_id: staffActor.id ?? input.staff_user_id ?? null,
      created_by_staff_name: staffActor.name || '',
      created_at: createdAt,
      expires_at: expiresAt,
      claimed_by: null,
      claimed_at: null,
      finished_at: null,
      error: null,
    };
    data.print_jobs.unshift(job);
    data.print_jobs = data.print_jobs.slice(0, PRINT_JOB_KEEP);
    return publicPrintJob(job);
  });
}

export function listPendingPrintJobs({ station = null } = {}) {
  const data = readData();
  const stationKey = station === 'android' || station === 'laptop' ? station : null;
  let jobs = (data.print_jobs || []).filter((job) => job.status === 'pending' && !isJobExpired(job));
  if (stationKey) {
    jobs = jobs.filter((job) => jobMatchesStation(job, stationKey));
  } else {
    jobs = jobs.filter((job) => job.target === 'any' || job.target === 'android' || job.target === 'laptop');
  }
  return jobs
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(publicPrintJob);
}

export function claimPrintJob(id, { station, user = null } = {}) {
  return withData((data) => {
    expirePrintJobsInPlace(data);
    const stationKey = station === 'android' || station === 'laptop' ? station : null;
    if (!stationKey) throw new Error('station must be android or laptop');

    const index = (data.print_jobs || []).findIndex((job) => Number(job.id) === Number(id));
    if (index === -1) return null;
    const job = data.print_jobs[index];
    if (job.status === 'expired') return null;
    if (job.status !== 'pending') {
      throw new Error('Print job is no longer pending');
    }
    if (!jobMatchesStation(job, stationKey)) {
      throw new Error('Print job target does not match this station');
    }

    const actor = staffAuditUser(user || {});
    data.print_jobs[index] = {
      ...job,
      status: 'printing',
      claimed_at: now(),
      claimed_by: {
        station: stationKey,
        user_id: actor.id,
        name: actor.name || stationKey,
      },
    };
    return publicPrintJob(data.print_jobs[index]);
  });
}

export function completePrintJob(id, { status = 'done', error = null, user = null } = {}) {
  return withData((data) => {
    expirePrintJobsInPlace(data);
    const nextStatus = status === 'failed' ? 'failed' : 'done';
    const index = (data.print_jobs || []).findIndex((job) => Number(job.id) === Number(id));
    if (index === -1) return null;
    const job = data.print_jobs[index];
    if (job.status === 'done' || job.status === 'failed' || job.status === 'expired') {
      return publicPrintJob(job);
    }
    if (job.status !== 'printing' && job.status !== 'pending') {
      throw new Error('Print job cannot be completed');
    }
    const actor = staffAuditUser(user || {});
    data.print_jobs[index] = {
      ...job,
      status: nextStatus,
      finished_at: now(),
      error: nextStatus === 'failed'
        ? String(error || 'print_failed').trim().slice(0, 300)
        : null,
      claimed_by: job.claimed_by || {
        station: 'unknown',
        user_id: actor.id,
        name: actor.name || '',
      },
    };
    return publicPrintJob(data.print_jobs[index]);
  });
}

export function getPrintJob(id) {
  const job = (readData().print_jobs || []).find((entry) => Number(entry.id) === Number(id));
  return publicPrintJob(job);
}
