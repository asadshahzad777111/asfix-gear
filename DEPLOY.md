# AsFix & Gear — Live Deploy Guide

Yeh guide aapki website ko internet par live karne ke liye hai.

---

## Pehle Local Test Karein

1. **Node.js install karein:** https://nodejs.org (LTS)
2. Terminal kholein:

```powershell
cd C:\Users\asads\asfix-gear
npm run install:all
npm run seed
npm run dev
```

3. Browser mein kholein: http://localhost:5173

---

## Option 1: Render.com (Recommended — Free tier)

Sab se aasan tareeqa full-stack (frontend + backend) ke liye.

### Step 1: GitHub par code upload karein

```powershell
cd C:\Users\asads\asfix-gear
git add .
git commit -m "AsFix & Gear website ready"
```

GitHub par naya repo banayein, phir:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/asfix-gear.git
git push -u origin main
```

### Step 2: Render par Web Service banayein

1. https://render.com par account banayein
2. **New → Web Service** → GitHub repo connect karein
3. Settings:
   - **Build Command:** `npm run install:prod && npm run seed && npm run build`
   - **Start Command:** `NODE_ENV=production node backend/server.js`
   - **Environment:** Node

> **Product images:** `npm run seed` only adds default products when the database is empty. It does **not** run `fix-images.js`, so staff-updated product images survive redeploys. To reset images locally: `npm run seed:images --prefix backend`.
> **Redeploy note (Jul 2026):** Trigger deploy to verify image persistence + forgot-password modal fix.
4. **Environment variables:** `CORS_ORIGIN` set karein (deploy ke baad section dekhein). **`NODE_ENV=production` env var mein mat lagayein** — Start Command already production set karti hai. Agar `NODE_ENV=production` build time par set ho to `npm install` devDependencies skip karta hai aur `vite: not found` aata hai.
5. **Deploy** dabayein

Aapko URL milega jaise: `https://asfix-gear.onrender.com`

---

## Option 2: Vercel frontend + Render API (fast UI)

**Architecture:** Customers open the site on **Vercel** (CDN). The React app calls the API on **Render** (`https://asfix-gear.onrender.com/api`). Render can keep serving the old combined UI+API on `*.onrender.com` — treat that host as **API-only** for customers; brand domain must stay on Vercel.

`frontend/src/api/client.js` reads `VITE_API_BASE`. Dev defaults to `/api` (Vite proxy). Production builds without the env var fall back to `https://asfix-gear.onrender.com/api`. CI smoke sets `VITE_API_BASE=/api` so Playwright hits the local Express server.

### Backend (Render — keep running)

- Keep the existing Web Service (`asfix-gear.onrender.com`).
- Start stays: `NODE_ENV=production node backend/server.js`
- **Do not** attach `asfixgear.com` / `www.asfixgear.com` as Render Custom Domains while Vercel owns the brand domain — that causes DNS/SSL conflict. Remove them in Render → Settings → Custom Domains if listed; leave the Web Service itself running.
- Production CORS already allows:
  - `https://asfixgear.com`, `https://www.asfixgear.com`
  - `https://*.vercel.app` (preview + production `*.vercel.app` URLs)
  - GitHub Pages origin (backup)
  - Your `RENDER_EXTERNAL_URL`
- Optional: set `CORS_ORIGIN` on Render if you add more custom fronts.

### Frontend (Vercel)

1. https://vercel.com → **Sign up / Log in** → **Add New… → Project**
2. **Import** the GitHub repo `asfix-gear` (connect GitHub if asked)
3. Configure project:
   - **Root Directory:** `frontend` (click Edit → select `frontend`)
   - **Framework Preset:** Vite (auto)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
4. **Environment Variables** → add for Production (+ Preview if you want):
   - Name: `VITE_API_BASE`
   - Value: `https://asfix-gear.onrender.com/api`
5. **Deploy** → wait for build → open the `*.vercel.app` URL and test shop / login / repair

SPA routing is handled by `frontend/vercel.json` (all routes → `/index.html`).

### Custom domain `asfixgear.com` → Vercel

1. Vercel → Project → **Settings → Domains** → add `asfixgear.com` and `www.asfixgear.com`
2. At your **registrar DNS** (Cloudflare / Namecheap / Hostinger), point the domain to Vercel (Vercel shows exact records):

| Type | Name | Value (asfix-gear project, Jul 2026) |
|------|------|--------------------------------------|
| **CNAME** | `@` | `33fc1b84b766b58b.vercel-dns-017.com` (Cloudflare: DNS only / grey cloud) |
| **CNAME** | `www` | `33fc1b84b766b58b.vercel-dns-017.com` (DNS only) |

> On **Cloudflare**, use CNAME for both `@` and `www` — not A records. Delete old Render A (`216.24.57.1`) and GitHub Pages CNAMEs first.

3. Remove old **A/CNAME** that pointed at Render (or GitHub Pages) for the apex/`www` once you cut over.
4. Wait for SSL (usually a few minutes). Open `https://asfixgear.com`.

> **API stays on Render.** Do **not** point `asfixgear.com` at Render if the UI is on Vercel. Health check: `https://asfix-gear.onrender.com/api/health`.

### Dual deploy / GitHub Pages backup

- **GitHub Pages** workflow can stay as a backup frontend CDN.
- Once `asfixgear.com` DNS points to **Vercel**, that is production. Pages URL remains available but is not the brand domain.
- Render may still serve static `dist` at `*.onrender.com` — customers should use the Vercel/custom domain for speed.

### Roman Urdu — Vercel dashboard (aap ko click karna hai)

1. vercel.com par login
2. **Add New → Project** → GitHub se `asfix-gear` import
3. **Root Directory** = `frontend`
4. Env: `VITE_API_BASE` = `https://asfix-gear.onrender.com/api`
5. **Deploy** dabao
6. Domains mein `asfixgear.com` add karo → registrar par DNS records Vercel ke mutabiq set karo
7. Render pe API chalti rahe — CORS pehle se Vercel allow karta hai

## Option 3: Hostinger / cPanel (Shared Hosting)

Agar aapke paas Hostinger ya koi Pakistani hosting hai:

1. **Frontend build:**
   ```powershell
   cd frontend
   npm run build
   ```
2. `frontend/dist` folder ki files `public_html` mein upload karein
3. Backend ke liye **VPS** ya **Node.js hosting** chahiye — shared hosting par Node.js limited hota hai

> Shared hosting par sirf static site (frontend) aasan hai. Backend ke liye Render use karein.

---

## Option 4: Railway.app

1. https://railway.app par sign up
2. **New Project → Deploy from GitHub**
3. Repo select karein
4. Start command: `NODE_ENV=production node backend/server.js`
5. Build: `npm run install:prod && npm run seed && npm run build`

---

## Deploy ke baad zaroori kaam

| Kaam | Kahan |
|------|-------|
| Shop address update | `frontend/src/config/shop.js` → `address` |
| Phone / Email | Same file — already set |
| Custom domain | Render → Settings → Custom Domains — full guide: [DOMAIN-SETUP.md](./DOMAIN-SETUP.md) |
| SSL (HTTPS) | Free — Render automatic (DNS verify ke baad) |
| Production CORS | Render Environment → `CORS_ORIGIN=https://asfixgear.com,https://www.asfixgear.com` (Render `.onrender.com` URL is auto-allowed via `RENDER_EXTERNAL_URL`) |
| Gmail OTP emails | Render Environment → `RESEND_API_KEY` + `RESEND_FROM` (free tier) **or** `GMAIL_USER` + `GMAIL_APP_PASSWORD` (paid SMTP) — see [Gmail OTP on Render](#gmail-otp-on-render) |
| MongoDB Atlas (optional) | Render Environment → `MONGODB_URI` — see [MongoDB Atlas migration](#mongodb-atlas-migration) |

---

## MongoDB Atlas migration

Phase 1 adds optional MongoDB storage on **`main`**. Without `MONGODB_URI`, the app keeps using `backend/data/data.json` (same as before).

### Local backup before migration

```powershell
npm run backup:data
```

Backup saves to `backups/data-<timestamp>.json`.

### Migrate JSON → MongoDB

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Add a database user and allow your IP (or `0.0.0.0/0` for Render).
3. Copy the connection string and set:

```powershell
$env:MONGODB_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/asfix_gear?retryWrites=true&w=majority"
node scripts/migrate-json-to-mongo.mjs
```

Dry run (no writes):

```powershell
node scripts/migrate-json-to-mongo.mjs --dry-run
```

### Run locally with MongoDB

```powershell
$env:MONGODB_URI="mongodb+srv://..."
npm run dev:backend
```

Health check: `GET /api/health` returns `"storage": "mongodb"`.

### Render production cutover

1. Run `npm run backup:data` on current production (download `data.json` from Render shell if needed).
2. Migrate to Atlas with the script above.
3. Add `MONGODB_URI` to Render Environment.
4. Redeploy from **`main`** (Render dashboard → branch `main`, then Manual Deploy if needed).
5. Verify products, login, orders, and OTP flows after deploy.

Collections: `users`, `sessions`, `products`, `repair_services`, `repair_bookings`, `contact_messages`, `orders`, `verification_codes`, `settings`, `meta`.

---

## Gmail OTP on Render

Customer sign-up and login send a **6-digit code** to `@gmail.com` addresses. Without email env vars, production returns a clear error instead of silently failing.

### Important: Render free tier blocks SMTP

Since **September 2025**, Render **free** web services block outbound SMTP on ports **25, 465, and 587**. Gmail SMTP (`GMAIL_USER` + `GMAIL_APP_PASSWORD`) will **timeout** on free tier even with correct credentials.

**Fix (free tier):** use **Resend** (HTTP API, port 443):

| Variable | Value |
|----------|-------|
| `RESEND_API_KEY` | From [resend.com](https://resend.com) → API Keys |
| `RESEND_FROM` | `"AsFix Gear" <noreply@asfixgear.com>` after domain verify (or `onboarding@resend.dev` for testing) |

**Fix (paid tier):** upgrade Render to any **paid** instance — Gmail SMTP on ports 587/465 works again.

### Option A: Resend (recommended on Render free)

1. Sign up at [resend.com](https://resend.com).
2. Add and verify domain **asfixgear.com** (DNS records in Resend dashboard).
3. Create an API key.
4. Render → Environment → add `RESEND_API_KEY` and `RESEND_FROM`.
5. Redeploy.

### Option B: Gmail SMTP (paid Render or local dev)

1. Sign in to the Google account that will send mail (e.g. `asadshahzad777111@gmail.com`).
2. Enable **2-Step Verification** on the Google account (required for app passwords).
3. Open [Google App Passwords](https://myaccount.google.com/apppasswords).
4. Create a new app password (name it e.g. `AsFix Gear Render`).
5. Copy the **16-character password** (shown as four groups like `abcd efgh ijkl mnop`).

### Step 2: Add environment variables on Render

Render dashboard → your Web Service → **Environment** → add:

| Variable | Value |
|----------|-------|
| `GMAIL_USER` | `asadshahzad777111@gmail.com` |
| `GMAIL_APP_PASSWORD` | Your 16-char app password (spaces optional) |
| `SMTP_FROM` | `"AsFix Gear" <asadshahzad777111@gmail.com>` (optional — defaults to branded sender) |

Save changes and **redeploy** (or wait for auto-deploy).

### Step 3: Test

1. Open your live site → **Sign Up** with a Gmail address.
2. Check inbox (and spam) for an email from **AsFix Gear**.
3. Enter the 6-digit code in the app.

> **Local dev:** Without these vars, the code is printed in the backend console as `[OTP dev] Email to ...` and returned in the API response as `devCode`.

---

## Custom Domain (Optional)

Recommended domain: **asfixgear.com** (+ optional **asfixgear.com.pk**).

**Full step-by-step (Roman Urdu + English):** [DOMAIN-SETUP.md](./DOMAIN-SETUP.md)

**Production (Jul 2026):** brand domain → **Vercel** (see [Option 2](#option-2-vercel-frontend--render-api-fast-ui)). Short Vercel version:

1. Vercel → Domains → `asfixgear.com` + `www`
2. Cloudflare: CNAME `@` + `www` → Vercel DNS target (DNS only)
3. Render Custom Domains se brand domain **remove** if present — API on `asfix-gear.onrender.com` rakhein

Short version (Render — single Web Service **only if you are NOT using Vercel**):

1. Domain kharidein (Cloudflare ~$10/yr, Namecheap, ya Hostinger PK for `.com.pk`)
2. Render → Web Service → **Settings → Custom Domains** → add `asfixgear.com` and `www.asfixgear.com`
3. DNS at registrar:
   - **A** record `@` → `216.24.57.1` (ya **ALIAS** → `your-service.onrender.com`)
   - **CNAME** `www` → `your-service.onrender.com`
   - Remove any **AAAA** records
4. Render **Environment** → `CORS_ORIGIN=https://asfixgear.com,https://www.asfixgear.com` (your `*.onrender.com` URL works automatically — no need to add it)
5. SSL automatic — wait for DNS verify, then open `https://asfixgear.com`

> Single-server Render deploy (Option 1): API same origin hai — `VITE_API_BASE` change ki zaroorat nahi. Split Vercel+Render (production) ke liye Option 2 — **domain Vercel par, API Render par**.

---

## WhatsApp Business Tip

- WhatsApp Business app install karein same number par: **03039227000**
- Business profile mein shop name **AsFix & Gear** rakhein
- Catalog mein products add karein — website se orders aasani se manage honge

---

## Bluetooth thermal printer (Windows + Android)

Vendor ZIP (`PrinterDriver.exe`, `BT-POSPrinter.apk`) **local install only** — never commit binaries. AsFix website already builds **58mm ESC/POS + ESC Z QR**.

- Laptop: USB/SPP COM → `npm run thermal:bridge`, else Chrome **Web Bluetooth**, else iframe.
- Android: prefer **AsFix POS** app; Chrome → **Thermer**; vendor `BT-POSPrinter.apk` = hardware test only.
- iPhone: Print chooser → remote Android/Laptop station (no direct BT thermal).

`npm run thermal:help` · full guide: [docs/thermal-printer-windows.md](docs/thermal-printer-windows.md).

---

## Help

Agar deploy mein koi step atke to mujhe bata dein — main step-by-step help kar dunga.

### Render: `vite: not found` (exit 127)

**Cause:** `NODE_ENV=production` during build → `npm install` skips `devDependencies` (Vite lives there).

**Fix:**
1. Render → Environment → **delete** `NODE_ENV` (Start Command already sets it at runtime).
2. Build Command use karein: `npm run install:prod && npm run seed && npm run build`
3. Redeploy.
