import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { rateLimit, writeLimiter } from '../middleware/rateLimit.js';

const router = Router();

const PRINT_STAFF = ['super_admin', 'admin', 'editor', 'counter'];
const STATION_ONLINE_MS = 25_000;

/** In-memory presence for print agents (single Render dyno is fine for MVP). */
const stationPresence = new Map();

const createJobLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: 'Too many print jobs. Please wait a minute.',
});

const heartbeatLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  message: 'Too many heartbeats. Please wait a minute.',
});

function normalizeStation(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'android' || value === 'laptop' ? value : null;
}

function touchStation(station, user) {
  const key = normalizeStation(station);
  if (!key) return null;
  const entry = {
    station: key,
    last_seen: new Date().toISOString(),
    user_id: user?.id ?? null,
    name: String(user?.name || user?.username || key).trim().slice(0, 120),
  };
  stationPresence.set(key, entry);
  return entry;
}

function stationStatus(station) {
  const entry = stationPresence.get(station);
  if (!entry) {
    return { station, online: false, last_seen: null, name: null };
  }
  const age = Date.now() - Date.parse(entry.last_seen);
  const online = Number.isFinite(age) && age >= 0 && age <= STATION_ONLINE_MS;
  return {
    station,
    online,
    last_seen: entry.last_seen,
    name: entry.name || null,
  };
}

router.use(requireAuth, requireRole(...PRINT_STAFF));

/** POST /api/print-jobs — enqueue ESC/POS text for a remote station */
router.post('/', writeLimiter, createJobLimiter, (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const text = typeof body.text === 'string' ? body.text : '';
    const dataBase64 = typeof body.data_base64 === 'string' ? body.data_base64 : '';
    const target = typeof body.target === 'string' ? body.target : 'any';
    const thermalWidth = body.thermalWidth ?? body.thermal_width;
    const orderId = body.orderId ?? body.order_id ?? null;
    const orderRef = body.orderRef ?? body.order_ref ?? null;

    const job = store.createPrintJob({
      text,
      data_base64: dataBase64,
      target,
      thermal_width: thermalWidth,
      order_id: orderId,
      order_ref: orderRef,
      staff_user: req.auth.user,
    });
    res.status(201).json({ job });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not create print job' });
  }
});

/** GET /api/print-jobs/pending?station=android|laptop */
router.get('/pending', (req, res) => {
  try {
    const station = normalizeStation(req.query.station);
    if (req.query.station && !station) {
      return res.status(400).json({ error: 'station must be android or laptop' });
    }
    if (station) touchStation(station, req.auth.user);
    const jobs = store.listPendingPrintJobs({ station });
    res.json({
      jobs,
      stations: {
        android: stationStatus('android'),
        laptop: stationStatus('laptop'),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not list print jobs' });
  }
});

/** GET /api/print-jobs/stations — which agents are online */
router.get('/stations', (_req, res) => {
  res.json({
    stations: {
      android: stationStatus('android'),
      laptop: stationStatus('laptop'),
    },
  });
});

/** POST /api/print-jobs/heartbeat — agent presence */
router.post('/heartbeat', heartbeatLimiter, (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const station = normalizeStation(body.station);
  if (!station) {
    return res.status(400).json({ error: 'station must be android or laptop' });
  }
  const entry = touchStation(station, req.auth.user);
  res.json({
    ok: true,
    station: entry,
    stations: {
      android: stationStatus('android'),
      laptop: stationStatus('laptop'),
    },
  });
});

/** GET /api/print-jobs/:id */
router.get('/:id', (req, res) => {
  const job = store.getPrintJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Print job not found' });
  res.json({ job });
});

/** POST /api/print-jobs/:id/claim */
router.post('/:id/claim', (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const station = normalizeStation(body.station);
    if (!station) {
      return res.status(400).json({ error: 'station must be android or laptop' });
    }
    touchStation(station, req.auth.user);
    const job = store.claimPrintJob(req.params.id, { station, user: req.auth.user });
    if (!job) return res.status(404).json({ error: 'Print job not found or expired' });
    res.json({ job });
  } catch (err) {
    res.status(409).json({ error: err.message || 'Could not claim print job' });
  }
});

/** POST /api/print-jobs/:id/complete — mark done or failed */
router.post('/:id/complete', (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const status = body.status === 'failed' ? 'failed' : 'done';
    const error = typeof body.error === 'string' ? body.error : null;
    if (body.station) touchStation(body.station, req.auth.user);
    const job = store.completePrintJob(req.params.id, {
      status,
      error,
      user: req.auth.user,
    });
    if (!job) return res.status(404).json({ error: 'Print job not found' });
    res.json({ job });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not complete print job' });
  }
});

export default router;
