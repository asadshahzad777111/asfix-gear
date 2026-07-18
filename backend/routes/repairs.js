import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { notifyShopWhatsApp, notifyCustomerWhatsApp } from '../services/otpDelivery.js';
import { buildRepairStatusCustomerMessage } from '../services/repairNotifications.js';
import { publishRepairEvent, publishRepairMessageEvent } from '../services/liveEvents.js';
import { notifyN8nRepairCreated, notifyN8nRepairUpdated } from '../services/n8n.js';
import { rateLimit, writeLimiter, clientKey } from '../middleware/rateLimit.js';
import { MAZDORI_KEYWORDS } from '../rates/iphone-repair-rates.js';

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

const VALID_BOOKING_STATUSES = new Set(['pending', 'in_progress', 'completed', 'cancelled']);
const MAX_PHOTO_URL_LEN = 500;
const MAX_PHOTOS_PER_KIND = 4;
const MAX_MESSAGE_LEN = 2000;

const STAFF_MESSAGE_LIMIT = 60;
const CUSTOMER_MESSAGE_LIMIT = 30;

function repairMessageKey(req) {
  const uid = req.auth?.user?.id;
  return uid != null ? `user:${uid}` : clientKey(req);
}

const staffRepairMessageLimiter = rateLimit({
  windowMs: 60_000,
  max: STAFF_MESSAGE_LIMIT,
  message: 'Too many messages. Please wait a moment.',
  keyFn: repairMessageKey,
});

const customerRepairMessageLimiter = rateLimit({
  windowMs: 60_000,
  max: CUSTOMER_MESSAGE_LIMIT,
  message: 'Too many messages. Please wait a moment.',
  keyFn: repairMessageKey,
});

function repairMessageLimiter(req, res, next) {
  const role = req.auth?.user?.role;
  if (STAFF.includes(role)) return staffRepairMessageLimiter(req, res, next);
  return customerRepairMessageLimiter(req, res, next);
}

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

function normalizePhotoUrlList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item, MAX_PHOTO_URL_LEN))
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, MAX_PHOTOS_PER_KIND);
}

function sanitizeMessageText(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_LEN);
}

function assertBookingChatAccess(req, res, booking) {
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return false;
  }
  const user = req.auth?.user;
  if (STAFF.includes(user?.role)) return true;
  if (user?.role === 'customer' && store.customerOwnsRepairBooking(booking, user)) return true;
  res.status(403).json({ error: 'You cannot access this booking chat' });
  return false;
}

router.get('/track', (req, res) => {
  const bookingId = str(req.query.bookingId, 40);
  const phone = str(req.query.phone, MAX_LEN.phone);
  if (!bookingId || !phone) {
    return res.status(400).json({ error: 'Booking ID and phone are required' });
  }
  const booking = store.trackRepairBooking(bookingId, phone);
  if (!booking) return res.status(404).json({ error: 'Repair booking not found — check ID and phone' });
  res.json(booking);
});

router.get('/my-bookings', requireAuth, requireRole(...CUSTOMER), (req, res) => {
  const user = req.auth.user;
  res.json(
    store.getRepairBookingsForCustomer({
      userId: user.id,
      phone: user.phone,
    })
  );
});

router.get('/services', (_req, res) => {
  res.json(store.getRepairServices());
});

/** iPhone repair rate catalog for logged-in customers (labels only, no internal costs). */
router.get('/rates/catalog', requireAuth, requireRole(...CUSTOMER), (_req, res) => {
  res.json({ catalog: store.getRepairRateCatalog() });
});

/** Customer rate lookup — instant UI message + owner WhatsApp alert with margin breakdown. */
router.post('/rate-query', writeLimiter, requireAuth, requireRole(...CUSTOMER), (req, res) => {
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

router.post('/book', writeLimiter, optionalAuth, (req, res) => {
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
    customer_user_id: req.auth?.user?.role === 'customer' ? req.auth.user.id : null,
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
    `Assalam o Alaikum ${booking.customer_name}! Your repair booking for ${deviceLabel} at AsFix & Gear has been received. Booking ID: ${booking.booking_ref}. Exact issue confirm karne ke liye shop par physical inspection / eye diagnosis hogi — repair se pehle clear quote milega. Track: booking ID + phone on our website.`
  ).catch(() => {});

  publishRepairEvent('repair_created', booking);
  notifyN8nRepairCreated(booking);

  res.status(201).json({
    message: 'Repair intake submitted successfully',
    booking,
    customer_note:
      'Exact issue confirm karne ke liye shop par physical inspection / eye diagnosis hogi. Repair se pehle transparent quote milega.',
  });
});

router.get('/bookings', requireAuth, requireRole(...STAFF), (_req, res) => {
  res.json(store.getRepairBookings());
});

router.get('/chats', requireAuth, requireRole(...STAFF), (_req, res) => {
  res.json(store.getRepairChatsSummaryForStaff());
});

router.get('/messages/unread', requireAuth, (req, res) => {
  const user = req.auth.user;
  if (STAFF.includes(user.role)) {
    return res.json({ count: store.countUnreadRepairMessagesForStaff() });
  }
  if (CUSTOMER.includes(user.role)) {
    return res.json({ count: store.countUnreadRepairMessagesForCustomer(user.id, user.phone) });
  }
  return res.status(403).json({ error: 'Insufficient permissions' });
});

router.get('/bookings/:id/messages', requireAuth, (req, res) => {
  const booking = store.getRepairBookingById(req.params.id);
  if (!assertBookingChatAccess(req, res, booking)) return;

  const role = STAFF.includes(req.auth.user.role) ? 'staff' : 'customer';
  const messages = store.getRepairMessagesByBookingId(booking.id);
  store.markRepairMessagesRead(booking.id, role);
  res.json({
    messages,
    unread: store.getUnreadRepairMessageCountByBooking(booking.id, role),
  });
});

router.post('/bookings/:id/messages', requireAuth, repairMessageLimiter, (req, res) => {
  const booking = store.getRepairBookingById(req.params.id);
  if (!assertBookingChatAccess(req, res, booking)) return;

  const user = req.auth.user;
  const isStaff = STAFF.includes(user.role);
  if (!isStaff && !CUSTOMER.includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const text = sanitizeMessageText(req.body?.text);
  if (!text) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const sender = isStaff ? 'staff' : 'customer';
  const senderName = isStaff
    ? (user.username || 'Staff')
    : customerLabel(user);

  const message = store.createRepairMessage({
    repair_booking_id: booking.id,
    sender,
    sender_name: senderName,
    text,
  });
  if (!message) {
    return res.status(400).json({ error: 'Could not send message' });
  }

  publishRepairMessageEvent(message, booking);
  res.status(201).json(message);
});

router.patch('/bookings/:id/status', requireAuth, requireRole(...STAFF), (req, res) => {
  const { status } = req.body;
  if (!VALID_BOOKING_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const previous = store.getRepairBookings().find((b) => b.id === Number(req.params.id));
  const previousStatus = previous?.status || null;

  const booking = store.updateBookingStatus(req.params.id, status, req.auth.user);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const customerMsg = buildRepairStatusCustomerMessage(booking, status);
  if (customerMsg) {
    notifyCustomerWhatsApp(booking.phone, customerMsg).catch(() => {});
  }

  publishRepairEvent('repair_updated', booking);
  notifyN8nRepairUpdated(booking, previousStatus);
  res.json(booking);
});

router.patch('/bookings/:id/estimated-cost', requireAuth, requireRole(...STAFF), (req, res) => {
  try {
    const booking = store.updateBookingEstimatedCost(
      req.params.id,
      req.body?.estimated_cost,
      req.auth.user
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    publishRepairEvent('repair_updated', booking);
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/bookings/:id/photos', requireAuth, requireRole(...STAFF), (req, res) => {
  const body = req.body || {};
  const photos_before = body.photos_before !== undefined ? normalizePhotoUrlList(body.photos_before) : undefined;
  const photos_after = body.photos_after !== undefined ? normalizePhotoUrlList(body.photos_after) : undefined;

  if (photos_before === undefined && photos_after === undefined) {
    return res.status(400).json({ error: 'Provide photos_before and/or photos_after arrays' });
  }

  const booking = store.updateBookingPhotos(
    req.params.id,
    { photos_before, photos_after },
    req.auth.user
  );
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  publishRepairEvent('repair_updated', booking);
  res.json(booking);
});

router.patch('/bookings/:id/notes', requireAuth, requireRole(...STAFF), (req, res) => {
  const note = str(req.body?.note, 2000);
  if (!note) {
    return res.status(400).json({ error: 'Note text is required' });
  }

  const booking = store.addStaffNoteToBooking(req.params.id, note, req.auth.user);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  publishRepairEvent('repair_updated', booking);
  res.json(booking);
});

export default router;
