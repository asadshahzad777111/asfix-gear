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

## Option 2: Vercel (Frontend) + Render (Backend)

Agar alag deploy karna ho:

### Backend (Render)
- Root: `backend`
- Start: `node server.js`
- Build: `npm install && node seed.js`

### Frontend (Vercel)
1. https://vercel.com par sign up
2. Import GitHub repo
3. Root Directory: `frontend`
4. Build: `npm run build`
5. Environment variable add karein:
   - `VITE_API_URL` = aapka Render backend URL

> Note: Is option ke liye `frontend/src/api/client.js` mein API URL update karna padega.

---

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

Phase 1 adds optional MongoDB storage on branch `feature/mongodb-store`. Without `MONGODB_URI`, the app keeps using `backend/data/data.json` (same as before).

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
4. Redeploy from `feature/mongodb-store` (do **not** merge to `main` until tested).
5. Verify products, login, orders, and OTP flows on staging first.

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

Short version (Render — single Web Service):

1. Domain kharidein (Cloudflare ~$10/yr, Namecheap, ya Hostinger PK for `.com.pk`)
2. Render → Web Service → **Settings → Custom Domains** → add `asfixgear.com` and `www.asfixgear.com`
3. DNS at registrar:
   - **A** record `@` → `216.24.57.1` (ya **ALIAS** → `your-service.onrender.com`)
   - **CNAME** `www` → `your-service.onrender.com`
   - Remove any **AAAA** records
4. Render **Environment** → `CORS_ORIGIN=https://asfixgear.com,https://www.asfixgear.com` (your `*.onrender.com` URL works automatically — no need to add it)
5. SSL automatic — wait for DNS verify, then open `https://asfixgear.com`

> Single-server Render deploy (Option 1): API same origin hai — `VITE_API_URL` change ki zaroorat nahi. Split Vercel+Render ke liye DOMAIN-SETUP.md dekhein.

---

## WhatsApp Business Tip

- WhatsApp Business app install karein same number par: **03039227000**
- Business profile mein shop name **AsFix & Gear** rakhein
- Catalog mein products add karein — website se orders aasani se manage honge

---

## Help

Agar deploy mein koi step atke to mujhe bata dein — main step-by-step help kar dunga.

### Render: `vite: not found` (exit 127)

**Cause:** `NODE_ENV=production` during build → `npm install` skips `devDependencies` (Vite lives there).

**Fix:**
1. Render → Environment → **delete** `NODE_ENV` (Start Command already sets it at runtime).
2. Build Command use karein: `npm run install:prod && npm run seed && npm run build`
3. Redeploy.
