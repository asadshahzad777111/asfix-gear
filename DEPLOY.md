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
   - **Build Command:** `npm run install:all && npm run seed && npm run build --prefix frontend`
   - **Start Command:** `NODE_ENV=production node backend/server.js`
   - **Environment:** Node
4. **Deploy** dabayein

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
5. Build: `npm run install:all && npm run seed && npm run build --prefix frontend`

---

## Deploy ke baad zaroori kaam

| Kaam | Kahan |
|------|-------|
| Shop address update | `frontend/src/config/shop.js` → `address` |
| Phone / Email | Same file — already set |
| Custom domain | Render → Settings → Custom Domains — full guide: [DOMAIN-SETUP.md](./DOMAIN-SETUP.md) |
| SSL (HTTPS) | Free — Render automatic (DNS verify ke baad) |
| Production CORS | Render Environment → `CORS_ORIGIN=https://asfixgear.com,https://www.asfixgear.com` |

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
4. Render **Environment** → `CORS_ORIGIN=https://asfixgear.com,https://www.asfixgear.com`
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
