import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStats } from './store.js';
import productsRouter from './routes/products.js';
import repairsRouter from './routes/repairs.js';
import contactRouter from './routes/contact.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import shopRouter from './routes/shop.js';
import adminRouter from './routes/admin.js';
import { securityHeaders, getCorsOptions } from './middleware/security.js';
import { apiLimiter, writeLimiter } from './middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  if (req.path.startsWith('/auth')) return next();
  return apiLimiter(req, res, next);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', brand: 'AsFix & Gear', storage: 'json' });
});

app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

// Auth-specific rate limiters (login, OTP send, OTP verify) are applied
// directly on each route inside routes/auth.js, not mounted here — see the
// comment in middleware/rateLimit.js for why a shared/prefix-mounted
// limiter previously caused correct OTP codes to get silently 429'd.
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/repairs', writeLimiter, repairsRouter);
app.use('/api/contact', writeLimiter, contactRouter);
app.use('/api/orders', writeLimiter, ordersRouter);
app.use('/api/shop', shopRouter);
app.use('/api/admin', adminRouter);

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
  app.use(express.static(frontendDist, { maxAge: '1d', index: false, dotfiles: 'deny' }));
  app.get('*', (_req, res) => {
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

app.listen(PORT, () => {
  console.log(`AsFix & Gear API running on http://localhost:${PORT}`);
  console.log('Storage: backend/data/data.json');
});
