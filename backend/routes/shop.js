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

export default router;
