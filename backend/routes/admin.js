import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const SALES_VIEWERS = ['super_admin', 'admin', 'editor'];
const VALID_PERIODS = ['day', 'week', 'range'];

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

export default router;
