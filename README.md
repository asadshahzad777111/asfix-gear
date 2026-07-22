# AsFix & Gear

**Mobile Repair + Accessories Shop** by Asad Shahzad — Lahore.

Full-stack shop: React (Vite) frontend + Node/Express API with JSON or MongoDB storage.

## Features

- Shop, Gaming Zone, Repair intake, Contact, Order track / Account
- COD (Lahore) + JazzCash / EasyPaisa / bank advance checkout
- Shop pickup option, cart persistence, product reviews & related items
- FAQ, legal pages, dynamic product sitemap, optional GA4
- Staff admin: products, orders, payments, delivery fee estimate, feedback

## Setup

```bash
npm run install:all
npm run seed
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

Copy `.env.example` → `.env` / `frontend/.env` as needed. Never commit real secrets.

## Analytics & SEO (you must configure)

### Google Analytics 4

1. Create a GA4 property → copy Measurement ID (`G-XXXXXXXX`).
2. Set **`VITE_GA_MEASUREMENT_ID`** in the **frontend build** environment (Vercel / Render static / `frontend/.env`).
3. Redeploy the frontend. Analytics only loads when the ID starts with `G-`.

### Google Search Console

1. Add property `https://asfixgear.com`.
2. Verify via DNS TXT or HTML meta tag (or Google Analytics ownership).
3. Submit sitemap: `https://asfixgear.com/sitemap.xml` (dynamic route includes published products).

## Deploy notes

- See `DEPLOY.md` and `npm run setup:check`.
- After first deploy: `npm run reset-admin`.
- Production health: `/api/health` should show ready storage (+ R2 for image / payment-proof uploads).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run check:i18n` | EN vs Roman Urdu key parity |
| `npm run check:secrets` | Block tracked secrets |
| `npm run build` | Frontend production build |

## Mobile POS (Android)

Staff phone app with Bluetooth thermal auto-print (no Thermer): see [`mobile/asfix-pos/README.md`](mobile/asfix-pos/README.md). Windows driver / Thermer / vendor APK (local installs only): [`docs/thermal-printer-windows.md`](docs/thermal-printer-windows.md) · `npm run thermal:help`.
