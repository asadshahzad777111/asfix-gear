import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router = Router();
const SALES_VIEWERS = ['super_admin', 'admin', 'editor'];
const CATEGORY_EDITORS = ['super_admin', 'admin', 'editor'];
const BACKUP_EXPORTERS = ['super_admin', 'admin'];
const AUDIT_VIEWERS = ['super_admin', 'admin'];
const VALID_PERIODS = ['day', 'week', 'range'];
const MAX_CATEGORY_NAME_LEN = 80;

// TODO: REMOVE AFTER MONGODB MIGRATION COMPLETE — temporary full-store export for Render free tier (no shell).
router.get('/export-data', requireAuth, requireRole(...BACKUP_EXPORTERS), (_req, res) => {
  try {
    const data = store.exportFullData();
    const date = new Date().toISOString().slice(0, 10);
    res.set('Content-Type', 'application/json');
    res.set('Content-Disposition', `attachment; filename="asfix-backup-${date}.json"`);
    res.send(JSON.stringify(data, null, 2));
  } catch {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/dashboard-stats', requireAuth, requireRole(...SALES_VIEWERS), (_req, res) => {
  res.json(store.getAdminDashboardStats());
});

router.get('/sales-report', requireAuth, requireRole(...SALES_VIEWERS), (req, res) => {
  const period = String(req.query.period || 'day').trim().toLowerCase();
  if (!VALID_PERIODS.includes(period)) {
    return res.status(400).json({ error: 'Use period=day, week, or range' });
  }

  const report = store.getSalesReport({
    period,
    from: req.query.from,
    to: req.query.to,
  });

  if (report.error) {
    return res.status(400).json({ error: report.error });
  }

  res.json(report);
});

router.get('/customers-summary', requireAuth, requireRole(...SALES_VIEWERS), (_req, res) => {
  res.json(store.getCustomerSummaries());
});

router.get('/audit', requireAuth, requireRole(...AUDIT_VIEWERS), (req, res) => {
  res.json(store.getAuditLogs({
    action: req.query.action,
    actorUserId: req.query.actor_user_id,
    limit: req.query.limit,
  }));
});

router.get('/categories', requireAuth, requireRole(...CATEGORY_EDITORS), (_req, res) => {
  res.json(store.listProductCategories());
});

router.post('/categories', writeLimiter, requireAuth, requireRole(...CATEGORY_EDITORS), (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, MAX_CATEGORY_NAME_LEN);
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  try {
    const category = store.createProductCategory({
      name,
      slug: req.body?.slug,
      parent_id: req.body?.parent_id,
    });
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not create category' });
  }
});

router.patch('/categories/:id', writeLimiter, requireAuth, requireRole(...CATEGORY_EDITORS), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid category id' });
  }
  try {
    const category = store.updateProductCategory(id, {
      name: req.body?.name,
      slug: req.body?.slug,
      parent_id: req.body?.parent_id,
    });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not update category' });
  }
});

router.delete('/categories/:id', writeLimiter, requireAuth, requireRole(...CATEGORY_EDITORS), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid category id' });
  }
  const result = store.deleteProductCategory(id);
  if (result.deleted) {
    return res.json({ ok: true });
  }
  if (result.reason === 'not_found') {
    return res.status(404).json({ error: 'Category not found' });
  }
  return res.status(409).json({
    error: result.message || 'Cannot delete category',
    product_count: result.product_count,
    reason: result.reason,
  });
});

router.get('/feedback', requireAuth, requireRole(...SALES_VIEWERS), (_req, res) => {
  res.json(store.listOrderFeedback());
});

router.patch('/feedback/:orderId', writeLimiter, requireAuth, requireRole(...CATEGORY_EDITORS), (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  try {
    const row = store.updateOrderFeedback(orderId, req.body || {}, req.user);
    if (!row) return res.status(404).json({ error: 'Review not found' });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not update review' });
  }
});

router.delete('/feedback/:orderId', writeLimiter, requireAuth, requireRole(...CATEGORY_EDITORS), (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  const ok = store.deleteOrderFeedback(orderId);
  if (!ok) return res.status(404).json({ error: 'Review not found' });
  res.json({ ok: true });
});

export default router;
