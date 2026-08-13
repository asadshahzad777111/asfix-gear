import { Router } from 'express';
import multer from 'multer';
import * as store from '../store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { notifyShopWhatsApp, notifyCustomerWhatsApp } from '../services/otpDelivery.js';
import {
  buildNewOrderShopMessage,
  buildPaidOrderShopMessage,
  buildOrderStatusCustomerMessage,
} from '../services/orderNotifications.js';
import {
  sendOrderCompleteEmail,
  sendOrderPlacedEmail,
  sendOrderStatusEmail,
  sendNewOrderShopEmail,
  sendCancelRequestShopEmail,
  sendCancelRefundCustomerEmail,
} from '../services/orderEmail.js';
import { publishOrderEvent } from '../services/liveEvents.js';
import { notifyN8nOrderCreated } from '../services/n8n.js';
import { isR2Configured, uploadPaymentProof } from '../services/r2.js';
import {
  isPostExConfigured,
  createOrder as postexCreateOrder,
  buildCreateOrderPayload,
} from '../services/postex.js';

function findOrderById(id) {
  return store.getOrders().find((o) => o.id === Number(id)) || null;
}

/** Online delivery only — skip counter, pickup, cancelled, already booked. */
function isEligibleForPostExBook(order) {
  if (!order) return false;
  if (order.source === 'counter_sale' || order.source === 'counter_return') return false;
  if (String(order.fulfillment_method || '').toLowerCase() === 'pickup') return false;
  if (order.shipping_status === 'cancelled') return false;
  if (order.postex_tracking) return false;
  return true;
}

/**
 * Optional auto-book when Admin Payments toggle is ON. Never throws — order update already succeeded.
 * @returns {{ order: object, postex_error: string|null, booked: boolean }}
 */
async function tryAutoBookPostEx(order, user) {
  const settings = store.getPostExSecrets();
  if (!settings?.auto_book_on_paid) {
    return { order, postex_error: null, booked: false };
  }
  if (!order || !isPostExConfigured() || !isEligibleForPostExBook(order)) {
    return { order, postex_error: null, booked: false };
  }

  try {
    const payload = buildCreateOrderPayload(order);
    const { trackingNumber, raw } = await postexCreateOrder(payload);
    if (!trackingNumber) {
      const msg = raw?.statusMessage || 'PostEx did not return a tracking number';
      console.error('[PostEx] Auto-book failed:', msg);
      const noted = store.appendOrderNote(order.id, `PostEx auto-book failed: ${msg}`, user, {
        postex_last_error: String(msg).slice(0, 200),
      });
      return { order: noted || order, postex_error: msg, booked: false };
    }

    const updated = store.setOrderPostexBooking(
      order.id,
      {
        trackingNumber,
        rawStatus: raw?.statusMessage || 'Booked',
        markShipped: true,
      },
      user
    );
    const finalOrder = updated || order;
    notifyCustomerStatusChange(finalOrder, order.shipping_status);
    publishOrderEvent('order_updated', finalOrder);
    return { order: finalOrder, postex_error: null, booked: true };
  } catch (err) {
    const msg = err.message || 'PostEx booking failed';
    console.error('[PostEx] Auto-book failed:', msg);
    const noted = store.appendOrderNote(order.id, `PostEx auto-book failed: ${msg}`, user, {
      postex_last_error: String(msg).slice(0, 200),
    });
    return { order: noted || order, postex_error: msg, booked: false };
  }
}

function withPostExMeta(order, { postex_error, booked } = {}) {
  if (!order) return order;
  const out = { ...order };
  if (postex_error) out.postex_error = postex_error;
  if (booked) out.postex_auto_booked = true;
  return out;
}

function notifyIfNewlyDelivered(order, previousStatus) {
  if (!order || order.shipping_status !== 'delivered') return;
  if (previousStatus === 'delivered') return;
  sendOrderCompleteEmail(order).catch((err) => {
    console.error('[OrderEmail] Async send failed:', err.message);
  });
}

function notifyCustomerStatusChange(order, previousStatus) {
  if (!order || !previousStatus) return;
  if (order.shipping_status === previousStatus) return;
  if (order.shipping_status === 'delivered') return; // completion email handles this

  const waText = buildOrderStatusCustomerMessage(order, order.shipping_status);
  if (waText) {
    notifyCustomerWhatsApp(order.phone, waText).catch(() => {});
  }
  sendOrderStatusEmail(order, previousStatus).catch((err) => {
    console.error('[OrderEmail] Status email failed:', err.message);
  });
}

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const COUNTER_SELLERS = ['super_admin', 'admin', 'editor', 'counter'];
const MAX_NAME = 120;
const MAX_PHONE = 30;
const MAX_CITY = 80;
const MAX_ITEMS = 20;
const MAX_GMAIL = 120;
const MAX_NOTES = 500;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const VALID_STATUSES = ['pending', 'payment_verified', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const VALID_PAYMENT_MODES = ['jazzcash', 'easypaisa', 'bank', 'cod'];
const VALID_COUNTER_PAYMENT_MODES = ['cash', 'card', 'jazzcash', 'easypaisa', 'bank', 'cod', 'other'];
const VALID_REFUND_METHODS = ['cash', 'store_credit'];
const SHOP_PICKUP_COORDS = { lat: 31.59375, lng: 74.46745 };

function salePrice(product) {
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) return 0;
  const discount = Math.min(90, Math.max(0, Number(product.discount_percent) || 0));
  return Math.round(price * (1 - discount / 100));
}

function isManagerRole(user) {
  return ['super_admin', 'admin'].includes(user?.role);
}

function resolveManagerOverride({ login, password }) {
  if (!String(login || '').trim() || !String(password || '')) return null;
  const result = store.authenticateUser(login, password);
  if (!result.ok || !isManagerRole(result.user)) return null;
  return result.user;
}

function discountFromRequest(body, subtotal) {
  const type = String(body?.discount_type || 'fixed').trim().toLowerCase() === 'percent' ? 'percent' : 'fixed';
  const rawAmount = Number(body?.discount_amount);
  const rawPercent = Number(body?.discount_percent);
  let percent = type === 'percent' && Number.isFinite(rawPercent)
    ? Math.max(0, Math.min(100, rawPercent))
    : 0;
  let amount = type === 'percent'
    ? Math.round((subtotal * percent) / 100)
    : Number.isFinite(rawAmount)
      ? Math.round(rawAmount)
      : 0;
  amount = Math.max(0, Math.min(amount, Math.round(subtotal)));
  percent = subtotal > 0 && amount > 0 ? Number(((amount / subtotal) * 100).toFixed(2)) : 0;
  return {
    discount_type: amount > 0 ? type : 'fixed',
    discount_amount: amount,
    discount_percent: type === 'percent' && amount > 0 ? percent : null,
    effective_percent: percent,
  };
}

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

function buildPickupAddress({ name, phone }) {
  return {
    name: String(name || '').trim().slice(0, 120),
    phone: String(phone || '').trim().slice(0, 30),
    text: 'Shop pickup — AsFix & Gear, Lahore (Google Maps pin)',
    lat: SHOP_PICKUP_COORDS.lat,
    lng: SHOP_PICKUP_COORDS.lng,
    is_pickup: true,
  };
}

function createCounterSaleFromPayload({ user, body }) {
  const {
    customer_name,
    phone,
    payment_mode,
    payment_note,
    items,
    discount_type,
    discount_amount,
    discount_percent,
    manager_login,
    manager_password,
  } = body || {};

  const name = String(customer_name || '').trim().slice(0, MAX_NAME) || 'Walk-in Customer';
  const phoneText = String(phone || '').trim().slice(0, MAX_PHONE);
  const note = String(payment_note || '').trim().slice(0, MAX_NOTES);
  const mode = String(payment_mode || 'cash').trim().toLowerCase();

  if (!VALID_COUNTER_PAYMENT_MODES.includes(mode)) {
    const error = new Error('Invalid counter payment method');
    error.status = 400;
    throw error;
  }
  if (customer_name && String(customer_name).trim().length > MAX_NAME) {
    const error = new Error('Customer name is too long');
    error.status = 400;
    throw error;
  }
  if (phone && String(phone).trim().length > MAX_PHONE) {
    const error = new Error('Phone is too long');
    error.status = 400;
    throw error;
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    const error = new Error('Bill must include 1-20 items');
    error.status = 400;
    throw error;
  }

  const orderItems = items.map((item) => {
    const productId = Number(item?.product_id);
    const qty = Number(item?.qty);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new store.StockError('Invalid product in bill');
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new store.StockError('Quantity must be between 1 and 99');
    }
    const product = store.getProductById(productId);
    if (!product) {
      throw new store.StockError(`Product not found: ${productId}`);
    }
    /* Optional staff sell-rate override (negotiate / discount). Catalog price if omitted. */
    const override = Number(item?.price);
    const unitPrice = Number.isFinite(override) && override >= 0
      ? Math.round(override)
      : salePrice(product);
    return {
      product_id: productId,
      qty,
      price: unitPrice,
    };
  });
  const subtotal = orderItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
  const discount = discountFromRequest({ discount_type, discount_amount, discount_percent }, subtotal);
  const settings = store.getPosSettings();
  const discountNeedsOverride = discount.discount_amount > settings.posDiscountMaxAmountWithoutPin
    || discount.effective_percent > settings.posDiscountMaxPercentWithoutPin;
  let discountOverrideUser = null;
  if (discountNeedsOverride && !isManagerRole(user)) {
    discountOverrideUser = resolveManagerOverride({ login: manager_login, password: manager_password });
    if (!discountOverrideUser) {
      const error = new Error('Manager approval required for this discount');
      error.status = 403;
      throw error;
    }
  }

  return store.createOrder({
    customer_name: name,
    phone: phoneText,
    city: 'Lahore',
    payment_mode: mode,
    fulfillment_method: 'pickup',
    items: orderItems,
    discount_type: discount.discount_type,
    discount_amount: discount.discount_amount,
    discount_percent: discount.discount_percent,
    notes: note ? `Counter sale payment note: ${note}` : 'Counter sale',
    shipping_address: buildPickupAddress({ name, phone: phoneText }),
    source: 'counter_sale',
    payment_status: 'paid',
    shipping_status: 'delivered',
    delivery_status: 'delivered',
    activity_message: `Counter bill created by Staff: ${user.username || user.name || 'staff'}`,
    staff_user_id: user.id,
    staff_user: user,
    discount_override_required: discountNeedsOverride,
    discount_override_user: discountOverrideUser || (discountNeedsOverride ? user : null),
  });
}

function sendCounterSaleError(res, err) {
  if (err instanceof store.StockError) {
    return res.status(409).json({ error: err.message, details: err.details });
  }
  return res.status(err.status || 400).json({ error: err.message || 'Could not create counter bill' });
}

const CUSTOM_BILL_CATEGORY = 'POS Custom';
const CUSTOM_BILL_TAG = 'pos-custom';
const MAX_CUSTOM_BILL_ITEM_NAME = 120;

function isPosCustomProduct(product) {
  if (!product) return false;
  const category = String(product.category || '').trim().toLowerCase();
  if (category === CUSTOM_BILL_CATEGORY.toLowerCase()) return true;
  const tags = Array.isArray(product.tags) ? product.tags : [];
  return tags.some((tag) => String(tag || '').trim().toLowerCase() === CUSTOM_BILL_TAG);
}

function findPosCustomProductByName(name) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle) return null;
  return store.getProducts({ status: 'all' }).find((product) => {
    if (!isPosCustomProduct(product)) return false;
    return String(product.name || '').trim().toLowerCase() === needle;
  }) || null;
}

/**
 * Upsert a POS Custom catalog row (stock in + cost/sale), then sell via counter bill.
 * Used by Custom bill "Save to stock & sales" — counter role allowed.
 */
function upsertCustomBillProduct({ name, qty, cost_price, sale_price, user }) {
  const cleanName = String(name || '').trim().slice(0, MAX_CUSTOM_BILL_ITEM_NAME);
  const units = Math.trunc(Number(qty));
  const cost = Math.round(Number(cost_price));
  const price = Math.round(Number(sale_price));
  if (!cleanName) {
    const error = new Error('Item name is required');
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(units) || units < 1 || units > 99) {
    const error = new Error('Quantity must be between 1 and 99');
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(cost) || cost < 0) {
    const error = new Error(`Actual rate (cost) required for "${cleanName}"`);
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(price) || price < 0) {
    const error = new Error(`Sale price required for "${cleanName}"`);
    error.status = 400;
    throw error;
  }

  const existing = findPosCustomProductByName(cleanName);
  if (existing) {
    const updated = store.updateProduct(existing.id, {
      price,
      cost_price: cost,
      status: 'published',
      category: CUSTOM_BILL_CATEGORY,
      tags: store.normalizeTags([...(existing.tags || []), CUSTOM_BILL_TAG]),
    });
    const stocked = store.adjustProductStock(existing.id, units, {
      reason: 'restock',
      note: 'Custom bill save to stock',
      staffName: user?.name || user?.username || 'staff',
      actor: user,
    });
    return stocked || updated || existing;
  }

  return store.createProduct({
    name: cleanName,
    category: CUSTOM_BILL_CATEGORY,
    brand: '',
    compatible_models: '',
    price,
    cost_price: cost,
    description: 'Added from POS Custom bill',
    tags: [CUSTOM_BILL_TAG],
    stock: units,
    purchase_count: units,
    featured: 0,
    discount_percent: 0,
    warranty: '',
    status: 'published',
    created_by: user?.id ?? null,
    created_by_name: user?.name || user?.username || '',
  });
}

router.post('/feedback', (req, res) => {
  const { orderId, phone, rating, comment, product_id } = req.body;
  if (!orderId?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Order ID and phone are required' });
  }

  try {
    const order = store.submitOrderFeedback(orderId.trim(), phone.trim(), { rating, comment, product_id });
    if (!order) return res.status(404).json({ error: 'Order not found — check ID and phone' });
    res.json({
      message: 'Thank you for your feedback',
      feedback: order.customer_feedback,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/reviews', (req, res) => {
  const productId = req.query.product_id;
  const limit = productId ? 24 : 12;
  res.json(store.getPublishedReviews(limit, { productId }));
});

router.get('/track', (req, res) => {
  const { orderId, phone } = req.query;
  if (!orderId?.trim()) {
    return res.status(400).json({ error: 'Order ID is required' });
  }
  const order = store.trackOrder(orderId.trim(), phone?.trim() || '');
  if (!order) return res.status(404).json({ error: 'Order not found — check the ID' });
  res.json(order);
});

/**
 * Customer cancel/refund request. Verified by order phone (guest) or logged-in customer ownership.
 * Does NOT cancel PostEx or auto-refund — staff must Approve/Dismiss in Admin.
 */
router.post('/cancel-request', optionalAuth, (req, res) => {
  const orderId = String(req.body?.orderId || req.body?.order_id || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const reason = String(req.body?.reason || '').trim().slice(0, 400);
  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required' });
  }

  const customerUser = req.auth?.user?.role === 'customer' ? req.auth.user : null;
  if (!customerUser && !phone) {
    return res.status(400).json({ error: 'Phone number is required to verify this order' });
  }

  try {
    const order = store.requestOrderCancel(orderId, { phone, reason, customerUser });
    publishOrderEvent('order_cancel_requested', order);
    sendCancelRequestShopEmail(order).catch((err) => {
      console.error('[OrderEmail] Cancel-request shop notify failed:', err.message);
    });
    res.json({
      ok: true,
      // Soft customer copy — never mention PostEx fee/cut
      message: store.customerCancelRequestMessage(order),
      order: {
        order_id: order.order_id,
        id: order.id,
        shipping_status: order.shipping_status,
        payment_mode: order.payment_mode,
        ...store.cancelRequestPublicView(order),
      },
    });
  } catch (err) {
    const code = err.code || '';
    const status =
      code === 'NOT_FOUND' ? 404 : code === 'ALREADY_PENDING' ? 409 : code === 'BLOCKED' || code === 'COUNTER' ? 400 : 400;
    res.status(status).json({ error: err.message || 'Could not submit cancel request' });
  }
});

router.post('/:id/cancel-request/approve', requireAuth, requireRole(...STAFF), (req, res) => {
  const refund_note = String(req.body?.refund_note || '').trim().slice(0, 400);
  const staff_note = String(req.body?.staff_note || '').trim().slice(0, 500);
  const refund_status = req.body?.refund_status;
  const refund_amount = req.body?.refund_amount;
  try {
    const previous = findOrderById(req.params.id);
    const order = store.resolveOrderCancelRequest(req.params.id, {
      action: 'approve',
      refund_note,
      staff_note,
      refund_status,
      refund_amount,
      updatedBy: req.auth.user,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    notifyCustomerStatusChange(order, previous?.shipping_status);
    publishOrderEvent('order_updated', order);
    const prepaid = store.isOrderPrepaidForCancel(order);
    res.json({
      ok: true,
      order,
      staff_tips: {
        prepaid,
        postex_booked: Boolean(order.cancel_postex_booked_at_request || order.postex_tracking),
        postex_note:
          order.cancel_postex_booked_at_request || order.postex_tracking
            ? 'PostEx booked — stop/return courier manually. Fee/cut staff-only; return remaining to customer. Never show cut to customer.'
            : null,
        refund_hint: prepaid
          ? 'Prepaid — set refund status pending/sent/partial and attach proof when done.'
          : 'COD — refund status not_needed (no money return).',
        settlements:
          'PostEx/COD settlement often 1–7 days after cuts — manage books manually; no auto accounting here.',
      },
    });
  } catch (err) {
    const status = err.code === 'NO_PENDING' ? 409 : 400;
    res.status(status).json({ error: err.message || 'Could not approve cancel' });
  }
});

router.post('/:id/cancel-request/dismiss', requireAuth, requireRole(...STAFF), (req, res) => {
  const refund_note = String(req.body?.refund_note || '').trim().slice(0, 400);
  const staff_note = String(req.body?.staff_note || '').trim().slice(0, 500);
  try {
    const order = store.resolveOrderCancelRequest(req.params.id, {
      action: 'dismiss',
      refund_note,
      staff_note,
      updatedBy: req.auth.user,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    publishOrderEvent('order_updated', order);
    res.json({ ok: true, order });
  } catch (err) {
    const status = err.code === 'NO_PENDING' ? 409 : 400;
    res.status(status).json({ error: err.message || 'Could not dismiss cancel request' });
  }
});

router.patch('/:id/cancel-refund', requireAuth, requireRole(...STAFF), async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const order = store.updateOrderCancelRefund(req.params.id, {
      refund_status: body.refund_status,
      refund_amount: body.refund_amount,
      staff_note: body.staff_note,
      refund_note: body.refund_note,
      refund_proof_url: body.refund_proof_url,
      updatedBy: req.auth.user,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    publishOrderEvent('order_updated', order);

    let customer_email = null;
    if (body.notify_customer) {
      customer_email = await sendCancelRefundCustomerEmail(order);
    }

    res.json({ ok: true, order, customer_email });
  } catch (err) {
    const status = err.code === 'NO_CANCEL' || err.code === 'BAD_STATUS' || err.code === 'BAD_AMOUNT' ? 400 : 400;
    res.status(status).json({ error: err.message || 'Could not update refund' });
  }
});

router.post(
  '/:id/cancel-refund-proof',
  requireAuth,
  requireRole(...STAFF),
  (req, res, next) => {
    proofUpload.single('proof')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!isR2Configured()) {
        return res.status(503).json({ error: 'Image storage (R2) is not configured' });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Proof image required' });
      }
      const url = await uploadPaymentProof(req.file.buffer, req.file.originalname, req.file.mimetype);
      const order = store.updateOrderCancelRefund(req.params.id, {
        refund_proof_url: url,
        updatedBy: req.auth.user,
      });
      if (!order) return res.status(404).json({ error: 'Order not found' });
      publishOrderEvent('order_updated', order);
      res.json({ ok: true, refund_proof_url: url, order });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not save refund proof' });
    }
  }
);

router.post('/', requireAuth, (req, res) => {
  const user = req.auth.user;
  if (user.role !== 'customer' || !user.active || user.blocked) {
    return res.status(403).json({ error: 'Please sign in as a customer to place an order' });
  }

  const {
    customer_name,
    phone,
    city,
    payment_mode,
    items,
    notes,
    shipping_address,
    address_id,
    fulfillment_method,
  } = req.body;
  if (!customer_name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }
  if (customer_name.trim().length > MAX_NAME || phone.trim().length > MAX_PHONE) {
    return res.status(400).json({ error: 'Invalid name or phone length' });
  }
  if (city && String(city).trim().length > MAX_CITY) {
    return res.status(400).json({ error: 'City name too long' });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return res.status(400).json({ error: 'Order must include 1–20 items' });
  }
  if (notes && String(notes).trim().length > MAX_NOTES) {
    return res.status(400).json({ error: 'Notes too long' });
  }

  const fulfillment = String(fulfillment_method || 'delivery').trim().toLowerCase() === 'pickup'
    ? 'pickup'
    : 'delivery';

  const mode = String(payment_mode || 'jazzcash').trim().toLowerCase();
  if (!VALID_PAYMENT_MODES.includes(mode)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  const paySettings = store.getPaymentSettings();
  if (paySettings[mode]?.enabled === false) {
    return res.status(400).json({ error: 'Payment method is not available' });
  }

  const resolvedCity = fulfillment === 'pickup' ? 'Lahore' : (city?.trim() || '');

  if (mode === 'cod') {
    const cityNorm = String(resolvedCity || '').trim().toLowerCase();
    if (cityNorm !== 'lahore') {
      return res.status(400).json({
        error: 'Cash on Delivery is available for Lahore delivery or shop pickup only',
      });
    }
  }

  let resolvedAddress = null;
  try {
    if (fulfillment === 'pickup') {
      resolvedAddress = buildPickupAddress({
        name: customer_name.trim(),
        phone: phone.trim(),
      });
    } else if (address_id != null) {
      resolvedAddress = store.resolveCustomerAddress(user.id, address_id);
      if (!resolvedAddress) {
        return res.status(400).json({ error: 'Saved address not found' });
      }
    } else if (shipping_address) {
      resolvedAddress = store.validateShippingAddress(shipping_address);
    } else {
      return res.status(400).json({ error: 'Delivery address is required' });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const customerUserId = user.id;

  try {
    const order = store.createOrder({
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      city: resolvedCity,
      payment_mode: mode,
      fulfillment_method: fulfillment,
      items,
      notes: notes?.trim() || '',
      customer_user_id: customerUserId,
      shipping_address: resolvedAddress,
    });
    notifyShopWhatsApp(buildNewOrderShopMessage(order)).catch(() => {});
    sendOrderPlacedEmail(order).catch((err) => {
      console.error('[OrderEmail] Place email failed:', err.message);
    });
    sendNewOrderShopEmail(order).catch((err) => {
      console.error('[OrderEmail] Shop notify failed:', err.message);
    });
    const placedWa = buildOrderStatusCustomerMessage(order, 'placed');
    if (placedWa) {
      notifyCustomerWhatsApp(order.phone, placedWa).catch(() => {});
    }
    publishOrderEvent('order_created', order);
    notifyN8nOrderCreated(order);
    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    if (err instanceof store.StockError) {
      return res.status(409).json({ error: err.message, details: err.details });
    }
    throw err;
  }
});

router.post('/counter-sale', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  try {
    const order = createCounterSaleFromPayload({
      user: req.auth.user,
      body: req.body,
    });

    publishOrderEvent('order_created', order);
    res.status(201).json({ message: 'Counter bill created', order });
  } catch (err) {
    sendCounterSaleError(res, err);
  }
});

/** Custom bill → upsert POS Custom products (cost + sale) + counter sale. */
/**
 * Custom bill → stock & sales.
 * Persists only item name / qty / cost (actual rate) / sale price + a normal counter sale.
 * Never accepts or stores logo, QR, shop images, or custom_receipt branding —
 * those stay print-only on the client Custom bill (custom_receipt orders).
 * AsFix Sale bill receipts remain fully separate (AsFix logo + asfixgear.com QR).
 */
router.post('/custom-bill-save', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    /* Ignore any client-sent branding fields — isolation from AsFix sale receipts */
    const {
      logo_data_url: _logo,
      qr_image_data_url: _qrImg,
      qr_payload: _qrPayload,
      custom_logo_data_url: _cLogo,
      custom_qr_image_data_url: _cQrImg,
      custom_qr_payload: _cQr,
      custom_receipt: _customReceipt,
      shop_name: _shopName,
      ...safeBody
    } = body;
    const rawItems = Array.isArray(safeBody.items) ? safeBody.items : [];
    if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
      return res.status(400).json({ error: 'Bill must include 1-20 items' });
    }

    const prepared = [];
    for (const row of rawItems) {
      const name = String(row?.name || '').trim();
      if (!name) continue;
      const qty = Math.max(1, Math.min(99, Math.trunc(Number(row?.qty) || 1)));
      const costRaw = row?.cost_price ?? row?.actual_rate ?? row?.cost;
      const saleRaw = row?.sale_price ?? row?.price ?? row?.rate;
      const product = upsertCustomBillProduct({
        name,
        qty,
        cost_price: costRaw,
        sale_price: saleRaw,
        user: req.auth.user,
      });
      prepared.push({
        product_id: product.id,
        qty,
        price: Math.round(Number(saleRaw)),
      });
    }

    if (!prepared.length) {
      return res.status(400).json({ error: 'Add at least one named item to save' });
    }

    const noteParts = [
      'Custom bill → stock & sales',
      String(safeBody.notes || '').trim(),
    ].filter(Boolean);

    const order = createCounterSaleFromPayload({
      user: req.auth.user,
      body: {
        customer_name: safeBody.customer_name,
        phone: safeBody.phone,
        payment_mode: safeBody.payment_mode || 'cash',
        payment_note: noteParts.join(' — ').slice(0, MAX_NOTES),
        discount_type: 'fixed',
        discount_amount: safeBody.discount_amount,
        items: prepared,
      },
    });

    publishOrderEvent('order_created', order);
    res.status(201).json({
      message: 'Custom bill saved to stock & sales',
      order,
      products: prepared.map((item) => ({
        product_id: item.product_id,
        qty: item.qty,
        price: item.price,
      })),
    });
  } catch (err) {
    sendCounterSaleError(res, err);
  }
});

router.get('/counter-sales/stats', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ''))
    ? new Date(`${req.query.date}T12:00:00`)
    : new Date();
  res.json(store.getCounterTodayStats({ user: req.auth.user, date }));
});

router.get('/counter-drafts', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  res.json(store.listCounterDrafts({ user: req.auth.user }));
});

router.post('/counter-drafts', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const mode = String(body.payment_mode || 'cash').trim().toLowerCase();
  if (!VALID_COUNTER_PAYMENT_MODES.includes(mode)) {
    return res.status(400).json({ error: 'Invalid counter payment method' });
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
    return res.status(400).json({ error: 'Draft must include 1-20 items' });
  }

  try {
    const draft = store.createCounterDraft({
      customer_name: body.customer_name,
      phone: body.phone,
      payment_mode: mode,
      payment_note: body.payment_note,
      discount_type: body.discount_type,
      discount_amount: body.discount_amount,
      discount_percent: body.discount_percent,
      items: body.items,
      staff_user_id: req.auth.user.id,
      staff_user: req.auth.user,
    });
    res.status(201).json({ message: 'Counter draft saved', draft });
  } catch (err) {
    if (err instanceof store.StockError) {
      return res.status(409).json({ error: err.message, details: err.details });
    }
    res.status(400).json({ error: err.message || 'Could not save draft' });
  }
});

router.post('/counter-drafts/:id/confirm', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  const draft = store.getCounterDraft(req.params.id, { user: req.auth.user });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  try {
    const order = createCounterSaleFromPayload({
      user: req.auth.user,
      body: {
        ...req.body,
        customer_name: draft.customer_name,
        phone: draft.phone,
        payment_mode: draft.payment_mode,
        payment_note: draft.payment_note,
        discount_type: draft.discount_type,
        discount_amount: draft.discount_amount,
        discount_percent: draft.discount_percent,
        items: draft.items,
      },
    });
    store.deleteCounterDraft(draft.id, { user: req.auth.user, convertedOrderId: order.id });
    publishOrderEvent('order_created', order);
    res.status(201).json({ message: 'Draft converted to counter bill', order });
  } catch (err) {
    sendCounterSaleError(res, err);
  }
});

router.delete('/counter-drafts/:id', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  const draft = store.deleteCounterDraft(req.params.id, { user: req.auth.user });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  res.json({ ok: true });
});

router.get('/counter-sales', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  const date = String(req.query.date || '').trim();
  const allOrders = store.getOrders();
  let orders = allOrders.filter((order) => (order.source || 'online') === 'counter_sale');
  if (req.auth.user.role === 'counter') {
    orders = orders.filter((order) => String(order.created_by_staff_id || '') === String(req.auth.user.id));
  } else if (req.query.staff_id) {
    orders = orders.filter((order) => String(order.created_by_staff_id || '') === String(req.query.staff_id));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    orders = orders.filter((order) => {
      const orderDate = order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : '';
      return orderDate === date;
    });
  }
  /* Attach returned totals from linked counter_return rows so POS list can show refunds */
  const enriched = orders.map((order) => {
    const returnedAmount = allOrders.reduce((sum, candidate) => {
      const isReturn = candidate.source === 'counter_return' || candidate.transaction_type === 'return';
      if (!isReturn || Number(candidate.original_order_id) !== Number(order.id)) return sum;
      const amount = Number(candidate.return_amount);
      if (Number.isFinite(amount) && amount > 0) return sum + amount;
      return sum + Math.abs(Number(candidate.total_amount) || 0);
    }, 0);
    if (!(returnedAmount > 0)) return order;
    const originalTotal = Number(order.total_amount) || 0;
    return {
      ...order,
      returned_amount: returnedAmount,
      net_amount: originalTotal - returnedAmount,
    };
  });
  res.json(enriched);
});

router.get('/counter-sales/:id', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  const key = String(req.params.id || '').trim().toUpperCase();
  const order = store.getOrders().find((candidate) => {
    const orderRef = String(candidate.order_id || '').trim().toUpperCase();
    return (
      (candidate.source || 'online') === 'counter_sale'
      && (String(candidate.id) === key || orderRef === key)
    );
  });

  if (!order) return res.status(404).json({ error: 'Counter sale not found' });
  if (
    req.auth.user.role === 'counter'
    && String(order.created_by_staff_id || '') !== String(req.auth.user.id)
  ) {
    return res.status(404).json({ error: 'Counter sale not found' });
  }

  res.json(order);
});

router.post('/counter-sales/:id/return', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  const key = String(req.params.id || '').trim().toUpperCase();
  const original = store.getOrders().find((candidate) => {
    const orderRef = String(candidate.order_id || '').trim().toUpperCase();
    return (
      (candidate.source || 'online') === 'counter_sale'
      && (String(candidate.id) === key || orderRef === key)
    );
  });

  if (!original) return res.status(404).json({ error: 'Counter sale not found' });
  if (
    req.auth.user.role === 'counter'
    && String(original.created_by_staff_id || '') !== String(req.auth.user.id)
  ) {
    return res.status(404).json({ error: 'Counter sale not found' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const refundMethod = String(body.refund_method || 'cash').trim().toLowerCase();
  if (!VALID_REFUND_METHODS.includes(refundMethod)) {
    return res.status(400).json({ error: 'Invalid refund method' });
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > MAX_ITEMS) {
    return res.status(400).json({ error: 'Select at least one item to return' });
  }

  const settings = store.getPosSettings();
  const createdAt = new Date(original.created_at);
  const ageMs = Date.now() - createdAt.getTime();
  const windowMs = Math.max(0, Number(settings.posReturnWindowHours) || 0) * 60 * 60 * 1000;
  const withinWindow = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= windowMs;
  let overrideUser = null;

  if (!withinWindow && !isManagerRole(req.auth.user)) {
    overrideUser = resolveManagerOverride({
      login: body.manager_login,
      password: body.manager_password,
    });
    if (!overrideUser) {
      return res.status(403).json({ error: 'Manager approval required outside return window' });
    }
  }

  try {
    const returnOrder = store.createCounterReturn({
      original_order_id: original.id,
      items: body.items,
      refund_method: refundMethod,
      reason: String(body.reason || '').slice(0, MAX_NOTES),
      staff_user_id: req.auth.user.id,
      staff_user: req.auth.user,
      override_user: overrideUser || (!withinWindow && isManagerRole(req.auth.user) ? req.auth.user : null),
    });
    publishOrderEvent('order_created', returnOrder);
    res.status(201).json({ message: 'Return processed', order: returnOrder });
  } catch (err) {
    if (err instanceof store.StockError) {
      return res.status(409).json({ error: err.message, details: err.details });
    }
    res.status(400).json({ error: err.message || 'Could not process return' });
  }
});

router.post('/:id/payment-proof', requireAuth, (req, res, next) => {
  proofUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be 5MB or smaller' });
      }
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    next();
  });
}, async (req, res) => {
  const user = req.auth.user;
  if (user.role !== 'customer' || !user.active || user.blocked) {
    return res.status(403).json({ error: 'Customer login required' });
  }
  if (!isR2Configured()) {
    return res.status(503).json({
      error: 'Payment proof upload is not configured. WhatsApp the screenshot to the shop instead.',
    });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided (field name: image)' });
  }

  try {
    const url = await uploadPaymentProof(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    const order = store.setOrderPaymentProof(req.params.id, {
      url,
      customerUserId: user.id,
      phone: user.phone,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    publishOrderEvent('order_updated', order);
    res.status(201).json({
      message: 'Payment proof uploaded',
      payment_proof_url: order.payment_proof_url,
      order_id: order.order_id,
    });
  } catch (err) {
    if (
      err.message?.includes('Not authorized')
      || err.message?.includes('only for')
      || err.message?.includes('already')
      || err.message?.includes('Invalid payment')
    ) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[R2] payment proof upload failed:', err.message);
    res.status(500).json({ error: 'Payment proof upload failed' });
  }
});

router.get('/', requireAuth, requireRole(...STAFF), (_req, res) => {
  res.json(store.getOrders());
});

/** Staff: is PostEx API token configured? (never returns the token) */
router.get('/postex/status', requireAuth, requireRole(...STAFF), (_req, res) => {
  res.json(store.getPostExSettingsPublic());
});

/**
 * Book this order on PostEx COD API and save tracking number.
 * Online delivery orders only (not counter / shop pickup).
 */
router.post('/:id/postex-book', requireAuth, requireRole(...STAFF), async (req, res) => {
  if (!isPostExConfigured()) {
    return res.status(503).json({
      error: 'PostEx not configured. Paste API token in Admin → Payments → PostEx.',
    });
  }

  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.source === 'counter_sale' || order.source === 'counter_return') {
    return res.status(400).json({ error: 'Counter sales are not booked on PostEx' });
  }
  if (String(order.fulfillment_method || '').toLowerCase() === 'pickup') {
    return res.status(400).json({ error: 'Shop pickup orders are not booked on PostEx' });
  }
  if (order.shipping_status === 'cancelled') {
    return res.status(400).json({ error: 'Cancelled orders cannot be booked' });
  }
  if (order.postex_tracking) {
    return res.status(409).json({
      error: 'Already booked on PostEx',
      tracking_number: order.postex_tracking,
      order,
    });
  }

  try {
    const payload = buildCreateOrderPayload(order, {
      pickupAddressCode: req.body?.pickupAddressCode,
    });
    const { trackingNumber, raw } = await postexCreateOrder(payload);
    if (!trackingNumber) {
      return res.status(502).json({
        error: 'PostEx did not return a tracking number',
        detail: raw?.statusMessage || null,
      });
    }

    const updated = store.setOrderPostexBooking(
      order.id,
      {
        trackingNumber,
        rawStatus: raw?.statusMessage || 'Booked',
        markShipped: true,
      },
      req.auth.user
    );
    if (!updated) return res.status(404).json({ error: 'Order not found after booking' });

    notifyCustomerStatusChange(updated, order.shipping_status);
    publishOrderEvent('order_updated', updated);
    res.json(updated);
  } catch (err) {
    console.error('[PostEx] Manual book failed:', err.message);
    const status =
      err.code === 'POSTEX_NOT_CONFIGURED'
        ? 503
        : err.code === 'POSTEX_BAD_PHONE' || err.code === 'POSTEX_BAD_ADDRESS'
          ? 400
          : 502;
    res.status(status).json({ error: err.message || 'PostEx booking failed' });
  }
});

router.patch('/:id/gmail', (req, res) => {
  const { gmail, phone } = req.body;
  if (!gmail?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Gmail and phone are required' });
  }
  if (String(gmail).trim().length > MAX_GMAIL) {
    return res.status(400).json({ error: 'Gmail address too long' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(gmail).trim())) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const order = store.updateOrderGmail(req.params.id, gmail.trim(), phone.trim());
  if (!order) return res.status(404).json({ error: 'Order not found or phone mismatch' });
  res.json({ message: 'Gmail saved for invoice routing', order_id: order.order_id });
});

router.patch('/:id/status', requireAuth, requireRole(...STAFF), async (req, res) => {
  const { shipping_status } = req.body;
  if (!VALID_STATUSES.includes(shipping_status)) {
    return res.status(400).json({ error: 'Invalid shipping status' });
  }
  const previous = findOrderById(req.params.id);
  const order = store.updateOrderStatus(req.params.id, shipping_status, req.auth.user);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  notifyIfNewlyDelivered(order, previous?.shipping_status);
  notifyCustomerStatusChange(order, previous?.shipping_status);
  publishOrderEvent('order_updated', order);

  // Optional auto-book (Admin → Payments → PostEx toggle; default OFF)
  if (
    shipping_status === 'payment_verified' &&
    previous?.shipping_status !== 'payment_verified'
  ) {
    const result = await tryAutoBookPostEx(order, req.auth.user);
    return res.json(withPostExMeta(result.order, result));
  }

  res.json(order);
});

router.patch('/:id/mark-paid', requireAuth, requireRole(...STAFF), async (req, res) => {
  try {
    const previous = findOrderById(req.params.id);
    const order = store.markOrderPaid(req.params.id, req.auth.user);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    notifyShopWhatsApp(buildPaidOrderShopMessage(order)).catch(() => {});
    notifyCustomerStatusChange(order, previous?.shipping_status || 'pending');
    publishOrderEvent('order_updated', order);

    // Optional auto-book when toggle ON (manual Book on PostEx always available)
    const result = await tryAutoBookPostEx(order, req.auth.user);
    res.json(withPostExMeta(result.order, result));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/assign-rider', requireAuth, requireRole(...STAFF), (req, res) => {
  const { rider_phone, delivery_charge } = req.body;
  try {
    const order = store.assignOrderRider(
      req.params.id,
      { rider_phone, delivery_charge },
      req.auth.user
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const riderWa = buildOrderStatusCustomerMessage(order, 'out_for_delivery');
    if (riderWa) {
      notifyCustomerWhatsApp(order.phone, riderWa).catch(() => {});
    }
    sendOrderStatusEmail(order, 'payment_verified').catch(() => {});
    publishOrderEvent('order_updated', order);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/mark-delivered', requireAuth, requireRole(...STAFF), (req, res) => {
  try {
    const previous = findOrderById(req.params.id);
    const order = store.markOrderDelivered(req.params.id, req.auth.user);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    notifyIfNewlyDelivered(order, previous?.shipping_status);
    publishOrderEvent('order_updated', order);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
