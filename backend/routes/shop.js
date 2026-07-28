import express from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as store from '../store.js';
import { isR2Configured, uploadHeroMedia } from '../services/r2.js';

const router = express.Router();
const SHOP_MANAGERS = ['super_admin', 'admin'];
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;
const MAX_HERO_UPLOAD_BYTES = 20 * 1024 * 1024;
const HERO_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const heroUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_HERO_UPLOAD_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!HERO_MEDIA_TYPES.has(String(file.mimetype || '').toLowerCase())) {
      cb(new Error('Only image (jpg/png/webp) or short video (mp4/webm/mov) allowed'));
      return;
    }
    cb(null, true);
  },
});

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

router.get('/address-settings', (_req, res) => {
  res.json(store.getAddressSettings());
});

router.patch('/address-settings', requireAuth, requireRole(...SHOP_MANAGERS), (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    res.json(store.setAddressSettings(body, req.auth.user.id));
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid address settings' });
  }
});

router.get('/pos-settings', requireAuth, requireRole('super_admin', 'admin', 'editor', 'counter'), (_req, res) => {
  res.json(store.getPosSettings());
});

router.patch('/pos-settings', requireAuth, requireRole(...SHOP_MANAGERS), (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    res.json(store.setPosSettings(body, req.auth.user.id));
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid POS settings' });
  }
});

/** Custom bill shop identity (own vs someone else) — counter + managers. */
router.patch(
  '/pos-custom-bill-settings',
  requireAuth,
  requireRole('super_admin', 'admin', 'editor', 'counter'),
  (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      res.json(store.setPosCustomBillSettings(body, req.auth.user.id));
    } catch (err) {
      res.status(400).json({ error: err.message || 'Invalid custom bill settings' });
    }
  },
);

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

/** Upload image or short video for home hero ads (gallery picker — not camera-only). */
router.post('/hero-media', requireAuth, requireRole(...SHOP_MANAGERS), (req, res, next) => {
  heroUpload.single('media')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File must be 20MB or smaller (short video / image)' });
      }
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    next();
  });
}, async (req, res) => {
  if (!isR2Configured()) {
    return res.status(503).json({
      error: 'Upload is not configured. Add Cloudflare R2 env vars on the server.',
    });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided (field name: media)' });
  }

  try {
    const url = await uploadHeroMedia(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    const media_type = String(req.file.mimetype || '').startsWith('video/') ? 'video' : 'image';
    res.status(201).json({ url, media_type });
  } catch (err) {
    console.error('[R2] hero media upload failed:', err.message);
    res.status(500).json({ error: 'Media upload failed' });
  }
});

export default router;
