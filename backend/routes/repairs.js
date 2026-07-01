import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyShopWhatsApp, notifyCustomerWhatsApp } from '../services/otpDelivery.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const WHATSAPP_SUMMARY_CHARS = 160;

const MAX_LEN = {
  customer_name: 120,
  phone: 30,
  alternative_contact: 30,
  device_brand: 60,
  device_model: 60,
  issue: 2000,
  issue_other: 500,
  estimated_repair_time: 60,
  screen_quality: 60,
};

function str(value, max) {
  const s = typeof value === 'string' ? value : value == null ? '' : String(value);
  return max ? s.trim().slice(0, max) : s.trim();
}

router.get('/services', (_req, res) => {
  res.json(store.getRepairServices());
});

router.post('/book', (req, res) => {
  const body = req.body || {};
  const customer_name = str(body.customer_name, MAX_LEN.customer_name);
  const phone = str(body.phone, MAX_LEN.phone);
  const alternative_contact = str(body.alternative_contact, MAX_LEN.alternative_contact);
  const device_brand = str(body.device_brand, MAX_LEN.device_brand);
  const device_model = str(body.device_model, MAX_LEN.device_model);
  const issue_other = str(body.issue_other, MAX_LEN.issue_other);
  const summary = str(body.issue, MAX_LEN.issue);
  const estimated_repair_time = str(body.estimated_repair_time, MAX_LEN.estimated_repair_time);
  const screen_quality = str(body.screen_quality, MAX_LEN.screen_quality);
  const { issue_types, terms_accepted, dead_mobile_acknowledged, service_id, preferred_date } = body;

  if (!customer_name || !phone || !device_brand || !device_model) {
    return res.status(400).json({ error: 'Please fill all required contact and device fields' });
  }

  const types = Array.isArray(issue_types) ? issue_types.map((t) => str(t, 60)).slice(0, 20) : [];

  if (types.length === 0 && !issue_other && !summary) {
    return res.status(400).json({ error: 'Please select at least one issue or describe the problem' });
  }

  if (!terms_accepted) {
    return res.status(400).json({ error: 'You must confirm the terms before submitting' });
  }

  const booking = store.createRepairBooking({
    customer_name,
    phone,
    alternative_contact,
    device_brand,
    device_model,
    issue: summary || issue_other,
    issue_types: types,
    issue_other,
    estimated_repair_time,
    screen_quality,
    dead_mobile_acknowledged: Boolean(dead_mobile_acknowledged),
    terms_accepted: true,
    service_id: str(service_id, 60) || undefined,
    preferred_date: str(preferred_date, 30) || undefined,
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
