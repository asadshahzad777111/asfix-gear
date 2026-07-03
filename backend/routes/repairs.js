import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyShopWhatsApp, notifyCustomerWhatsApp } from '../services/otpDelivery.js';
import { MAZDORI_KEYWORDS } from '../data/iphone-repair-rates.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const CUSTOMER = ['customer'];
const WHATSAPP_SUMMARY_CHARS = 160;
const SHOP_WHATSAPP_INTL = process.env.SHOP_WHATSAPP_INTL || '923039227000';

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
  model: 60,
  part_type: 40,
  inquiry_type: 20,
  query_text: 500,
};

const VALID_PART_TYPES = new Set([
  'penal_service_pack',
  'battery_cell',
  'front_glass',
  'back_glass',
  'housing',
  'mazdori',
]);

function str(value, max) {
  const s = typeof value === 'string' ? value : value == null ? '' : String(value);
  return max ? s.trim().slice(0, max) : s.trim();
}

function formatPkr(amount) {
  return `PKR ${Number(amount || 0).toLocaleString('en-PK')}`;
}

function mazdoriWhatsAppUrl(model, customerName) {
  const text = encodeURIComponent(
    `Assalam o Alaikum! Main ${customerName || 'customer'} hoon. ${model ? `${model} ke liye ` : ''}exact fitting / mazdori details aur technician slot book karna chahta/chahti hoon.`
  );
  return `https://wa.me/${SHOP_WHATSAPP_INTL}?text=${text}`;
}

function isMazdoriInquiry(body) {
  const inquiry_type = str(body.inquiry_type, MAX_LEN.inquiry_type);
  const part_type = str(body.part_type, MAX_LEN.part_type);
  const query_text = str(body.query_text, MAX_LEN.query_text);
  return (
    inquiry_type === 'mazdori' ||
    part_type === 'mazdori' ||
    MAZDORI_KEYWORDS.test(query_text)
  );
}

function customerLabel(user) {
  return user?.name || user?.email || user?.phone || user?.username || 'Customer';
}

router.get('/services', (_req, res) => {
  res.json(store.getRepairServices());
});

/** iPhone repair rate catalog for logged-in customers (labels only, no internal costs). */
router.get('/rates/catalog', requireAuth, requireRole(...CUSTOMER), (_req, res) => {
  res.json({ catalog: store.getRepairRateCatalog() });
});

/** Customer rate lookup — instant UI message + owner WhatsApp alert with margin breakdown. */
router.post('/rate-query', requireAuth, requireRole(...CUSTOMER), (req, res) => {
  const body = req.body || {};
  const model = str(body.model, MAX_LEN.model);
  const part_type = str(body.part_type, MAX_LEN.part_type);
  const user = req.auth.user;
  const customer_name = customerLabel(user);

  if (!model && !isMazdoriInquiry(body)) {
    return res.status(400).json({ error: 'Please select an iPhone model' });
  }

  if (isMazdoriInquiry(body)) {
    const whatsapp_url = mazdoriWhatsAppUrl(model, customer_name);
    store.logRepairRateQuery({
      customer_user_id: user.id,
      customer_name,
      model,
      part_type: 'mazdori',
      part_label: 'Mazdori / Fitting',
      response_type: 'mazdori_redirect',
    });

    notifyShopWhatsApp(
      `Mazdori inquiry from ${customer_name}${model ? `: ${model}` : ''} — redirected to WhatsApp support`
    ).catch(() => {});

    return res.json({
      type: 'mazdori_redirect',
      message:
        'For exact fitting details, custom requirements, or to book a live technician slot, please click here to chat directly with our WhatsApp Support Team.',
      whatsapp_url,
    });
  }

  if (!part_type || !VALID_PART_TYPES.has(part_type)) {
    return res.status(400).json({ error: 'Please select a valid repair part or service' });
  }

  const rate = store.lookupRepairRate(model, part_type);
  if (!rate) {
    return res.status(404).json({ error: 'Rate not found for this model and part. Contact us on WhatsApp for a quote.' });
  }

  store.logRepairRateQuery({
    customer_user_id: user.id,
    customer_name,
    model: rate.model,
    part_type: rate.part_type,
    part_label: rate.part_label,
    response_type: 'rate',
  });

  const devicePart = `${rate.model} — ${rate.part_label}`;
  notifyShopWhatsApp(
    [
      `Rate query: ${customer_name}`,
      devicePart,
      `Purchase ${formatPkr(rate.purchase_price)} | Labor ${formatPkr(rate.fitting_labor_charges)}`,
      `Min ${formatPkr(rate.min_selling_price)} | Max ${formatPkr(rate.max_selling_price)}`,
    ].join('\n')
  ).catch(() => {});

  const min_price = rate.min_selling_price;
  const max_price = rate.max_selling_price;

  res.json({
    type: 'rate',
    model: rate.model,
    part_type: rate.part_type,
    part_label: rate.part_label,
    min_price,
    max_price,
    message: `Estimated retail rate for ${rate.model} ${rate.part_label}: ${formatPkr(min_price)} – ${formatPkr(max_price)}`,
    disclaimer: 'Final price confirmed after physical inspection at the shop.',
  });
});

router.get('/rate-queries', requireAuth, requireRole(...CUSTOMER), (req, res) => {
  res.json(store.getRepairRateQueriesByCustomer(req.auth.user.id));
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
