import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as store from '../store.js';

const router = express.Router();
const SHOP_MANAGERS = ['super_admin', 'admin'];
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

function computeIsOpen(manualOverride) {
  const hour = new Date().getHours();
  const byHours = hour >= OPEN_HOUR && hour < CLOSE_HOUR;
  if (manualOverride === 'open') return { is_open: true, by_hours: byHours };
  if (manualOverride === 'closed') return { is_open: false, by_hours: byHours };
  return { is_open: byHours, by_hours: byHours };
}

function statusPayload(shop) {
  const { is_open, by_hours } = computeIsOpen(shop.manual_override);
  return {
    is_open,
    by_hours,
    manual_override: shop.manual_override ?? null,
    open_hour: OPEN_HOUR,
    close_hour: CLOSE_HOUR,
    updated_at: shop.updated_at ?? null,
    updated_by: shop.updated_by ?? null,
  };
}

router.get('/status', (_req, res) => {
  res.json(statusPayload(store.getShopSettings()));
});

router.patch('/status', requireAuth, requireRole(...SHOP_MANAGERS), (req, res) => {
  const { manual_override } = req.body;
  if (manual_override !== null && manual_override !== 'open' && manual_override !== 'closed') {
    return res.status(400).json({ error: 'Use manual_override: null, "open", or "closed"' });
  }

  const shop = store.setShopManualOverride(manual_override, req.auth.user.id);
  res.json(statusPayload(shop));
});

router.get('/payments', (_req, res) => {
  res.json(store.getPaymentSettings());
});

router.patch('/payments', requireAuth, requireRole(...SHOP_MANAGERS), (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const payments = store.setPaymentSettings(body, req.auth.user.id);
  res.json(payments);
});

router.get('/delivery', (_req, res) => {
  res.json(store.getDeliverySettings());
});

router.patch('/delivery', requireAuth, requireRole(...SHOP_MANAGERS), (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const delivery = store.setDeliverySettings(body, req.auth.user.id);
    res.json(delivery);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/storefront-images', (_req, res) => {
  res.json(store.getStorefrontImages());
});

router.patch('/storefront-images', requireAuth, requireRole(...SHOP_MANAGERS), (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    res.json(store.setStorefrontImages(body, req.auth.user.id));
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid storefront images' });
  }
});

export default router;
