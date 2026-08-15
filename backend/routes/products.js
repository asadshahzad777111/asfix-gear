import { Router } from 'express';
import multer from 'multer';
import * as store from '../store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { isR2Configured, uploadProductImage } from '../services/r2.js';
import { publishProductEvent } from '../services/liveEvents.js';
import {
  productsToCsv,
  parseCsv,
  csvRecordToPatch,
} from '../utils/productsCsv.js';

const router = Router();
/** Includes counter — POS needs cost_price on catalog reads (sell vs cost). */
const STAFF = ['super_admin', 'admin', 'editor', 'counter'];
const PRODUCT_MANAGERS = ['super_admin', 'admin'];
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

function sanitizeTags(tags) {
  if (tags == null) return tags;
  if (!Array.isArray(tags)) {
    throw new Error('Tags must be an array of strings');
  }
  return store.normalizeTags(tags);
}

function sanitizeSlug(slug) {
  if (slug == null) return slug;
  const value = String(slug).trim();
  if (!value) return '';
  const normalized = store.slugify(value);
  if (!store.isValidSlug(normalized)) {
    throw new Error('Slug may only contain lowercase letters, numbers, and hyphens');
  }
  return normalized;
}

function sanitizeProductBody(body) {
  const next = { ...body };
  if (next.image != null) next.image = validateProductImage(next.image);
  if (next.hover_image != null) next.hover_image = validateProductImage(next.hover_image);
  if (next.gallery != null) next.gallery = sanitizeGallery(next.gallery);
  if (next.tags != null) next.tags = sanitizeTags(next.tags);
  if (next.slug != null) next.slug = sanitizeSlug(next.slug);
  if (next.status != null) {
    try {
      next.status = store.normalizeProductStatus(next.status);
    } catch {
      throw new Error('Invalid product status');
    }
  }
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
  if (user.role !== 'admin') return false;
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
  const staff = isStaffUser(req.auth?.user);
  let products = store.getProducts(req.query);
  // Public shop always hides drafts — even when a staff token is present in the
  // browser. Admin passes ?status=all to list draft + published inventory.
  const adminCatalog = staff && String(req.query.status || '').toLowerCase() === 'all';
  if (!adminCatalog) {
    products = products.filter((p) => store.isPublishedProduct(p));
  }
  res.json(mapProductsForRequest(products, req.auth?.user));
});

router.get('/categories', optionalAuth, (req, res) => {
  const staff = isStaffUser(req.auth?.user);
  const includeDrafts =
    staff && String(req.query.include_drafts || '').toLowerCase() === 'true';
  res.json(store.getProductCategories({ includeDrafts }));
});

router.post('/upload-image', requireAuth, requireRole(...PRODUCT_MANAGERS), (req, res, next) => {
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

/**
 * Staff Products Sheet — download Google-Sheets-ready CSV of the catalog.
 * Registered before /:id so path segments are not treated as an id.
 */
function sendProductsCsv(_req, res) {
  const products = store.getProducts({ status: 'all' });
  const csv = productsToCsv(products);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="asfix-products-${stamp}.csv"`);
  res.send(csv);
}
router.get('/export-csv', requireAuth, requireRole(...STAFF), sendProductsCsv);
router.get('/export.csv', requireAuth, requireRole(...STAFF), sendProductsCsv);

/**
 * Import CSV (from Google Sheets export or the Admin Sheet download).
 * Updates by id when editable; creates rows without id when name+category+price present.
 */
router.post('/import-csv', requireAuth, requireRole(...PRODUCT_MANAGERS), (req, res) => {
  const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
  if (!csv.trim()) {
    return res.status(400).json({ error: 'CSV text required (field: csv)' });
  }
  if (csv.length > 200_000) {
    return res.status(400).json({ error: 'CSV too large (max 200KB)' });
  }

  let records;
  try {
    ({ records } = parseCsv(csv));
  } catch {
    return res.status(400).json({ error: 'Could not parse CSV' });
  }

  if (!records.length) {
    return res.status(400).json({ error: 'No product rows found in CSV' });
  }
  if (records.length > 2000) {
    return res.status(400).json({ error: 'Too many rows (max 2000)' });
  }

  const summary = { updated: 0, created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const rowNum = i + 2;
    try {
      const patch = csvRecordToPatch(record);
      const idRaw = record.id != null ? String(record.id).trim() : '';

      if (idRaw) {
        const existing = store.getProductById(idRaw);
        if (!existing) {
          summary.skipped += 1;
          summary.errors.push({ row: rowNum, error: `Product id ${idRaw} not found` });
          continue;
        }
        if (!canEditProduct(req.auth.user, existing)) {
          summary.skipped += 1;
          summary.errors.push({ row: rowNum, error: `No permission for id ${idRaw}` });
          continue;
        }
        const updated = store.updateProduct(existing.id, patch);
        if (updated) {
          publishProductEvent(updated);
          summary.updated += 1;
        }
        continue;
      }

      if (!patch.name || !patch.category || patch.price == null) {
        summary.skipped += 1;
        summary.errors.push({
          row: rowNum,
          error: 'New row needs name, category, and price (or an existing id)',
        });
        continue;
      }

      const created = store.createProduct({
        ...patch,
        description: '',
        created_by: req.auth.user.id,
        created_by_name: req.auth.user.name || req.auth.user.username,
      });
      summary.created += 1;
      if (created) {
        publishProductEvent(created);
      }
    } catch (err) {
      summary.skipped += 1;
      summary.errors.push({ row: rowNum, error: err.message || 'Row failed' });
    }
  }

  res.json(summary);
});

router.get('/by-slug/:slug', optionalAuth, (req, res) => {
  const product = store.getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const staff = isStaffUser(req.auth?.user);
  if (!staff && !store.isPublishedProduct(product)) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(staff ? product : store.stripProductCost(product));
});

router.get('/:id', optionalAuth, (req, res) => {
  const param = req.params.id;
  let product = store.getProductById(param);
  if (!product && param && !/^\d+$/.test(String(param))) {
    product = store.getProductBySlug(param);
  }
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const staff = isStaffUser(req.auth?.user);
  if (!staff && !store.isPublishedProduct(product)) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(staff ? product : store.stripProductCost(product));
});

router.post('/', requireAuth, requireRole(...PRODUCT_MANAGERS), (req, res) => {
  try {
    const body = sanitizeProductBody(req.body);
    const {
      name,
      category,
      brand,
      compatible_models,
      barcode,
      sku,
      price,
      cost_price,
      description,
      slug,
      tags,
      image,
      hover_image,
      gallery,
      stock,
      featured,
      discount_percent,
      warranty,
      status,
    } = body;
    if (!name || !category || price == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const product = store.createProduct({
      name,
      category,
      brand,
      compatible_models,
      barcode,
      sku,
      price,
      cost_price,
      description: description || '',
      slug,
      tags,
      image,
      hover_image,
      gallery,
      stock,
      featured,
      discount_percent,
      warranty,
      status,
      created_by: req.auth.user.id,
      created_by_name: req.auth.user.name || req.auth.user.username,
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, requireRole(...PRODUCT_MANAGERS), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canEditProduct(req.auth.user, existing)) return ownerOnlyResponse(res);

  try {
    const body = sanitizeProductBody(req.body);
    const product = store.updateProduct(req.params.id, body);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    publishProductEvent(product);
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/discount', requireAuth, requireRole(...PRODUCT_MANAGERS), (req, res) => {
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
router.patch('/:id/stock', requireAuth, requireRole(...PRODUCT_MANAGERS), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canEditProduct(req.auth.user, existing)) return ownerOnlyResponse(res);

  const delta = Number(req.body.delta);
  const note = String(req.body.note || '').trim();
  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: 'Enter a non-zero quantity' });
  }
  if (note.length < 3) {
    return res.status(400).json({ error: 'Stock adjustment reason/note is required' });
  }
  if (Math.abs(delta) > 100000) {
    return res.status(400).json({ error: 'Quantity is too large' });
  }

  try {
    const product = store.adjustProductStock(req.params.id, delta, {
      reason: req.body.reason === 'restock' ? 'restock' : 'offline_sale',
      note,
      staffName: req.auth.user.name || req.auth.user.username,
      actor: req.auth.user,
    });
    publishProductEvent(product);
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole(...CAN_DELETE), (req, res) => {
  const existing = store.getProductById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canEditProduct(req.auth.user, existing)) return ownerOnlyResponse(res);

  const deleted = store.deleteProduct(req.params.id, { actor: req.auth.user });
  if (!deleted) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: 'Product deleted' });
});

router.post('/:id/duplicate', requireAuth, requireRole(...PRODUCT_MANAGERS), (req, res) => {
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
    if (store.deleteProduct(id, { actor: req.auth.user })) deleted += 1;
  }
  res.json({ deleted });
});

export default router;
