# AsFix & Gear — Custom Domain Setup

**Roman Urdu + English guide** — apna domain kharidein aur Render par live site se connect karein.

Pehle site live honi chahiye. Agar abhi deploy nahi hua, pehle [DEPLOY.md](./DEPLOY.md) follow karein.

---

## Quick summary (English)

| Step | Action |
|------|--------|
| 1 | Buy **asfixgear.com** (optional: **asfixgear.com.pk**) |
| 2 | Render → your Web Service → **Settings → Custom Domains** → add `asfixgear.com` and `www.asfixgear.com` |
| 3 | At your registrar/DNS: **A** or **ALIAS** for `@` (root), **CNAME** for `www` → your `*.onrender.com` URL |
| 4 | Render → **Environment** → set `CORS_ORIGIN=https://asfixgear.com,https://www.asfixgear.com` |
| 5 | Wait for DNS + free SSL (usually 5–30 min) → open `https://asfixgear.com` |

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

### Cloudflare-specific

Cloudflare par **A record use mat karein** root ke liye — Render docs ke mutabiq:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| **CNAME** | `@` | `your-service.onrender.com` | **DNS only** (grey cloud) |
| **CNAME** | `www` | `your-service.onrender.com` | **DNS only** |

SSL verify hone ke baad optional: proxy (orange cloud) on kar sakte hain.

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
| `NODE_ENV` | `production` | Already set hona chahiye |
| `CORS_ORIGIN` | `https://asfixgear.com,https://www.asfixgear.com` | Production CORS — sirf yeh origins allow |
| `PORT` | `5000` (ya Render default) | Usually Render `PORT` auto set karta hai |

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

- **`VITE_API_URL` ki zaroorat nahi** — `frontend/src/api/client.js` already `/api` use karta hai
- Sirf `CORS_ORIGIN` Render par set karein (security best practice)

### Option B: Split deploy — Vercel (frontend) + Render (backend)

Agar frontend alag domain par ho (jaise Vercel):

1. Vercel → Project → **Settings → Environment Variables**
2. Add: `VITE_API_URL` = `https://your-backend.onrender.com` (ya custom API subdomain)
3. `CORS_ORIGIN` on Render mein **Vercel URL** bhi include karein, jaise:
   ```
   https://asfixgear.com,https://www.asfixgear.com,https://your-app.vercel.app
   ```
4. Redeploy **dono** sides

Is project mein abhi split deploy default nahi hai — Option A use karein agar mumkin ho.

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
| "Domain not verified" on Render | DNS records double-check; 30 min wait; `dig asfixgear.com` ya [dnschecker.org](https://dnschecker.org) |
| SSL pending | DNS must point to Render; remove AAAA records |
| Site opens on .onrender.com but not custom domain | Custom domain Render par add kiya? DNS propagated? |
| API 403 Forbidden | `CORS_ORIGIN` exact `https://` URLs — trailing slash nahi |
| www works, root doesn't | Root **A** ya **ALIAS** record missing |
| Cloudflare "too many redirects" | Proxy off (DNS only) during setup |

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

## Roman Urdu — short recap

1. **Domain lo:** `asfixgear.com` — Cloudflare sasta, Hostinger PK agar `.com.pk` chahiye  
2. **Render:** Settings → Custom Domains → `asfixgear.com` + `www` add karo  
3. **DNS:** `@` par A (`216.24.57.1`) ya ALIAS; `www` par CNAME → `tumhara-service.onrender.com`  
4. **Env:** `CORS_ORIGIN=https://asfixgear.com,https://www.asfixgear.com`  
5. **SSL:** Render khud laga deta hai — kuch extra nahi  
6. **Test:** browser mein HTTPS kholo, shop + admin check karo  

Koi step atke to DEPLOY.md aur Render dashboard ke error messages screenshot bhej dein.
