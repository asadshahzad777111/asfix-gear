import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor', 'counter'];

/** Separate ASPLYWOOD / ASFIN bill sheet (not AsFix counter sales). */
router.get('/', requireAuth, requireRole(...STAFF), (req, res) => {
  const limit = req.query.limit;
  res.json(store.listAsfinBills({ limit }));
});

router.post('/', writeLimiter, requireAuth, requireRole(...STAFF), (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const bill = store.createAsfinBill(body, req.auth.user);
    res.status(201).json(bill);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not save ASFIN bill' });
  }
});

router.delete('/:id', writeLimiter, requireAuth, requireRole(...STAFF), (req, res) => {
  const removed = store.deleteAsfinBill(req.params.id, req.auth.user);
  if (!removed) return res.status(404).json({ error: 'Bill not found' });
  res.json({ ok: true, deleted: removed });
});

export default router;
