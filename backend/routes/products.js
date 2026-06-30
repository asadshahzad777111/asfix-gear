import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const CAN_DELETE = ['super_admin', 'admin'];

function isStaffUser(user) {
  return Boolean(user && STAFF.includes(user.role));
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
  const { name, category, price, cost_price, description, image, stock, featured, discount_percent, warranty } =
    req.body;
  if (!name || !category || price == null || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const product = store.createProduct({
    name,
    category,
    price,
    cost_price,
    description,
    image,
    stock,
    featured,
    discount_percent,
    warranty,
  });

  res.status(201).json(product);
});

router.put('/:id', requireAuth, requireRole(...STAFF), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const product = store.updateProduct(req.params.id, req.body);
  res.json(product);
});

router.patch('/:id/discount', requireAuth, requireRole(...STAFF), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const product = store.setProductDiscount(req.params.id, req.body.discount_percent);
  res.json(product);
});

router.delete('/:id', requireAuth, requireRole(...CAN_DELETE), (req, res) => {
  const deleted = store.deleteProduct(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: 'Product deleted' });
});

export default router;
