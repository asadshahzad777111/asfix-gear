import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const MAX_NAME = 120;
const MAX_EMAIL = 160;
const MAX_PHONE = 30;
const MAX_MESSAGE = 2000;

router.post('/', optionalAuth, (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Name and message are required' });
  }
  if (name.trim().length > MAX_NAME || message.trim().length > MAX_MESSAGE) {
    return res.status(400).json({ error: 'Message too long' });
  }
  if (email && String(email).trim().length > MAX_EMAIL) {
    return res.status(400).json({ error: 'Email too long' });
  }
  if (phone && String(phone).trim().length > MAX_PHONE) {
    return res.status(400).json({ error: 'Phone too long' });
  }

  const customerUserId =
    req.auth?.user?.role === 'customer' ? req.auth.user.id : null;

  const saved = store.createContactMessage({
    name: name.trim(),
    email: email?.trim() || '',
    phone: phone?.trim() || '',
    message: message.trim(),
    customer_user_id: customerUserId,
  });

  res.status(201).json({
    message: 'Message sent successfully. We will contact you soon!',
    id: saved.id,
  });
});

router.get('/', requireAuth, requireRole(...STAFF), (_req, res) => {
  res.json(store.getContactMessages());
});

router.patch('/:id/reply', requireAuth, requireRole(...STAFF), (req, res) => {
  const { reply } = req.body;
  if (!reply?.trim()) {
    return res.status(400).json({ error: 'Reply text is required' });
  }
  const updated = store.replyContactMessage(req.params.id, reply);
  if (!updated) return res.status(404).json({ error: 'Message not found' });
  res.json(updated);
});

export default router;
