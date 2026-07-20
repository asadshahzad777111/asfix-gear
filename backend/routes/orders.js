import { Router } from 'express';
import multer from 'multer';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
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
} from '../services/orderEmail.js';
import { publishOrderEvent } from '../services/liveEvents.js';
import { notifyN8nOrderCreated } from '../services/n8n.js';
import { isR2Configured, uploadPaymentProof } from '../services/r2.js';

function findOrderById(id) {
  return store.getOrders().find((o) => o.id === Number(id)) || null;
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
  if (!orderId?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Order ID and phone are required' });
  }
  const order = store.trackOrder(orderId.trim(), phone.trim());
  if (!order) return res.status(404).json({ error: 'Order not found — check ID and phone' });
  res.json(order);
});

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
  } = req.body || {};

  const name = String(customer_name || '').trim().slice(0, MAX_NAME) || 'Walk-in Customer';
  const phoneText = String(phone || '').trim().slice(0, MAX_PHONE);
  const note = String(payment_note || '').trim().slice(0, MAX_NOTES);
  const mode = String(payment_mode || 'cash').trim().toLowerCase();

  if (!VALID_COUNTER_PAYMENT_MODES.includes(mode)) {
    return res.status(400).json({ error: 'Invalid counter payment method' });
  }
  if (customer_name && String(customer_name).trim().length > MAX_NAME) {
    return res.status(400).json({ error: 'Customer name is too long' });
  }
  if (phone && String(phone).trim().length > MAX_PHONE) {
    return res.status(400).json({ error: 'Phone is too long' });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return res.status(400).json({ error: 'Bill must include 1–20 items' });
  }

  try {
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
      return {
        product_id: productId,
        qty,
        price: salePrice(product),
      };
    });
    const subtotal = orderItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
    const discount = discountFromRequest({ discount_type, discount_amount, discount_percent }, subtotal);
    const settings = store.getPosSettings();
    const discountNeedsOverride = discount.discount_amount > settings.posDiscountMaxAmountWithoutPin
      || discount.effective_percent > settings.posDiscountMaxPercentWithoutPin;
    let discountOverrideUser = null;
    if (discountNeedsOverride && !isManagerRole(req.auth.user)) {
      discountOverrideUser = resolveManagerOverride({ login: manager_login, password: manager_password });
      if (!discountOverrideUser) {
        return res.status(403).json({ error: 'Manager approval required for this discount' });
      }
    }

    const order = store.createOrder({
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
      activity_message: `Counter bill created by Staff: ${req.auth.user.username || req.auth.user.name || 'staff'}`,
      staff_user_id: req.auth.user.id,
      staff_user: req.auth.user,
      discount_override_required: discountNeedsOverride,
      discount_override_user: discountOverrideUser || (discountNeedsOverride ? req.auth.user : null),
    });

    publishOrderEvent('order_created', order);
    res.status(201).json({ message: 'Counter bill created', order });
  } catch (err) {
    if (err instanceof store.StockError) {
      return res.status(409).json({ error: err.message, details: err.details });
    }
    res.status(400).json({ error: err.message || 'Could not create counter bill' });
  }
});

router.get('/counter-sales', requireAuth, requireRole(...COUNTER_SELLERS), (req, res) => {
  const date = String(req.query.date || '').trim();
  let orders = store.getOrders().filter((order) => (order.source || 'online') === 'counter_sale');
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
  res.json(orders);
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

router.patch('/:id/status', requireAuth, requireRole(...STAFF), (req, res) => {
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
  if (shipping_status === 'cancelled' && previous?.stock_deducted) {
  }
  res.json(order);
});

router.patch('/:id/mark-paid', requireAuth, requireRole(...STAFF), (req, res) => {
  try {
    const previous = findOrderById(req.params.id);
    const order = store.markOrderPaid(req.params.id, req.auth.user);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    notifyShopWhatsApp(buildPaidOrderShopMessage(order)).catch(() => {});
    notifyCustomerStatusChange(order, previous?.shipping_status || 'pending');
    publishOrderEvent('order_updated', order);
    res.json(order);
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
