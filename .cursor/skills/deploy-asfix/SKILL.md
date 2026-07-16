---
name: deploy-asfix
description: Deploy AsFix & Gear to Render with pre-flight checks. Use when user asks to deploy, go live, or set up Render/custom domain.
---
# Deploy AsFix & Gear

## Pre-flight (local)

```powershell
cd C:\Users\asads\asfix-gear
npm run install:all
npm run seed
npm run build
node scripts/check-i18n.js
node scripts/check-secrets.js
```

## Render Web Service (API — required)

| Setting | Value |
|---------|--------|
| Build | `npm run install:all && npm run seed && npm run build --prefix frontend` |
| Start | `NODE_ENV=production node backend/server.js` |

API URL (example): `https://asfix-gear.onrender.com`

## Vercel frontend (optional — fast UI)

Preferred when you want CDN speed for the SPA while API stays on Render.

| Setting | Value |
|---------|--------|
| Root Directory | `frontend` |
| Build | `npm run build` |
| Output | `dist` |
| Env | `VITE_API_BASE=https://asfix-gear.onrender.com/api` |
| SPA | `frontend/vercel.json` rewrites → `/index.html` |

Custom domain `asfixgear.com` → Vercel Domains + registrar DNS. Full steps: `DEPLOY.md` Option 2.

CORS on backend already allows `asfixgear.com`, `www`, and `https://*.vercel.app`.

## After deploy

1. Open site URL → test home, shop, repair, admin login
2. Change admin password: `npm run reset-admin` locally then re-seed OR use admin UI
3. Update `frontend/src/config/shop.js` if address/phone changed
4. Custom domain: Vercel (UI) or Render (combined) → Domains → DNS at registrar

Full guide: `DEPLOY.md`

## GitHub Actions

- **CI** runs on every push/PR (`.github/workflows/ci.yml`)
- **Deploy hint** — manual workflow; add `RENDER_DEPLOY_HOOK` secret for one-click deploy trigger
- **GitHub Pages** — optional backup frontend CDN; production domain should prefer Vercel once attached
