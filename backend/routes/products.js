import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const MAX_IMAGE_DATA_URL = 180_000;

function validateProductImage(image) {
  if (image == null) return image;
  const value = String(image);
  if (value.startsWith('data:') && value.length > MAX_IMAGE_DATA_URL) {
    throw new Error('Image too large — use a URL or upload an image under 150KB');
  }
  return value;
}

function sanitizeProductBody(body) {
  const next = { ...body };
  if (next.image != null) next.image = validateProductImage(next.image);
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

export default router;
