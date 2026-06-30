import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const MAX_NAME = 120;
const MAX_PHONE = 30;
const MAX_CITY = 80;
const MAX_ITEMS = 20;
const MAX_GMAIL = 120;
const VALID_STATUSES = ['pending', 'payment_verified', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const VALID_PAYMENT_MODES = ['jazzcash', 'easypaisa', 'bank'];

router.get('/track', (req, res) => {
  const { orderId, phone } = req.query;
  if (!orderId?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Order ID and phone are required' });
  }
  const order = store.trackOrder(orderId.trim(), phone.trim());
  if (!order) return res.status(404).json({ error: 'Order not found — check ID and phone' });
  res.json(order);
});

router.post('/', optionalAuth, (req, res) => {
  const { customer_name, phone, city, payment_mode, items, notes } = req.body;

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

  const mode = String(payment_mode || 'jazzcash').trim().toLowerCase();
  if (!VALID_PAYMENT_MODES.includes(mode)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  const customerUserId =
    req.auth?.user?.role === 'customer' ? req.auth.user.id : null;

  const order = store.createOrder({
    customer_name: customer_name.trim(),
    phone: phone.trim(),
    city: city?.trim() || '',
    payment_mode: mode,
    items,
    notes: notes?.trim() || '',
    customer_user_id: customerUserId,
  });

  res.status(201).json({ message: 'Order placed successfully', order });
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
  const order = store.updateOrderStatus(req.params.id, shipping_status, req.auth.user);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

export default router;
