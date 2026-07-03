import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../scripts/load-env.mjs';
import { getStats, getStorageBackend, initStorage, isStorageReady, countRepairRates, upsertRepairRates, fixMisassignedShopClients } from './store.js';
import { buildIphoneRepairRateRecords } from './rates/iphone-repair-rates.js';
import productsRouter from './routes/products.js';
import repairsRouter from './routes/repairs.js';
import contactRouter from './routes/contact.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import shopRouter from './routes/shop.js';
import adminRouter from './routes/admin.js';
import { securityHeaders, getCorsOptions } from './middleware/security.js';
import { requireStorageReady } from './middleware/storageReady.js';
import { apiLimiter, writeLimiter } from './middleware/rateLimit.js';
import { isR2Configured } from './services/r2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In test/smoke runs, keep spawn-provided PORT (loadEnv would otherwise overwrite from .env).
loadEnv({ override: process.env.NODE_ENV !== 'test' });
const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(securityHeaders);
app.use(express.json({ limit: '256kb' }));
app.use('/api', cors(getCorsOptions()));
// Product/stock/order data changes constantly (staff edits from any device,
// live stock adjustments, etc.) — never let a browser, proxy, or CDN cache
// an API response, or customers on other devices would see stale data.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});
// Skip the generic API limiter for /api/auth — those routes already carry
// their own carefully-tuned per-action limiters (see routes/auth.js). Without
// this exclusion, a customer typing in a *correct* 6-digit OTP would still
// get gated by this shared, 60-second, all-of-/api bucket first: on a shared
// IP (mobile-carrier CGNAT, or a shop's own WiFi shared between the staff
// admin desk and in-store customer WiFi — both very common for this
// business), ordinary background traffic (product/category loads, shop
// status polling, admin desk polling, chat assistant, etc.) from anyone on
// that IP can exhaust the 120-per-minute budget on its own. The customer's
// verify request then gets a flat "Too many requests" 429 that never
// mentions OTP, which looks exactly like "the page just doesn't move
// forward after entering the code" with no obvious cause — the same failure
// mode this file's own rate-limit isolation was meant to prevent, just one
// layer higher than the fix originally covered.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path === '/ping' || req.path === '/health') return next();
  return apiLimiter(req, res, next);
});

app.get('/api/ping', (_req, res) => {
  res.type('text/plain').send('ok');
});

app.get('/api/health', (_req, res) => {
  const ready = isStorageReady();
  const starting = ready == null || ready === false;
  res.json({
    status: starting ? 'starting' : 'ok',
    brand: 'AsFix & Gear',
    storage: getStorageBackend(),
    ready: ready != null && ready !== false,
    r2: isR2Configured() ? 'configured' : 'off',
  });
});

app.get('/api/stats', (_req, res) => {
  const ready = isStorageReady();
  if (ready == null || ready === false) {
    return res.status(503).json({ error: 'Database is starting — retry in a few seconds' });
  }
  res.json(getStats());
});

// Auth-specific rate limiters (login, OTP send, OTP verify) are applied
// directly on each route inside routes/auth.js, not mounted here — see the
// comment in middleware/rateLimit.js for why a shared/prefix-mounted
// limiter previously caused correct OTP codes to get silently 429'd.
app.use('/api/auth', requireStorageReady, authRouter);
app.use('/api/products', requireStorageReady, productsRouter);
app.use('/api/repairs', writeLimiter, requireStorageReady, repairsRouter);
app.use('/api/contact', writeLimiter, requireStorageReady, contactRouter);
app.use('/api/orders', writeLimiter, requireStorageReady, ordersRouter);
app.use('/api/shop', requireStorageReady, shopRouter);
app.use('/api/admin', requireStorageReady, adminRouter);

// Common automated-scanner probe paths (WordPress, phpMyAdmin, env/git
// leaks, PHP info pages, etc.) — this app is a static React SPA + JSON API
// with none of that surface, so answer instantly with 404 instead of
// serving the SPA shell, which just wastes bandwidth on bot noise.
const BLOCKED_PROBE_PATTERNS = [
  /wp-admin|wp-login|wp-content|xmlrpc\.php/i,
  /phpmyadmin|adminer/i,
  /\.env($|\.)/i,
  /\.git\//i,
  /\.(php|asp|aspx|jsp|cgi)$/i,
  /\/(config|backup|dump)\.(sql|zip|tar|gz)$/i,
];

app.use((req, res, next) => {
  if (BLOCKED_PROBE_PATTERNS.some((re) => re.test(req.path))) {
    return res.status(404).end();
  }
  next();
});

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  // Hashed JS/CSS can stay cached; index.html must stay fresh so deploys
  // swap asset hashes immediately (mobile browsers often keep old index.html
  // for days and then load stale bundles — looks like "fix didn't deploy").
  const spaShellHeaders = (_res, filePath) => {
    const base = path.basename(filePath);
    if (filePath.endsWith(`${path.sep}index.html`) || base === 'sw.js' || base.startsWith('workbox-')) {
      _res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return;
    }
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      _res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  };
  app.use(
    express.static(frontendDist, {
      maxAge: '1d',
      index: false,
      dotfiles: 'deny',
      setHeaders: spaShellHeaders,
    })
  );
  app.get('*', (_req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

const INIT_RETRY_MS = 30_000;
const INIT_MAX_RETRIES = 20;

async function initStorageWithRetry(attempt = 1) {
  try {
    const storage = await initStorage();
    console.log(`Storage: ${storage === 'mongodb' ? 'MongoDB Atlas' : 'backend/data/data.json'}`);
    const demoted = fixMisassignedShopClients();
    if (demoted > 0) {
      console.log(`[users] Demoted ${demoted} misassigned shop client(s) from staff to customer`);
    }
    if (process.env.NODE_ENV !== 'test' && countRepairRates() === 0) {
      const seeded = upsertRepairRates(buildIphoneRepairRateRecords());
      console.log(`[rates] Seeded ${seeded.total} iPhone repair rates`);
    }
    return storage;
  } catch (err) {
    console.error(`Failed to init storage (attempt ${attempt}/${INIT_MAX_RETRIES}):`, err.message);
    if (attempt >= INIT_MAX_RETRIES) {
      console.error('Storage init gave up — /api/health stays starting until manual restart');
      return null;
    }
    console.log(`Retrying storage init in ${INIT_RETRY_MS / 1000}s...`);
    await new Promise((r) => setTimeout(r, INIT_RETRY_MS));
    return initStorageWithRetry(attempt + 1);
  }
}

async function startServer() {
  initStorageWithRetry().catch((err) => {
    console.error('Unexpected storage init error:', err.message);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AsFix & Gear API running on http://0.0.0.0:${PORT}`);
    console.log(`Storage target: ${getStorageBackend()}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
