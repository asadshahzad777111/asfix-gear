import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const SALES_VIEWERS = ['super_admin', 'admin', 'editor'];
const BACKUP_EXPORTERS = ['super_admin', 'admin'];
const VALID_PERIODS = ['day', 'week', 'range'];

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

export default router;
