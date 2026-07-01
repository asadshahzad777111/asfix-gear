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
import { apiLimiter, authLimiter, writeLimiter, otpLimiter } from './middleware/rateLimit.js';

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
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', brand: 'AsFix & Gear', storage: 'json' });
});

app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/register/start', otpLimiter);
app.use('/api/auth/register/verify', authLimiter);
app.use('/api/auth/login/otp/start', otpLimiter);
app.use('/api/auth/login/otp/verify', authLimiter);
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
