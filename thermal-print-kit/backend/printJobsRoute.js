/**
 * Standalone Express router for the cross-device thermal print queue.
 *
 * Decoupled from AsFix: you inject your own auth middleware and a print-jobs
 * store (see printJobsStore.js). Mount it in your server:
 *
 *   import express from 'express';
 *   import { createPrintJobsStore } from './printJobsStore.js';
 *   import { createPrintJobsRouter } from './printJobsRoute.js';
 *
 *   const printStore = createPrintJobsStore();
 *   app.use('/api/print-jobs', createPrintJobsRouter({
 *     store: printStore,
 *     // Your auth: must set req.auth = { user: { id, name, role } } and 401 if not staff.
 *     requireAuth: myRequireAuthMiddleware,
 *   }));
 *
 * If you omit requireAuth, a minimal Bearer-token guard is used that only
 * checks a shared token from options.sharedToken (dev only — replace in prod).
 */
import { Router } from 'express';

const STATION_ONLINE_MS = 25_000;

function defaultAuth(sharedToken) {
  return (req, res, next) => {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!sharedToken || token !== sharedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.auth = req.auth || { user: { id: 'staff', name: 'Staff', role: 'counter' } };
    next();
  };
}

function normalizeStation(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'android' || value === 'laptop' ? value : null;
}

/**
 * @param {{ store: object, requireAuth?: Function, sharedToken?: string }} options
 */
export function createPrintJobsRouter({ store, requireAuth, sharedToken } = {}) {
  if (!store) throw new Error('createPrintJobsRouter requires a store');
  const router = Router();
  const auth = requireAuth || defaultAuth(sharedToken);

  /** In-memory presence for print agents (single process is fine for MVP). */
  const stationPresence = new Map();

  const touchStation = (station, user) => {
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
  };

  const stationStatus = (station) => {
    const entry = stationPresence.get(station);
    if (!entry) return { station, online: false, last_seen: null, name: null };
    const age = Date.now() - Date.parse(entry.last_seen);
    const online = Number.isFinite(age) && age >= 0 && age <= STATION_ONLINE_MS;
    return { station, online, last_seen: entry.last_seen, name: entry.name || null };
  };

  const bothStations = () => ({ android: stationStatus('android'), laptop: stationStatus('laptop') });

  router.use(auth);

  // POST /api/print-jobs — enqueue ESC/POS text for a remote station
  router.post('/', (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const job = store.createPrintJob({
        text: typeof body.text === 'string' ? body.text : '',
        data_base64: typeof body.data_base64 === 'string' ? body.data_base64 : '',
        target: typeof body.target === 'string' ? body.target : 'any',
        thermal_width: body.thermalWidth ?? body.thermal_width,
        order_id: body.orderId ?? body.order_id ?? null,
        order_ref: body.orderRef ?? body.order_ref ?? null,
        staff_user: req.auth?.user,
      });
      res.status(201).json({ job });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not create print job' });
    }
  });

  // GET /api/print-jobs/pending?station=android|laptop
  router.get('/pending', (req, res) => {
    try {
      const station = normalizeStation(req.query.station);
      if (req.query.station && !station) {
        return res.status(400).json({ error: 'station must be android or laptop' });
      }
      if (station) touchStation(station, req.auth?.user);
      const jobs = store.listPendingPrintJobs({ station });
      res.json({ jobs, stations: bothStations() });
    } catch {
      res.status(500).json({ error: 'Could not list print jobs' });
    }
  });

  // GET /api/print-jobs/stations
  router.get('/stations', (_req, res) => {
    res.json({ stations: bothStations() });
  });

  // POST /api/print-jobs/heartbeat
  router.post('/heartbeat', (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const station = normalizeStation(body.station);
    if (!station) return res.status(400).json({ error: 'station must be android or laptop' });
    const entry = touchStation(station, req.auth?.user);
    res.json({ ok: true, station: entry, stations: bothStations() });
  });

  // GET /api/print-jobs/:id
  router.get('/:id', (req, res) => {
    const job = store.getPrintJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Print job not found' });
    res.json({ job });
  });

  // POST /api/print-jobs/:id/claim
  router.post('/:id/claim', (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const station = normalizeStation(body.station);
      if (!station) return res.status(400).json({ error: 'station must be android or laptop' });
      touchStation(station, req.auth?.user);
      const job = store.claimPrintJob(req.params.id, { station, user: req.auth?.user });
      if (!job) return res.status(404).json({ error: 'Print job not found or expired' });
      res.json({ job });
    } catch (err) {
      res.status(409).json({ error: err.message || 'Could not claim print job' });
    }
  });

  // POST /api/print-jobs/:id/complete
  router.post('/:id/complete', (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const status = body.status === 'failed' ? 'failed' : 'done';
      const error = typeof body.error === 'string' ? body.error : null;
      if (body.station) touchStation(body.station, req.auth?.user);
      const job = store.completePrintJob(req.params.id, { status, error, user: req.auth?.user });
      if (!job) return res.status(404).json({ error: 'Print job not found' });
      res.json({ job });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not complete print job' });
    }
  });

  return router;
}
