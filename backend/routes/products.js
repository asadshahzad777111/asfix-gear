import { Router } from 'express';
import multer from 'multer';
import * as store from '../store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { isR2Configured, uploadProductImage } from '../services/r2.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const MAX_IMAGE_DATA_URL = 180_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

function validateProductImage(image) {
  if (image == null) return image;
  const value = String(image);
  if (value.startsWith('data:') && value.length > MAX_IMAGE_DATA_URL) {
    throw new Error('Image too large — use a URL or upload an image under 150KB');
  }
  return value;
}

function sanitizeGallery(gallery) {
  if (gallery == null) return gallery;
  if (!Array.isArray(gallery)) {
    throw new Error('Gallery must be an array of image URLs');
  }
  if (gallery.length > 8) {
    throw new Error('Gallery can have at most 8 images');
  }
  return gallery.map((item) => validateProductImage(item)).filter(Boolean);
}

function sanitizeProductBody(body) {
  const next = { ...body };
  if (next.image != null) next.image = validateProductImage(next.image);
  if (next.gallery != null) next.gallery = sanitizeGallery(next.gallery);
  return next;
}
const CAN_DELETE = ['super_admin', 'admin'];

function isStaffUser(user) {
  return Boolean(user && STAFF.includes(user.role));
}

// A Super Admin can edit/delete anything (shop owner override). Every other
// staff role (admin, editor) may only touch products they personally added —
// this keeps one staff member from changing someone else's listing, price,
// stock, or discount by mistake (or on purpose).
function canEditProduct(user, product) {
  if (user.role === 'super_admin') return true;
  return product.created_by != null && String(product.created_by) === String(user.id);
}

function ownerOnlyResponse(res) {
  return res.status(403).json({
    error: 'You can only edit products you added yourself. Ask a Super Admin to change this one.',
  });
}

function mapProductsForRequest(products, user) {
  if (isStaffUser(user)) return products;
  return products.map((p) => store.stripProductCost(p));
}

router.get('/', optionalAuth, (req, res) => {
  const products = store.getProducts(req.query);
  res.json(mapProductsForRequest(products, req.auth?.user));
});

router.get('/categories', (_req, res) => {
  res.json(store.getProductCategories());
});

router.post('/upload-image', requireAuth, requireRole(...STAFF), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be 5MB or smaller' });
      }
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    next();
  });
}, async (req, res) => {
  if (!isR2Configured()) {
    return res.status(503).json({
      error: 'Image upload is not configured. Add Cloudflare R2 env vars on the server.',
    });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided (field name: image)' });
  }

  try {
    const url = await uploadProductImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    res.status(201).json({ url });
  } catch (err) {
    console.error('[R2] upload failed:', err.message);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

router.get('/:id', optionalAuth, (req, res) => {
  const product = store.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(isStaffUser(req.auth?.user) ? product : store.stripProductCost(product));
});

router.post('/', requireAuth, requireRole(...STAFF), (req, res) => {
  try {
    const body = sanitizeProductBody(req.body);
    const {
      name,
      category,
      brand,
      compatible_models,
      price,
      cost_price,
      description,
      image,
      gallery,
      stock,
      featured,
      discount_percent,
      warranty,
    } = body;
    if (!name || !category || price == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const product = store.createProduct({
      name,
      category,
      brand,
      compatible_models,
      price,
      cost_price,
      description: description || '',
      image,
      gallery,
      stock,
      featured,
      discount_percent,
      warranty,
      created_by: req.auth.user.id,
      created_by_name: req.auth.user.name || req.auth.user.username,
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, requireRole(...STAFF), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canEditProduct(req.auth.user, existing)) return ownerOnlyResponse(res);

  try {
    const body = sanitizeProductBody(req.body);
    const product = store.updateProduct(req.params.id, body);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/discount', requireAuth, requireRole(...STAFF), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canEditProduct(req.auth.user, existing)) return ownerOnlyResponse(res);

  const product = store.setProductDiscount(req.params.id, req.body.discount_percent);
  res.json(product);
});

/**
 * Manual stock adjustment — for offline/walk-in sales (negative delta) and
 * physical restocks (positive delta) that never go through the website
 * checkout flow, so staff can keep online stock counts accurate.
 */
router.patch('/:id/stock', requireAuth, requireRole(...STAFF), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canEditProduct(req.auth.user, existing)) return ownerOnlyResponse(res);

  const delta = Number(req.body.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: 'Enter a non-zero quantity' });
  }
  if (Math.abs(delta) > 100000) {
    return res.status(400).json({ error: 'Quantity is too large' });
  }

  try {
    const product = store.adjustProductStock(req.params.id, delta, {
      reason: req.body.reason === 'restock' ? 'restock' : 'offline_sale',
      note: req.body.note,
      staffName: req.auth.user.name || req.auth.user.username,
    });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole(...CAN_DELETE), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canEditProduct(req.auth.user, existing)) return ownerOnlyResponse(res);

  const deleted = store.deleteProduct(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: 'Product deleted' });
});

router.post('/:id/duplicate', requireAuth, requireRole(...STAFF), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const copy = store.duplicateProduct(req.params.id, {
    created_by: req.auth.user.id,
    created_by_name: req.auth.user.name || req.auth.user.username,
  });
  if (!copy) return res.status(404).json({ error: 'Product not found' });
  res.status(201).json(copy);
});

router.post('/bulk-delete', requireAuth, requireRole(...CAN_DELETE), (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'No product IDs provided' });

  let deleted = 0;
  for (const id of ids) {
    const existing = store.getProductById(id);
    if (!existing) continue;
    if (!canEditProduct(req.auth.user, existing)) continue;
    if (store.deleteProduct(id)) deleted += 1;
  }
  res.json({ deleted });
});

export default router;
