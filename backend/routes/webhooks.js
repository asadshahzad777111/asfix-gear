import { Router } from 'express';
import * as store from '../store.js';
import { publishOrderEvent } from '../services/liveEvents.js';

const router = Router();

function headerMatches(req) {
  const secret = String(process.env.POSTEX_WEBHOOK_SECRET || '').trim();
  if (!secret) return false;
  const key = String(process.env.POSTEX_WEBHOOK_HEADER || 'x-postex-secret').trim().toLowerCase();
  const incoming = req.get(key) || req.get(key.replace(/^x-/, '')) || '';
  return String(incoming).trim() === secret;
}

/**
 * PostEx status webhook.
 * Configure on merchant.postex.pk Integration Guide:
 *   URL: https://asfixgear.com/api/webhooks/postex
 *   Header Key: value of POSTEX_WEBHOOK_HEADER (default x-postex-secret)
 *   Header Value: POSTEX_WEBHOOK_SECRET
 */
router.post('/postex', (req, res) => {
  if (!headerMatches(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const dist = body.dist && typeof body.dist === 'object' ? body.dist : body;

  const trackingNumber =
    dist.trackingNumber ||
    dist.trackingNo ||
    body.trackingNumber ||
    body.tracking_number ||
    null;
  const orderRefNumber =
    dist.orderRefNumber ||
    body.orderRefNumber ||
    body.order_ref ||
    null;
  const transactionStatus =
    dist.transactionStatus ||
    dist.status ||
    body.transactionStatus ||
    body.status ||
    null;

  const order = store.applyPostexStatusUpdate({
    trackingNumber,
    orderRefNumber,
    transactionStatus,
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  publishOrderEvent('order_updated', order);
  res.json({ ok: true, order_id: order.order_id || order.id });
});

export default router;
