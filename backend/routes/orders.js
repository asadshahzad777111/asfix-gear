import { Router } from 'express';
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
const MAX_NAME = 120;
const MAX_PHONE = 30;
const MAX_CITY = 80;
const MAX_ITEMS = 20;
const MAX_GMAIL = 120;
const MAX_NOTES = 500;
const VALID_STATUSES = ['pending', 'payment_verified', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const VALID_PAYMENT_MODES = ['jazzcash', 'easypaisa', 'bank', 'cod'];

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

router.get('/reviews', (_req, res) => {
  res.json(store.getPublishedReviews(12));
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

  const { customer_name, phone, city, payment_mode, items, notes, shipping_address, address_id } = req.body;
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

  const mode = String(payment_mode || 'jazzcash').trim().toLowerCase();
  if (!VALID_PAYMENT_MODES.includes(mode)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  const paySettings = store.getPaymentSettings();
  if (paySettings[mode]?.enabled === false) {
    return res.status(400).json({ error: 'Payment method is not available' });
  }

  if (mode === 'cod') {
    const cityNorm = String(city || '').trim().toLowerCase();
    if (cityNorm !== 'lahore') {
      return res.status(400).json({
        error: 'Cash on Delivery is available for Lahore delivery only',
      });
    }
  }

  let resolvedAddress = null;
  try {
    if (address_id != null) {
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
      city: city?.trim() || '',
      payment_mode: mode,
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
    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    if (err instanceof store.StockError) {
      return res.status(409).json({ error: err.message, details: err.details });
    }
    throw err;
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
