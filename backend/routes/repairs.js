import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyShopWhatsApp, notifyCustomerWhatsApp } from '../services/otpDelivery.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const WHATSAPP_SUMMARY_CHARS = 160;

router.get('/services', (_req, res) => {
  res.json(store.getRepairServices());
});

router.post('/book', (req, res) => {
  const {
    customer_name,
    phone,
    alternative_contact,
    device_brand,
    device_model,
    issue,
    issue_types,
    issue_other,
    estimated_repair_time,
    terms_accepted,
    screen_quality,
    dead_mobile_acknowledged,
    service_id,
    preferred_date,
  } = req.body;

  if (!customer_name?.trim() || !phone?.trim() || !device_brand?.trim() || !device_model?.trim()) {
    return res.status(400).json({ error: 'Please fill all required contact and device fields' });
  }

  const types = Array.isArray(issue_types) ? issue_types : [];
  const otherText = String(issue_other || '').trim();
  const summary = String(issue || '').trim();

  if (types.length === 0 && !otherText && !summary) {
    return res.status(400).json({ error: 'Please select at least one issue or describe the problem' });
  }

  if (!terms_accepted) {
    return res.status(400).json({ error: 'You must confirm the terms before submitting' });
  }

  const booking = store.createRepairBooking({
    customer_name: customer_name.trim(),
    phone: phone.trim(),
    alternative_contact: alternative_contact?.trim() || '',
    device_brand: device_brand.trim(),
    device_model: device_model.trim(),
    issue: summary || otherText,
    issue_types: types,
    issue_other: otherText,
    estimated_repair_time: estimated_repair_time || '',
    screen_quality: screen_quality || '',
    dead_mobile_acknowledged: Boolean(dead_mobile_acknowledged),
    terms_accepted: true,
    service_id,
    preferred_date,
  });

  // Best-effort WhatsApp alerts — never block or fail the response (skipped
  // silently if WhatsApp Cloud API env vars aren't configured).
  const deviceLabel = `${booking.device_brand} ${booking.device_model}`.trim();
  const issueExcerpt =
    booking.issue.length > WHATSAPP_SUMMARY_CHARS
      ? `${booking.issue.slice(0, WHATSAPP_SUMMARY_CHARS)}…`
      : booking.issue;
  notifyShopWhatsApp(
    `New repair booking from ${booking.customer_name}: ${deviceLabel} — ${issueExcerpt}`
  ).catch(() => {});

  notifyCustomerWhatsApp(
    booking.phone,
    `Assalam o Alaikum ${booking.customer_name}! Your repair booking for ${deviceLabel} at AsFix & Gear has been received. We'll contact you shortly to confirm next steps.`
  ).catch(() => {});

  res.status(201).json({ message: 'Repair intake submitted successfully', booking });
});

router.get('/bookings', requireAuth, requireRole(...STAFF), (_req, res) => {
  res.json(store.getRepairBookings());
});

router.patch('/bookings/:id/status', requireAuth, requireRole(...STAFF), (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const booking = store.updateBookingStatus(req.params.id, status, req.auth.user);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  res.json(booking);
});

export default router;
