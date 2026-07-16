# AsFix & Gear — Custom Domain Setup

**Roman Urdu + English guide** — apna domain kharidein aur Render par live site se connect karein.

Pehle site live honi chahiye. Agar abhi deploy nahi hua, pehle [DEPLOY.md](./DEPLOY.md) follow karein.

---

## Quick summary (English)

**Production (Jul 2026):** Frontend on **Vercel**, API on **Render** (`asfix-gear.onrender.com`).

| Step | Action |
|------|--------|
| 1 | Domain **asfixgear.com** on Cloudflare (already owned) |
| 2 | Vercel → Project **asfix-gear** → **Settings → Domains** → add `asfixgear.com` + `www.asfixgear.com` |
| 3 | Cloudflare DNS → **DNS only** (grey cloud) CNAME records (see [Vercel + Cloudflare](#vercel--cloudflare-jul-2026)) |
| 4 | Render API stays at `asfix-gear.onrender.com` — `VITE_API_BASE` on Vercel already points there |
| 5 | Wait 5–15 min → `https://asfixgear.com` serves Vercel CDN; API calls go to Render |

---

## Recommended domain names

| Domain | Use case |
|--------|----------|
| **asfixgear.com** | Main brand — international, professional (recommended) |
| **www.asfixgear.com** | Same site — add both root and www on Render |
| **asfixgear.com.pk** | Optional — Pakistani customers, local trust |

> Tip: Pehle **.com** lein. Baad mein **.com.pk** redirect kar sakte hain (registrar forwarding) ya alag Render custom domain.

---

## Kahan se kharidein? (Where to buy) + Approx prices

Prices change; yeh **June 2026** ke qareeb estimates hain (first year, no premium add-ons).

| Provider | Best for | .com (USD) | .com (PKR approx.) | .com.pk (PKR approx.) |
|----------|----------|------------|--------------------|-----------------------|
| [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) | Cheapest .com, no markup | ~$10–11/yr | ~₨2,800–3,200 | — (no .pk) |
| [Namecheap](https://www.namecheap.com) | Easy UI, Pakistan-friendly cards | ~$10–13/yr | ~₨2,800–3,700 | — |
| [Hostinger PK](https://www.hostinger.pk) | JazzCash/Easypaisa, .com.pk | ~₨3,000–4,500/yr | same | ~₨1,500–2,500/yr |
| [PKNIC](https://www.pknic.net.pk) | Official .pk registry (via resellers) | — | — | ~₨2,000–3,500/yr |

**Recommendation:**

- **Budget + long term:** Cloudflare par domain register karein (at-cost pricing).
- **Pakistan payment / .com.pk:** Hostinger PK ya local reseller se **asfixgear.com.pk**.
- **Simple checkout:** Namecheap — `.com` ~$10 first year.

Extra costs: privacy/WHOIS often free on Cloudflare & Namecheap. Renewal kabhi pehle se zyada hoti hai — checkout par renewal price check karein.

---

## Prerequisites

1. Site already deployed on **Render** (see [DEPLOY.md](./DEPLOY.md) — Option 1).
2. Aapka Render URL note karein, jaise: `https://asfix-gear.onrender.com`
3. Render service ka **onrender.com** hostname — Custom Domains screen par dikhega, jaise: `asfix-gear.onrender.com`

---

## Step 1: Domain kharidein (Buy the domain)

### Cloudflare (recommended for .com)

1. [cloudflare.com](https://www.cloudflare.com) → sign up / login
2. **Domain Registration** → search `asfixgear.com`
3. Cart → pay → domain aapke account mein add ho jayega
4. DNS automatically Cloudflare par manage hogi

### Namecheap

1. [namecheap.com](https://www.namecheap.com) → search `asfixgear.com` → Add to cart → checkout
2. Dashboard → **Domain List** → **Manage** → **Advanced DNS** tab (Step 3 ke liye)

### Hostinger PK (.com.pk optional)

1. [hostinger.pk](https://www.hostinger.pk) → domain search `asfixgear.com.pk`
2. Pakistani payment methods available
3. hPanel → **DNS / Nameservers** → DNS records edit karein

---

## Step 2: Render par custom domain add karein

1. [dashboard.render.com](https://dashboard.render.com) → login
2. Apni **Web Service** (AsFix & Gear) par click karein
3. Left sidebar → **Settings**
4. Scroll to **Custom Domains** → **Add Custom Domain**
5. Type: `asfixgear.com` → **Save**
6. Phir dubara **Add Custom Domain** → `www.asfixgear.com` → **Save**

Render ab DNS records dikhayega — **copy karein** apna exact target:

- Root (`asfixgear.com`): usually **A → `216.24.57.1`** *or* **ALIAS/ANAME → `your-service.onrender.com`**
- `www`: **CNAME → `your-service.onrender.com`**

> Important: Har service ka `onrender.com` name alag hota hai — apne dashboard wala use karein, example copy mat karein.

---

## Step 3: DNS records lagayein

DNS registrar ya DNS provider (Cloudflare, Namecheap, Hostinger) par yeh records add karein.

### Table — standard setup (Namecheap, Hostinger, most registrars)

| Type | Host / Name | Value / Target | TTL |
|------|-------------|----------------|-----|
| **A** | `@` (root) | `216.24.57.1` | Auto or 300s |
| **CNAME** | `www` | `your-service.onrender.com` | Auto or 300s |

**ALIAS / ANAME (agar provider support kare):** root `@` ke liye A ki jagah **ALIAS** → `your-service.onrender.com` (IP change par auto-update — preferred jahan available ho).

### Vercel + Cloudflare (Jul 2026)

Frontend **Vercel** par hai — DNS **Vercel** ko point karein, Render ko nahi.

Vercel → **Settings → Domains** par exact value confirm karein. Current target:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| **CNAME** | `@` | `33fc1b84b766b58b.vercel-dns-017.com` | **DNS only** (grey cloud) |
| **CNAME** | `www` | `33fc1b84b766b58b.vercel-dns-017.com` | **DNS only** (grey cloud) |

**Cleanup (zaroori):** Purane records delete karein jo conflict karein:
- **A** `@` → `216.24.57.1` (Render)
- **CNAME** `www` → `*.onrender.com` ya GitHub Pages
- **AAAA** records (IPv6)

SSL verify hone ke baad optional: proxy (orange cloud) on kar sakte hain.

### Cloudflare + Render only (legacy single-server)

Agar poori site sirf Render par ho (Option 1 [DEPLOY.md](./DEPLOY.md)):

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| **CNAME** | `@` | `your-service.onrender.com` | **DNS only** (grey cloud) |
| **CNAME** | `www` | `your-service.onrender.com` | **DNS only** |

Full guide: [Render — Configure Cloudflare DNS](https://render.com/docs/configure-cloudflare-dns)

### Cleanup (zaroori)

- Purane **A** / **CNAME** records jo conflict karein — delete karein
- **AAAA** (IPv6) records **remove** karein — Render IPv6 support nahi karta; site break ho sakti hai

### DNS propagate

- 5–30 minutes usual; kabhi 24–48 hours
- Render dashboard → Custom Domains → **Verified** + certificate **Issued** dikhna chahiye

---

## Step 4: SSL (HTTPS) — automatic

Render **free SSL** deta hai (Let's Encrypt).

- Aapko alag se certificate kharidne ki zaroorat nahi
- DNS sahi hone ke baad Render automatically HTTPS enable karta hai
- Browser mein `https://asfixgear.com` kholein — padlock check karein

---

## Step 5: Environment variables (Render dashboard)

Render → Web Service → **Environment** → add / update:

| Variable | Value | Kyun zaroori? |
|----------|-------|----------------|
| `CORS_ORIGIN` | `https://asfixgear.com,https://www.asfixgear.com` | Production CORS — sirf yeh origins allow |
| `PORT` | `5000` (ya Render default) | Usually Render `PORT` auto set karta hai |

> **`NODE_ENV` env var mat add karein.** Start Command (`NODE_ENV=production node backend/server.js`) runtime par production set karti hai. Agar dashboard mein `NODE_ENV=production` ho to build step devDependencies (Vite) skip kar sakta hai → `vite: not found`. Purana var ho to delete karein aur redeploy.

**CORS_ORIGIN format:** comma-separated, **no spaces** (spaces trim ho jati hain code mein, lekin clean rakhein):

```
https://asfixgear.com,https://www.asfixgear.com
```

Save ke baad Render **redeploy** karega — 1–2 min wait karein.

### Admin password (deploy ke baad)

Default seed password production par change karein:

```powershell
cd C:\Users\asads\asfix-gear
npm run reset-admin
```

Phir seed / data sync strategy apni deploy setup ke mutabiq (local reset Render data file ko directly change nahi karta agar persistent disk alag ho).

---

## Frontend API URL — kya change chahiye?

### Option A: Single server on Render (recommended — [DEPLOY.md](./DEPLOY.md) Option 1)

Frontend aur API **same origin** par hain (`asfixgear.com` + `/api`).

- **`VITE_API_BASE` ki zaroorat nahi** — `frontend/src/api/client.js` default `/api` use karta hai
- Sirf `CORS_ORIGIN` Render par set karein (security best practice)

### Option B: Split deploy — Vercel (frontend) + Render (backend)

Agar UI **Vercel** par ho aur API **Render** par (fast CDN — see [DEPLOY.md Option 2](./DEPLOY.md#option-2-vercel-frontend--render-api-fast-ui)):

1. Vercel → Project → **Settings → Environment Variables**
2. Add: `VITE_API_BASE` = `https://asfix-gear.onrender.com/api` (must include `/api`)
3. Vercel → **Settings → Domains** → add `asfixgear.com` + `www` → set DNS at registrar to **Vercel** (not Render)
4. Backend CORS already allows `asfixgear.com`, `www`, and `https://*.vercel.app`. Optional extra origins via Render `CORS_ORIGIN`
5. Redeploy Vercel after env change (Vite bakes `VITE_*` at build time)

**GitHub Pages:** production domain should point to Vercel once ready; Pages can stay as a backup URL.

---

## Step 6: Test checklist

- [ ] `https://asfixgear.com` — home page load
- [ ] `https://www.asfixgear.com` — same site (ya redirect — Render "redirect www" option check karein)
- [ ] Shop, repair form, contact — submit test
- [ ] `https://asfixgear.com/api/health` — `{"status":"ok",...}`
- [ ] Admin login staff panel
- [ ] Mobile par site + WhatsApp link

---

## Optional: .com.pk domain

1. Hostinger PK / PKNIC reseller se **asfixgear.com.pk** kharidein
2. Render → Custom Domains → `asfixgear.com.pk` add karein
3. Same DNS pattern: **A** `@` → `216.24.57.1`, **CNAME** `www` → `your-service.onrender.com`
4. `CORS_ORIGIN` mein add karein:
   ```
   https://asfixgear.com,https://www.asfixgear.com,https://asfixgear.com.pk,https://www.asfixgear.com.pk
   ```

Ya **.com.pk** ko registrar **domain forwarding** se `https://asfixgear.com` par redirect karein (simpler, ek hi site).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Vercel **Invalid Configuration** (Jul 2026) | DNS abhi Vercel par nahi — check: `nslookup asfixgear.com` agar `185.199.x.x` (GitHub Pages) dikhe to Cloudflare mein purane records delete karo aur Vercel CNAME lagao (table upar) |
| `www` CNAME → `*.github.io` | Delete karo; replace with `33fc1b84b766b58b.vercel-dns-017.com` (DNS only) |
| Apex **A** → `185.199.108.153` etc. | GitHub Pages — delete; add CNAME `@` → Vercel target (Cloudflare CNAME flattening) |
| "Domain not verified" on Render | DNS records double-check; 30 min wait; `dig asfixgear.com` ya [dnschecker.org](https://dnschecker.org) |
| SSL pending | DNS must point to Vercel/Render; remove conflicting AAAA |
| Site opens on `.vercel.app` but not custom domain | Cloudflare DNS updated? Vercel Domains → **Refresh** |
| API 403 Forbidden | `CORS_ORIGIN` exact `https://` URLs — trailing slash nahi |
| www works, root doesn't | Root CNAME `@` missing ya purana A record baqi hai |
| Cloudflare "too many redirects" | Proxy off (DNS only) during setup |

### Current DNS state (checked Jul 16, 2026)

| Record | Current (broken) | Required (Vercel) |
|--------|------------------|-------------------|
| `@` apex | A → `185.199.108–111.153` (GitHub Pages) | CNAME → `33fc1b84b766b58b.vercel-dns-017.com` |
| `www` | CNAME → `asadshahzad777111.github.io` | CNAME → `33fc1b84b766b58b.vercel-dns-017.com` |
| NS | `leanna.ns.cloudflare.com`, `luke.ns.cloudflare.com` | (unchanged — Cloudflare) |

Until Cloudflare records change, `https://asfixgear.com` serves **GitHub Pages**; `https://asfix-gear.vercel.app` serves **Vercel** (correct).

---

## Backend CORS — how it works (for developers)

`backend/middleware/security.js` → `getCorsOptions()`:

- `CORS_ORIGIN` env var ko **comma-separated** list ki tarah parse karta hai
- Production mein sirf listed origins allow hote hain
- Development mein sab origins allow (local `npm run dev`)

Example `.env` (local testing only — production values Render dashboard par):

```
CORS_ORIGIN=https://asfixgear.com,https://www.asfixgear.com
```

See also: [.env.example](./.env.example)

---

## Related docs

- [DEPLOY.md](./DEPLOY.md) — pehli deploy Render par
- [Render custom domains](https://render.com/docs/custom-domains)
- [Render DNS (other providers)](https://render.com/docs/configure-other-dns)

---

## Roman Urdu — short recap (Vercel + Render)

1. **Vercel:** Project `asfix-gear` → Domains → `asfixgear.com` + `www` add (ho chuka)  
2. **Cloudflare:** `asfixgear.com` → **DNS → Records**  
3. **Delete:** purana A `216.24.57.1`, purana CNAME `onrender` / GitHub Pages  
4. **Add:** CNAME `@` aur `www` → `33fc1b84b766b58b.vercel-dns-017.com` — proxy **grey** (DNS only)  
5. **Vercel:** Domains page par **Refresh** → **Valid Configuration**  
6. **5–15 min wait** → `https://asfixgear.com` Vercel se load hoga; API Render par rahegi  

### Cloudflare click-by-click (Roman Urdu)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → login  
2. **asfixgear.com** par click  
3. Left menu → **DNS** → **Records**  
4. Har purana record jisme `@` ya `www` ho aur Render/GitHub target ho → **Edit** → **Delete**  
5. **Add record** → Type **CNAME**, Name **@**, Target `33fc1b84b766b58b.vercel-dns-017.com`, Proxy **DNS only** (grey cloud) → **Save**  
6. Dubara **Add record** → Type **CNAME**, Name **www**, same Target, same grey proxy → **Save**  
7. Vercel → Domains → **Refresh**  

Koi step atke to DEPLOY.md aur dashboard screenshot bhej dein.
