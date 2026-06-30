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

## Render Web Service

| Setting | Value |
|---------|--------|
| Build | `npm run install:all && npm run seed && npm run build --prefix frontend` |
| Start | `NODE_ENV=production node backend/server.js` |

## After deploy

1. Open Render URL → test home, shop, repair, admin login
2. Change admin password: `npm run reset-admin` locally then re-seed OR use admin UI
3. Update `frontend/src/config/shop.js` if address/phone changed
4. Custom domain: Render → Domains → add CNAME at registrar

Full guide: `DEPLOY.md`

## GitHub Actions

- **CI** runs on every push/PR (`.github/workflows/ci.yml`)
- **Deploy hint** — manual workflow; add `RENDER_DEPLOY_HOOK` secret for one-click deploy trigger
