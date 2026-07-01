# AsFix & Gear — Complete Website Prompt (A to Z)

> **Yeh document poori website ka master prompt hai** — koi developer is se site dubara bana ya maintain kar sakta hai.  
> **Brand:** AsFix & Gear · **Owner:** Asad Shahzad · **Shop phone:** 03039227000 · **Email:** asadshahzad777111@gmail.com

---

## 1. Project overview

AsFix & Gear is a full-stack e-commerce + repair booking website for a Lahore mobile repair and accessories shop. It combines:

- **Shop mode** — phone accessories (cases, chargers, earbuds, etc.)
- **Gaming mode** — PUBG / Free Fire / COD Mobile gear (triggers, grips, cooling fans)
- **Repair lab** — intake form, service cards, screen quality picker
- **Staff ops** — admin panel, floating Ops desk, team management, sales reports
- **Customer accounts** — OTP signup/login, order history, feedback

**Live stack:** React 19 + Vite frontend, Express backend, JSON file storage (`backend/data/data.json`), deployed on **Render.com** with **Cloudflare** domain (**asfixgear.com**).

---

## 2. Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router |
| Styling | Custom CSS (themes, gaming, premium, mobile-nav, responsive) |
| Backend | Node.js, Express (ES modules) |
| Storage | JSON file (`backend/data/data.json`) — not SQLite |
| Auth | scrypt password hashing, bearer tokens in `sessions` |
| Email OTP | nodemailer + Gmail App Password |
| Phone OTP | Twilio SMS (optional) → WhatsApp fallback |
| Deploy | Render Web Service (single server: API + static frontend) |
| Domain | Cloudflare Registrar + Render custom domains |
| CI | GitHub Actions (`ci.yml`, `deploy-hint.yml`) |

---

## 3. Repository & commands

```powershell
cd C:\Users\asads\asfix-gear

# Install
npm run install:all

# Seed products, repair services, default admin
npm run seed

# Dev (frontend :5173 + backend :5000)
npm run dev

# Production build (frontend only)
npm run build

# i18n key parity check (en / roman / ur)
npm run check:i18n

# Secrets scan before merge
npm run check:secrets

# Reset super admin password (after deploy)
npm run reset-admin
```

**Render build command:** `npm run install:prod && npm run seed && npm run build`  
**Render start command:** `NODE_ENV=production node backend/server.js`

---

## 4. Shop configuration

**File:** `frontend/src/config/shop.js`

| Field | Value |
|-------|-------|
| Shop name | AsFix & Gear |
| Owner | Asad Shahzad |
| Phone | 03039227000 |
| Phone intl (WhatsApp) | 923039227000 |
| Email | asadshahzad777111@gmail.com |
| Hours | Daily 9:00 AM – 9:00 PM |
| Location | Lahore, Pakistan (Google Maps pin) |
| Coordinates | 31.59375, 74.46745 |

Helper functions: `whatsappLink()`, `orderProductOnWhatsApp()`, `generalWhatsAppMessage()`, `directionsWhatsApp()`, `isShopOpen()`.

---

## 5. Dual mode: Shop + Gaming

### Shop mode (default)
- Home, Shop, Repair, Contact, Track Order
- Light/dark theme toggle
- Ambient animated background
- No gaming products on home featured grid (Gaming category filtered out)

### Gaming mode
- Route: `/gaming`
- RedMagic-inspired dark UI (`gaming.css`, `app--gaming`)
- Gaming transition animation + sound effects (`utils/gamingSound.js`)
- Gaming product cards, marquee, PUBG tags
- Entry via **Gaming Mode** button in nav; exit via **Exit Gaming** button
- WhatsApp float hidden in gaming mode

**Context:** `GamingContext.jsx` — `isGamingPage`, enter/exit gaming.

---

## 6. Internationalization (i18n)

**Languages:** `en` (English), `roman` (Roman Urdu), `ur` (Urdu script)

**Files:**
- `frontend/src/locales/translations.js` — all strings
- `frontend/src/context/LanguageContext.jsx` — `useTranslation()`, `t(key, vars)`
- `frontend/src/components/LanguageToggle.jsx` — drawer + desktop toggle
- `scripts/check-i18n.js` — verifies all 3 langs share identical keys

Nav labels: Home, Shop, Repair, Gaming, Track, **Rabta** (Contact).

---

## 7. Home page UX

**File:** `frontend/src/pages/Home.jsx`

Sections (top to bottom):
1. **Hero** — "Broken Phone? / AsFix It." bento layout, shop gear CTA, open badge (no duplicate WhatsApp/phone in hero)
2. **Marquee** — scrolling service tags
3. **Features** — 4 glass cards (expert repair, quality gear, same day, Asad's promise)
4. **How it works** — `RepairSteps` (4 steps)
5. **Repair services** — grid of `RepairServiceCard` (max 6)
6. **Featured shop products** — non-Gaming only, max 4
7. **Location** — `LocationSection` with map embed, directions, contact details

**Floating UI (not on home content):**
- `FloatingRepairButton` — 🔧 repair shortcut (hidden on `/repair`, `/gaming`, `/admin`)
- `WhatsAppButton` — global float (still on site; home hero/CTA duplicates removed)
- `FloatingCart` — premium cart drawer
- `GamingModeButton` — enter gaming zone

**Removed from home (by design):** bottom CTA card below map ("Phone Fix + Gear = AsFix & Gear" + WhatsApp phone), hero WhatsApp button, phone number in hero description.

---

## 8. Pages & routes

**Router:** `frontend/src/components/premium/PageTransition.jsx`

| Path | Page | Auth |
|------|------|------|
| `/` | Home | Public |
| `/shop` | Shop catalog | Public |
| `/shop/:id` | Product detail | Public |
| `/repair` | Repair booking | Public |
| `/gaming` | Gaming zone | Public |
| `/contact` | Contact form | Public |
| `/track` | Order tracking | Public (order ID) |
| `/account/login` | Customer login | Public |
| `/account/register` | Customer signup (OTP) | Public |
| `/account` | Customer dashboard | Customer only |
| `/account/settings` | Profile / password | Customer only |
| `/login` | Staff login | Public |
| `/admin` | Admin panel | Staff only |

---

## 9. Authentication & roles

### Staff roles (`frontend/src/config/permissions.js`)

| Role | Login | Permissions |
|------|-------|-------------|
| **super_admin** | Gmail + password | Full access + Team Access |
| **admin** | Gmail + password | Products, orders, repairs, sales — no team |
| **editor** (Staff Editor) | Gmail + password | View/update orders & repairs — no delete, no team |

### Customer role
- `customer` — OTP-verified signup, cart/checkout, order history

### Default super admin (seed only — change after deploy)

| Field | Value |
|-------|-------|
| Username | `asad` |
| Email | `asadshahzad777111@gmail.com` |
| Password | `AsFix2026!` (or `ADMIN_PASSWORD` env var) |

```powershell
npm run reset-admin   # uses ADMIN_PASSWORD env or default above
```

**Security:**
- Passwords hashed with scrypt (`backend/auth/crypto.js`)
- Tokens in `localStorage` key `asfix_auth_token`
- Sessions expire on inactivity
- Staff routes use `requireAuth` + `requireRole` middleware
- Login rate-limited (`authLimiter`)

See also: `STAFF-ACCESS.md`

---

## 10. Customer OTP signup & login

### Gmail (primary)
1. `POST /api/auth/register/start` — sends 6-digit code via Gmail SMTP
2. `POST /api/auth/register/verify` — verifies code, creates account

### Phone login
1. `POST /api/auth/login/otp/start` — SMS via Twilio (if configured)
2. WhatsApp fallback link if SMS unavailable
3. `POST /api/auth/login/otp/verify` — verifies code

**Dev mode:** OTP printed in backend console + returned as `devCode` when SMTP/SMS not configured.

**Components:** `AccountRegister.jsx`, `AccountLogin.jsx`, `OtpInput.jsx`

---

## 11. Cart, checkout & payments

**Login required** for cart checkout (`CartContext`, `CustomerLoginModal`, `useShopGate`).

**Payment methods (no COD):**
- **JazzCash** — send to 03039227000, name **ASAD SHAHZAD**
- **Easypaisa** — same number and merchant name

**Checkout flow** (`FloatingCart.jsx`):
1. Cart review
2. Delivery details (name, phone, city)
3. Payment method selection + wallet instructions
4. Confirm → `POST /api/orders` (auth required)

After order: receipt text + WhatsApp link (`utils/receipts.js`), order ID for tracking.

---

## 12. Order tracking & feedback

- **Track:** `/track` — `GET /api/orders/track?order_id=...`
- **Timeline:** `OrderTimeline.jsx` — status steps
- **Feedback:** `OrderFeedbackForm.jsx` — `POST /api/orders/feedback` (rating + comment per order)

Order statuses include: pending, payment_verified, processing, shipped, delivered, cancelled (with `status_history`).

---

## 13. Repair booking

**Page:** `Repair.jsx` + `RepairIntakeForm.jsx`

- Service list from `GET /api/repairs/services`
- Device brand/model picker, issue types, screen quality tiers
- `ScreenQualityPicker.jsx` — Low/Medium/High screen options
- `POST /api/repairs/book` — creates booking with ref
- Success panel + optional WhatsApp intake message
- Staff manage bookings in Admin / Ops desk

---

## 14. Admin panel & Ops desk

### `/admin` page (`Admin.jsx`)
- Products CRUD (staff)
- Repair bookings list + status updates
- Discount panel (`AdminDiscountPanel.jsx`)
- Sales report (`AdminSalesReport.jsx`) — day/week/range, profit from `cost_price`
- Team tab (`AdminManagement.jsx`) — super_admin only
- Chat inbox (`AdminChatInbox.jsx`) — contact message replies

### Floating Ops desk (`AdminFloatingDashboard.jsx`)
- Quick view: new orders, repair bookings
- Status updates, activity log
- Tabs: Orders, Repairs, Team (super_admin)
- Visibility polling when tab visible (`startVisibilityPoll`)

### Staff toolbar (`StaffToolbar.jsx`)
- Quick actions for logged-in staff

### Shop status (`ShopStatusControl.jsx`)
- Manual open/closed override
- `GET/PATCH /api/shop/status`

---

## 15. Sales & profit tracking

- Products have `price`, `cost_price`, `stock`, `discount_percent`
- `getSalePrice()` / `hasDiscount()` in `utils/pricing.js`
- Low stock threshold: 5 (`LOW_STOCK_THRESHOLD`)
- Sales report API: `GET /api/admin/sales-report?period=day|week|range`
- CSV export in `AdminSalesReport.jsx`
- Profit = sale price − cost_price per line item

---

## 16. Mobile UX, sounds & animations

- **Mobile nav drawer** — thumb-friendly (`mobile-nav.css`, `useNavDrawerThumb.js`)
- **Nav thumb sound** — `utils/navThumbSound.js`
- **Button effects** — ripple/liquid (`ButtonEffects.jsx`, `premium.css`)
- **Fly-to-cart** animation — `FlyToCart.jsx`
- **Scroll reveal** — `useScrollReveal.js`
- **Page transitions** — `PageTransition.jsx`
- **Gaming sounds** — enter/exit gaming mode
- **Responsive floats** — cart, WhatsApp, repair FAB positions (`responsive-floats.css`)
- **Theme toggle** — light/dark (`ThemeContext.jsx`)

---

## 17. WhatsApp integration

WhatsApp is used across the site (not duplicated on home hero/CTA):

| Location | Purpose |
|----------|---------|
| Navbar drawer | Contact option |
| Global float button | Quick message |
| Product cards / detail | Order inquiry |
| Repair service cards | Price quote |
| Cart / order success | Receipt send |
| Location section | Directions + message |
| OTP fallback | Phone verification link |

**Number:** 923039227000 (03039227000)

---

## 18. Environment variables

**File:** `.env.example` (copy to `.env` — never commit `.env`)

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` at runtime (not during Render build) |
| `PORT` | Default 5000 |
| `CORS_ORIGIN` | `https://asfixgear.com,https://www.asfixgear.com` |
| `GMAIL_USER` | Gmail for OTP emails |
| `GMAIL_APP_PASSWORD` | 16-char app password |
| `SMTP_FROM` | Optional branded sender |
| `SMTP_HOST/PORT/USER/PASS` | Custom SMTP alternative |
| `TWILIO_ACCOUNT_SID` | SMS OTP |
| `TWILIO_AUTH_TOKEN` | SMS OTP |
| `TWILIO_PHONE_NUMBER` | SMS sender |
| `TWILIO_WHATSAPP_FROM` | WhatsApp OTP fallback |
| `WHATSAPP_TOKEN` | Meta Cloud API fallback |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Cloud API |
| `SHOP_WHATSAPP_INTL` | Dev manual WhatsApp link (default 923039227000) |
| `ADMIN_PASSWORD` | Seed/reset admin password |
| `RENDER_EXTERNAL_URL` | Auto-allowed in CORS on Render |

---

## 19. Deploy (Render + Cloudflare)

1. Push repo to GitHub
2. Render → Web Service → connect repo
3. Build: `npm run install:prod && npm run seed && npm run build`
4. Start: `NODE_ENV=production node backend/server.js`
5. Set `CORS_ORIGIN` after custom domain
6. Set Gmail OTP vars for customer signup
7. Run `npm run reset-admin` locally against production data OR set `ADMIN_PASSWORD` before first seed
8. Cloudflare: register **asfixgear.com**, point DNS to Render (A/CNAME)
9. Render → Custom Domains → add root + www

**Guides:** `DEPLOY.md`, `DOMAIN-SETUP.md`

---

## 20. File structure

```
asfix-gear/
├── backend/
│   ├── server.js              # Express entry, static serve in prod
│   ├── store.js               # JSON CRUD, orders, sales report
│   ├── seed.js                # Sample products & services
│   ├── seed-admin.js          # Default super admin
│   ├── reset-admin-password.js
│   ├── data/data.json         # Live data (gitignored in prod)
│   ├── auth/
│   │   ├── crypto.js          # scrypt hash, tokens
│   │   └── otp.js             # OTP generation/verify
│   ├── middleware/
│   │   ├── auth.js            # requireAuth, requireRole
│   │   ├── rateLimit.js       # api, auth, write, otp limiters
│   │   └── security.js        # CORS, headers
│   ├── routes/
│   │   ├── auth.js            # login, register, OTP, team CRUD
│   │   ├── products.js
│   │   ├── orders.js
│   │   ├── repairs.js
│   │   ├── contact.js
│   │   ├── shop.js
│   │   └── admin.js           # sales report
│   └── services/
│       └── otpDelivery.js     # email, SMS, WhatsApp OTP
├── frontend/
│   ├── src/
│   │   ├── pages/             # Home, Shop, Gaming, Admin, Account, etc.
│   │   ├── components/        # UI, admin, gaming, premium
│   │   ├── context/           # Auth, Cart, Gaming, Language, Theme, ShopStatus
│   │   ├── config/            # shop.js, permissions, repairIntake
│   │   ├── locales/           # translations.js
│   │   ├── api/client.js      # fetch wrapper + auth header
│   │   └── utils/             # pricing, receipts, stock, sounds
│   └── dist/                  # Vite build output (prod)
├── scripts/
│   ├── check-i18n.js
│   └── check-secrets.js
├── DEPLOY.md
├── DOMAIN-SETUP.md
├── STAFF-ACCESS.md
├── WEBSITE-FULL-PROMPT.md     # this file
└── package.json
```

---

## 21. API routes summary

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Shop stats |
| GET | `/api/products` | List products (`?featured=true`, `?category=`) |
| GET | `/api/products/:id` | Product detail |
| GET | `/api/products/categories` | Categories |
| GET | `/api/repairs/services` | Repair services |
| POST | `/api/repairs/book` | Book repair |
| POST | `/api/contact` | Contact message |
| POST | `/api/auth/login` | Staff password login |
| POST | `/api/auth/register/start` | Customer OTP start |
| POST | `/api/auth/register/verify` | Customer OTP verify |
| POST | `/api/auth/login/otp/start` | Phone OTP start |
| POST | `/api/auth/login/otp/verify` | Phone OTP verify |
| GET | `/api/orders/track` | Track order by ID |
| POST | `/api/orders/feedback` | Order feedback |
| GET | `/api/shop/status` | Shop open/closed |

### Customer (auth + role: customer)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Logout |
| PATCH | `/api/auth/profile` | Update profile |
| PATCH | `/api/auth/change-password` | Change password |
| GET | `/api/auth/my-orders` | Order history |
| GET | `/api/auth/my-messages` | Contact messages |
| POST | `/api/orders` | Place order |

### Staff (auth + staff role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/products` | Add product |
| PUT | `/api/products/:id` | Update product |
| PATCH | `/api/products/:id/discount` | Set discount |
| DELETE | `/api/products/:id` | Delete (admin/super_admin) |
| GET | `/api/repairs/bookings` | All bookings |
| PATCH | `/api/repairs/bookings/:id/status` | Update booking |
| GET | `/api/orders` | All orders |
| PATCH | `/api/orders/:id/status` | Update order status |
| GET | `/api/contact` | All messages |
| PATCH | `/api/contact/:id/reply` | Reply to message |
| PATCH | `/api/shop/status` | Shop override (admin+) |
| GET | `/api/admin/sales-report` | Sales & profit report |

### Super admin only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/users` | List team |
| POST | `/api/auth/users` | Create staff |
| PATCH | `/api/auth/users/:id/block` | Block/unblock |
| PATCH | `/api/auth/users/:id/reset-password` | Reset password |
| DELETE | `/api/auth/users/:id` | Remove staff |

---

## 22. Data model (`data.json`)

```json
{
  "meta": { "nextProductId", "nextOrderId", "nextUserId", ... },
  "users": [{ "id", "name", "email", "username", "password_hash", "role", "blocked", ... }],
  "sessions": [{ "token", "user_id", "expires_at" }],
  "products": [{ "id", "name", "category", "price", "cost_price", "stock", "discount_percent", "featured", ... }],
  "repair_services": [{ "id", "name", "description", "icon" }],
  "repair_bookings": [{ "id", "booking_ref", "customer_name", "phone", "device", "issues", "status", ... }],
  "orders": [{ "id", "order_id", "items", "total", "payment_mode", "shipping_status", "feedback", ... }],
  "contact_messages": [{ "id", "name", "email", "message", "staff_reply", ... }],
  "verification_codes": [{ "email/phone", "code", "expires_at" }],
  "settings": { "shop": { "manual_override", "updated_at" } }
}
```

**Never commit** production `data.json` with real customer data or password hashes.

---

## 23. Security checklist

- [ ] Change default admin password after deploy (`npm run reset-admin`)
- [ ] Set `CORS_ORIGIN` to exact domain(s) in production
- [ ] Configure Gmail OTP on Render
- [ ] Run `npm run check:secrets` before merge
- [ ] Keep `.env` out of git
- [ ] JSON body limit 256kb
- [ ] Rate limits on auth, OTP, write endpoints
- [ ] Staff Gmail-only for team accounts (`@gmail.com`)
- [ ] Generic error messages to clients (no stack traces)

---

## 24. Recreate-from-scratch prompt (for AI / new dev)

```
Build "AsFix & Gear" — a Lahore mobile repair + accessories shop website.

Stack: React 19 + Vite frontend, Express + JSON file backend, single Render deploy.

Features:
- Dual Shop/Gaming modes with separate UI themes
- i18n: English, Roman Urdu, Urdu
- Home: hero, features, repair steps, services, featured products (no gaming), map — no duplicate WhatsApp on hero
- Shop catalog with categories, search, discounts, stock
- Gaming page with PUBG-style UI and products
- Repair intake form with screen quality tiers
- Customer OTP signup (Gmail 6-digit) and phone OTP (SMS + WhatsApp fallback)
- Login required for cart; JazzCash/Easypaisa only (03039227000, ASAD SHAHZAD) — no COD
- Order tracking, WhatsApp receipts, customer feedback
- Staff auth: super_admin, admin, editor — Team Access for super_admin
- Admin panel + floating Ops desk: orders, repairs, products, sales/profit report
- Mobile nav drawer, sounds, animations, floating repair button, theme toggle
- Deploy on Render with Cloudflare domain asfixgear.com
- Env: GMAIL_USER, GMAIL_APP_PASSWORD, CORS_ORIGIN
- Default admin: asad / AsFix2026! (change after deploy)

Shop: Asad Shahzad, 03039227000, asadshahzad777111@gmail.com, Lahore, 9AM–9PM daily.
```

---

## 25. Related docs

| File | Contents |
|------|----------|
| `DEPLOY.md` | Render deploy, Gmail OTP, troubleshooting |
| `DOMAIN-SETUP.md` | Cloudflare + custom domain DNS |
| `STAFF-ACCESS.md` | Team roles, Team Access UI |
| `README.md` | Quick start (may be outdated on DB — use JSON per this doc) |
| `.cursor/rules/` | Security and QA rules for contributors |

---

*Last updated: July 2026 — matches AsFix & Gear codebase at repo root.*
