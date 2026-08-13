import { Router } from 'express';
import * as store from '../store.js';
import { publishOrderEvent } from '../services/liveEvents.js';
import { isPostExConfigured } from '../services/postex.js';
import { sendOrderCompleteEmail, sendOrderStatusEmail } from '../services/orderEmail.js';

const router = Router();

function headerMatches(req) {
  const secrets = store.getPostExSecrets();
  const secret = String(secrets.webhook_secret || '').trim();
  if (!secret) return false;
  const key = String(secrets.webhook_header || 'x-postex-secret').trim().toLowerCase();
  const incoming = req.get(key) || req.get(key.replace(/^x-/, '')) || '';
  return String(incoming).trim() === secret;
}

function webhookPublicUrl(req) {
  const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  if (host) return `${proto}://${host}/api/webhooks/postex`;
  return 'https://asfixgear.com/api/webhooks/postex';
}

/**
 * Browser / merchant portal check — GET is not a status update.
 * Real updates must POST with the configured secret header.
 */
router.get('/postex', (req, res) => {
  const pub = store.getPostExSettingsPublic();
  res.json({
    ok: true,
    service: 'PostEx',
    method: 'POST',
    configured: isPostExConfigured(),
    webhook_secret_set: pub.webhook_secret_set,
    webhook_header: pub.webhook_header,
    url: webhookPublicUrl(req),
    hint: 'Paste this URL + header on merchant.postex.pk Webhook Configuration. Do not open in browser for tracking — PostEx POSTs status updates here.',
  });
});

/**
 * PostEx status webhook.
 * Configure on merchant.postex.pk:
 *   URL: https://asfixgear.com/api/webhooks/postex
 *   Header Key / Value: from Admin → Payments → PostEx
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
    body.orderReferenceNumber ||
    null;
  const transactionStatus =
    dist.transactionStatus ||
    dist.orderStatus ||
    dist.status ||
    body.transactionStatus ||
    body.orderStatus ||
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

  const hist = order.status_history || [];
  const last = hist[hist.length - 1];
  const statusJustChanged = Boolean(last && last.at === order.updated_at && last.status);

  publishOrderEvent('order_updated', order);

  if (statusJustChanged) {
    if (order.shipping_status === 'delivered') {
      sendOrderCompleteEmail(order).catch(() => {});
    } else {
      // Force customer email: previous sentinel ≠ current status
      sendOrderStatusEmail(order, '__postex_prior__').catch(() => {});
    }
  }

  res.json({ ok: true, order_id: order.order_id || order.id });
});

export default router;
