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
import { securityHeaders, getCorsOptions } from './middleware/security.js';
import { apiLimiter, authLimiter, writeLimiter } from './middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(securityHeaders);
app.use(cors(getCorsOptions()));
app.use(express.json({ limit: '256kb' }));
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', brand: 'AsFix & Gear', storage: 'json' });
});

app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/repairs', writeLimiter, repairsRouter);
app.use('/api/contact', writeLimiter, contactRouter);
app.use('/api/orders', writeLimiter, ordersRouter);
app.use('/api/shop', shopRouter);

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDist, { maxAge: '1d', index: false }));
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
