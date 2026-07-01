# AsFix & Gear — Complete Website Prompt (A to Z)

> **Yeh document poori website ka master prompt hai** — koi developer ya AI is se site maintain, update, ya dubara bana sakta hai.  
> **Brand:** AsFix & Gear · **Owner:** Asad Shahzad · **Shop phone:** 03039227000 · **Email:** asadshahzad777111@gmail.com · **Domain:** asfixgear.com

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Tech stack](#2-tech-stack)
3. [Repository & commands](#3-repository--commands)
4. [Shop configuration](#4-shop-configuration)
5. [Dual mode: Shop + Gaming](#5-dual-mode-shop--gaming)
6. [Internationalization (i18n)](#6-internationalization-i18n)
7. [Home page UX](#7-home-page-ux)
8. [Every page & route](#8-every-page--route)
9. [Authentication & roles](#9-authentication--roles)
10. [Customer OTP signup & login](#10-customer-otp-signup--login)
11. [Shop flow: login gate, cart, checkout, payments, stock](#11-shop-flow-login-gate-cart-checkout-payments-stock)
12. [Gaming mode](#12-gaming-mode)
13. [Repair system](#13-repair-system)
14. [Contact / Rabta & WhatsApp prefill flow](#14-contact--rabta--whatsapp-prefill-flow)
15. [Admin panel & Ops desk](#15-admin-panel--ops-desk)
16. [Sales & profit tracking](#16-sales--profit-tracking)
17. [Mobile UX, sounds & animations](#17-mobile-ux-sounds--animations)
18. [Environment variables](#18-environment-variables)
19. [Deploy (Render + Cloudflare)](#19-deploy-render--cloudflare)
20. [File structure](#20-file-structure)
21. [API routes (complete)](#21-api-routes-complete)
22. [Data model (`data.json`)](#22-data-model-datajson)
23. [How to change common things](#23-how-to-change-common-things)
24. [Default credentials](#24-default-credentials)
25. [Git & deploy commands](#25-git--deploy-commands)
26. [Security checklist](#26-security-checklist)
27. [Recent changes changelog](#27-recent-changes-changelog)
28. [Recreate-from-scratch prompt](#28-recreate-from-scratch-prompt-for-ai--new-dev)
29. [Related docs](#29-related-docs)

---

## 1. Project overview

AsFix & Gear is a full-stack e-commerce + repair booking website for a Lahore mobile repair and accessories shop.

**Kya kya hai is site par (shop owner ke liye):**

| Feature | Roman Urdu summary |
|---------|-------------------|
| **Shop** | Phone accessories — cases, chargers, earbuds, power banks, etc. |
| **Gaming** | PUBG / Free Fire gear — triggers, grips, cooling fans (alag dark UI) |
| **Repair lab** | Online intake form, screen quality picker, model-wise quote links |
| **Customer accounts** | Gmail OTP signup, phone OTP login, order history, feedback |
| **Staff ops** | Admin panel, floating Ops desk, team management, sales/profit report |
| **Rabta (Contact)** | Form + WhatsApp — ab sab WhatsApp buttons pehle Contact page par prefilled message ke sath jate hain |

**Live stack:** React 19 + Vite frontend, Express backend, JSON file storage (`backend/data/data.json`), deployed on **Render.com** with **Cloudflare** domain (**asfixgear.com**).

---

## 2. Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router, Framer Motion |
| Styling | Custom CSS (`themes.css`, `gaming.css`, `premium.css`, `mobile-nav.css`, `responsive-floats.css`, etc.) |
| Backend | Node.js, Express (ES modules) |
| Storage | JSON file (`backend/data/data.json`) — **not** SQLite or MongoDB |
| Auth | scrypt password hashing, bearer tokens in `sessions` table inside JSON |
| Email OTP | nodemailer + Gmail App Password |
| Phone OTP | Twilio SMS (optional) → WhatsApp fallback link |
| Deploy | Render Web Service (single server: API + static frontend) |
| Domain | Cloudflare Registrar + Render custom domains |
| CI | GitHub Actions (`ci.yml`, `deploy-hint.yml`) |

**Context providers** (`frontend/src/main.jsx`): `ThemeProvider`, `LanguageProvider`, `AuthProvider`, `ShopStatusProvider`, `GamingProvider`, `CartProvider`.

---

## 3. Repository & commands

```powershell
cd C:\Users\asads\asfix-gear

# Install all dependencies (backend + frontend)
npm run install:all

# Seed products, repair services, default super admin
npm run seed

# Dev — frontend :5173 + backend :5000
npm run dev

# Production build (frontend only → frontend/dist)
npm run build

# i18n key parity check (en / roman must match)
npm run check:i18n

# Secrets scan before merge
npm run check:secrets

# Reset super admin password (after deploy)
npm run reset-admin
```

**Render build command:** `npm run install:prod && npm run seed && npm run build`  
**Render start command:** `NODE_ENV=production node backend/server.js`

> **Important:** `NODE_ENV=production` ko Render **Environment Variables** mein build time par mat lagayein — warna `vite: not found` aata hai. Start command production set karti hai.

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

**Helper functions:**

| Function | Purpose |
|----------|---------|
| `whatsappLink(message)` | Direct `wa.me` link (Contact form "Send WhatsApp" button) |
| `orderProductContactPath(product)` | `/contact?subject=...&message=...` for product inquiry |
| `generalContactPath()` | General inquiry prefill |
| `directionsContactPath()` | Visit shop / directions prefill |
| `gamingContactPath()` | Gaming gear order prefill |
| `isShopOpen()` | Client-side hours check (9–21) |

**Shop owner note:** Phone, email, address, hours sab `shop.js` se aate hain — ek jagah change karein, poori site update ho jati hai.

### Shop mega menu (`ShopMegaMenu.jsx`, desktop only)

Two-level hover/click menu in the navbar's "Shop" trigger, 3 columns:

1. **Categories** — from `SHOP_CATEGORIES` (`products.js`), links to `/shop?category=...`
2. **Brands** — from `SHOP_BRANDS` (`products.js`, **14 brands**: iPhone, Samsung, OnePlus, Xiaomi/Redmi/POCO, Vivo/iQOO, Oppo, Infinix, Tecno, Google Pixel, Realme, Motorola, Nothing, Honor, Itel); hovering/clicking a brand swaps the 3rd column
3. **Models** — device models for the active brand, grouped by series with sub-headers, sourced via `getSeriesForShopBrand()` (`config/repairModels.js`, reuses the same brand→model catalog as the repair models panel); clicking a model navigates to `/shop?search=<model>` (shop intent, not repair)

Mobile keeps the existing accordion pattern in `Navbar.jsx` (unchanged). Hover-open/click-open and outside-click/ESC-close logic from the original menu is preserved.

**Full device catalog (commit — see changelog):** `repairModels.js` now holds a comprehensive 14-brand, ~400-model catalog (series-grouped, e.g. Samsung's S/Note/A/Z series, iPhone 17→6s, Xiaomi/Redmi/POCO, Vivo/iQOO, etc.) — single source of truth for the mega menu, the Repair page models panel, **and** the repair intake form's brand/model dropdown (`repairIntake.js` derives `DEVICE_BRANDS` from it, so there is no second hand-written model list to drift out of sync).

---

## 5. Dual mode: Shop + Gaming

### Shop mode (default)
- Routes: Home, Shop, Repair, Contact (Rabta), Track Order, Account
- Light/dark theme toggle (`ThemeContext.jsx`)
- Ambient animated background (`AmbientBackground.jsx`)
- Home featured grid **Gaming category filter out** karta hai

### Gaming mode
- Route: `/gaming`
- RedMagic-inspired dark UI (`gaming.css`, `app--gaming` on root)
- Gaming transition animation + sound effects (`utils/gamingSound.js`)
- Gaming product cards, marquee, PUBG tags
- Entry: **Gaming Mode** button in nav (`GamingModeButton`)
- Exit: **Exit Gaming** button (`ExitGamingButton`)
- WhatsApp float **hidden** in gaming mode; gaming page has its own contact link

**Context:** `GamingContext.jsx` — `isGamingPage`, `enterGamingMode()`, `exitGamingMode()`.

---

## 6. Internationalization (i18n)

**Languages:** `en` (English), `roman` (Roman Urdu). Urdu script (`ur`) was removed — the site is English + Roman Urdu only now, LTR everywhere (no `dir="rtl"` anywhere in the codebase).

| File | Role |
|------|------|
| `frontend/src/locales/translations.js` | All UI strings (2 langs, same keys) |
| `frontend/src/context/LanguageContext.jsx` | `useTranslation()`, `t(key, vars)` — always sets `dir="ltr"` |
| `frontend/src/components/LanguageToggle.jsx` | Drawer + desktop toggle (2 options) |
| `scripts/check-i18n.js` | CI parity check — run `npm run check:i18n` after translation edits, must report 2 languages |

**Nav labels:** Home, Shop, Repair, Gaming, Track, **Rabta** (Contact).

**Shop owner note:** Agar naya button ya message add karein to dono languages (en + roman) mein key add karna zaroori hai, warna CI fail ho jata hai.

---

## 7. Home page UX

**File:** `frontend/src/pages/Home.jsx`

Sections (top to bottom):

1. **Hero** — "Broken Phone? / AsFix It." bento layout, shop gear CTA, open badge
2. **Marquee** — scrolling service tags
3. **Features** — 4 glass cards (expert repair, quality gear, same day, Asad's promise)
4. **How it works** — `RepairSteps` (4 steps)
5. **Repair services** — grid of `RepairServiceCard` (max 6)
6. **Featured shop products** — non-Gaming only, max 4
7. **Location** — `LocationSection` with map embed, directions, contact links

**Floating UI (global, not inside home content):**

| Component | Where hidden |
|-----------|--------------|
| `FloatingRepairButton` | `/repair`, `/gaming`, `/admin` |
| `WhatsAppButton` | Gaming mode |
| `FloatingCart` | `/admin` |
| `GamingModeButton` | Gaming mode |
| `GuestWelcomeBanner` | When customer logged in or dismissed |

**Removed from home (by design, commit `524be2b`):**
- Bottom CTA card below map ("Phone Fix + Gear = AsFix & Gear" + WhatsApp phone)
- Hero WhatsApp button
- Phone number in hero description

**Shop owner note:** Home par ab duplicate WhatsApp/phone nahi — customer global float ya Rabta page use karega.

---

## 8. Every page & route

**Router:** `frontend/src/components/premium/PageTransition.jsx`

| Path | Page file | Auth | What it does |
|------|-----------|------|--------------|
| `/` | `Home.jsx` | Public | Landing, featured products, repair services, map |
| `/shop` | `Shop.jsx` | Public | Full catalog, category filter, search |
| `/shop/:id` | `ProductDetail.jsx` | Public | Single product, add to cart (login gate), contact prefill link |
| `/repair` | `Repair.jsx` | Public | Intake form, screen quality, models panel, service cards |
| `/gaming` | `Gaming.jsx` | Public | Gaming-only products, PUBG UI |
| `/contact` | `Contact.jsx` | Public | Rabta form + map; accepts URL prefill (`?subject=&message=`) |
| `/track` | `OrderTrack.jsx` | Public | Track by order ID + phone; feedback form |
| `/account/login` | `AccountLogin.jsx` | Public | Customer password or phone OTP login |
| `/account/register` | `AccountRegister.jsx` | Public | Customer signup with Gmail OTP |
| `/register` | — | Public | Redirects → `/account/register` |
| `/account` | `Account.jsx` | Customer only | Order history, contact messages, stats |
| `/account/settings` | `AccountSettings.jsx` | Customer only | Profile, password change |
| `/login` | `Login.jsx` | Public | Full-page staff login (also `StaffAccessPanel` float) |
| `/admin` | `Admin.jsx` | Staff only | Full admin dashboard with tabs |
| `*` | `NotFound.jsx` | Public | 404 page |

**Route guards:**
- `ProtectedRoute.jsx` — staff roles only (`/admin`)
- `CustomerRoute.jsx` — `customer` role only (`/account`, `/account/settings`)

**Global shell** (`App.jsx`):
- Navbar, Footer, floats, `StaffAccessPanel` (guests), `AdminFloatingDashboard` + `StaffToolbar` (staff, non-gaming)

---

## 9. Authentication & roles

### Staff roles (`frontend/src/config/permissions.js`)

| Role | Login | Permissions |
|------|-------|-------------|
| **super_admin** | Gmail/username + password | Full access + **Team Access** + shop status override |
| **admin** | Gmail + password | Products (incl. delete), orders, repairs, sales, shop status — **no** team |
| **editor** (Staff Editor) | Gmail + password | View/update orders & repairs — **no** product delete, **no** team |

### Customer role
- `customer` — OTP-verified signup, cart/checkout, order history, contact message history

### Permission helpers

| Function | Who |
|----------|-----|
| `canManageTeam` | super_admin only |
| `canDeleteProducts` | super_admin, admin |
| `canManageShopSettings` | super_admin, admin |
| `canViewSalesReport` | all staff |
| `isValidStaffGmail` | Staff must use `@gmail.com` |

### Token storage
- Key: `localStorage` → `asfix_auth_token`
- Header: `Authorization: Bearer <token>`
- Cleared on 401/403 logout

### Staff login UI
- **Floating panel:** `StaffAccessPanel.jsx` — bottom corner on all non-admin pages for guests
- **Full page:** `/login`
- Staff logged in → panel shows role, link to `/admin`, logout

**Security:**
- Passwords hashed with scrypt (`backend/auth/crypto.js`)
- Sessions expire on inactivity
- `requireAuth` + `requireRole` on all mutating staff routes
- Login rate-limited (`authLimiter`)

See also: `STAFF-ACCESS.md`

---

## 10. Customer OTP signup & login

### Signup (Gmail OTP — primary)
1. `POST /api/auth/register/start` — sends 6-digit code via Gmail SMTP
2. User enters code in `OtpInput.jsx`
3. `POST /api/auth/register/verify` — verifies code, creates `customer` account

**Signup fields:** name, username (3–30 chars, alphanumeric + underscore), Gmail (`@gmail.com` required if email used), optional phone, password + confirm.

**Direct register disabled:** `POST /api/auth/register` returns 410 — must use OTP flow.

### Login options (`AccountLogin.jsx`)
1. **Username/email + password** — `POST /api/auth/login`
2. **Phone OTP:**
   - `POST /api/auth/login/otp/start` — SMS via Twilio (if configured)
   - WhatsApp fallback link if SMS unavailable
   - `POST /api/auth/login/otp/verify` — verifies code

### Dev mode
When SMTP/SMS not configured: OTP printed in backend console + returned as `devCode` in API response.

### Guest UX
- `GuestWelcomeBanner.jsx` — prompts signup/login (dismissible per session)
- `CustomerLoginModal.jsx` — modal login from shop gate / navbar
- `ShopLoginPrompt.jsx` — "login required" prompt before add-to-cart

**Components:** `AccountRegister.jsx`, `AccountLogin.jsx`, `AccountSettings.jsx`, `OtpInput.jsx`

### 2026 auth redesign
`AccountLogin.jsx`, `AccountRegister.jsx`, `Login.jsx` (staff), and `CustomerLoginModal.jsx` share a common visual system built from `frontend/src/components/auth/AuthUI.jsx` + `frontend/src/auth-2026.css`:

- `AuthShell` / `AuthCard` — glassmorphic, gradient-edge card over a soft radial glow, theme-aware (uses `--primary`, `--violet`, `--glass-edge`, `--bg-card` etc., no hardcoded colors)
- `AuthBrand` / `AuthHead` — logo mark + eyebrow/title/subtitle header
- `AuthTabs` — animated pill segmented control (e.g. password vs OTP login), powered by `framer-motion` `layoutId`
- `AuthSteps` — 2-step progress indicator for OTP flows (enter details → verify code)
- `AuthAlert` — themed inline error/info/success banners (dev-mode OTP code, WhatsApp fallback, validation errors)
- `AuthSubmitButton` — gradient CTA with built-in loading spinner while submitting
- `AuthSecondaryButton` — outline button for resend/back actions
- Staff login (`Login.jsx`) uses the `staff` accent variant (violet-forward gradient) to visually distinguish it from customer auth

All original logic (API calls, OTP start/verify, validation, WhatsApp fallback links) was preserved — this was a visual/UX-only redesign.

---

## 11. Shop flow: login gate, cart, checkout, payments, stock

### Login gate (`useShopGate.js`)

**Rule:** Cart add aur checkout ke liye customer login **zaroori** hai.

| Action | Gate behavior |
|--------|---------------|
| Add to cart | `requireCustomer()` → if guest, `ShopLoginPrompt` opens |
| Checkout | Same gate in `FloatingCart.jsx` |
| Browse shop | No login required |

Used in: `ProductCard.jsx`, `ProductDetail.jsx`, `GamingProductCard.jsx`, `FloatingCart.jsx`.

### Cart (`CartContext.jsx`)
- Persisted in `localStorage`
- `FlyToCart.jsx` — fly animation on add
- Quantity capped by `maxCartQty(product)` = product stock

### Checkout (`FloatingCart.jsx`)

**Steps:** `cart` → `delivery` → `payment` → `confirm`

**Delivery fields:** name, phone, city (preset list: Lahore, Karachi, Islamabad, etc.)

**Payment methods (no COD — removed in `51b4459`):**

| ID | Label | Instructions |
|----|-------|--------------|
| `jazzcash` | JazzCash | Send to **03039227000**, merchant **ASAD SHAHZAD** |
| `easypaisa` | Easypaisa | Same number and merchant name |
| `bank` | Bank transfer | Bank details shown in UI |

**Confirm:** `POST /api/orders` (auth required, `customer` role)

**After order:**
- `OrderSuccessPanel.jsx` — receipt text + link to contact page with prefilled receipt (`order-receipt` type)
- Order ID for tracking at `/track`
- WhatsApp receipt via `utils/receipts.js`

### Stock management

| Rule | Detail |
|------|--------|
| Low stock threshold | 5 units (`LOW_STOCK_THRESHOLD` in `utils/stock.js` + `store.js`) |
| Status badges | `out` (0), `low` (≤5), `in` (>5) — shown in admin product list |
| On order place | Stock deducted atomically in `createOrder()` |
| On cancel | Stock restored if order was not already cancelled |
| Over-order | `StockError` → HTTP 409 with details |

### Pricing (`utils/pricing.js`)
- `getSalePrice(product)` — applies `discount_percent`
- `hasDiscount(product)` — ribbon on cards
- `cost_price` — **staff only** (stripped from public API via `stripProductCost`)

### Discounts
- Per-product `discount_percent` in admin / `AdminDiscountPanel.jsx`
- `DiscountPicker.jsx`, `DiscountRibbon.jsx`, `ProductPrice.jsx`

---

## 12. Gaming mode

**Page:** `frontend/src/pages/Gaming.jsx`

- Loads products with `category: 'Gaming'` only
- `GamingProductCard.jsx` — same login gate as shop cards
- Contact via `gamingContactPath()` → Contact page prefill
- Staff can still use Ops desk (gaming page par float hidden, but staff toolbar works if logged in)
- `GamingTransition.jsx` + `gamingSound.js` on enter/exit

**Separate from shop:** Different CSS theme, no shop ambient background, no global WhatsApp float.

---

## 13. Repair system

### Page structure (`Repair.jsx`)

1. `RepairSteps` — 4-step how-it-works
2. `RepairIntakeForm.jsx` — full booking form → `POST /api/repairs/book`
3. `ScreenQualityPicker.jsx` — Low / Medium / High / Compare tiers
4. `RepairModelsPanel.jsx` — brand/model chips → contact prefill links
5. `RepairServiceCard` grid — services from API

### Config files

| File | Contents |
|------|----------|
| `config/repairIntake.js` | Issue types, screen tiers, dead-mobile policy, estimate times. `DEVICE_BRANDS` (brand/model dropdown) is **derived from** `repairModels.js` — not a separate list |
| `config/repairModels.js` | ★ Single source of truth: 14 brands × series-grouped models (~400 models) for quote chips, shop mega menu, and the intake dropdown. `repairQuoteContactPath()`, `getModelsForShopBrand()`, `getSeriesForShopBrand()` |

### Issue types
Charging port, screen, battery, water damage, suddenly dead, sound, software — with severity (`standard`, `severe`, `dead`) affecting ETA text.

### Screen quality tiers
- **Low** — budget panel, 7-day warranty
- **Medium** — balanced, 15-day warranty
- **High** — premium, 30-day warranty
- **Compare** — asks for all three rates
- Dead mobile repairs: **no screen warranty** (policy in `DEAD_MOBILE_POLICY`)

### Booking API
`POST /api/repairs/book` — creates booking with `booking_ref`, customer info, device, issues, screen quality preference.

### Success flow
`RepairSuccessPanel.jsx` — shows ref + contact link with `repair-receipt` prefill.

### Staff management
- Admin → Repair Intake tab
- Ops desk → Repairs tab
- Statuses: `pending`, `in_progress`, `completed`, `cancelled`

---

## 14. Contact / Rabta & WhatsApp prefill flow

> **Major change (commit `9fb61d4`):** Almost all "WhatsApp" buttons across the site now route to **`/contact`** with a **prefilled subject and message** instead of opening `wa.me` directly. User reviews/edits the message, then either submits the form or clicks "Send WhatsApp" for the final `wa.me` link.

### Core utility: `frontend/src/utils/contactPrefill.js`

| `type` | Triggered from | Prefill content |
|--------|----------------|-----------------|
| `product` | Product cards, product detail | Product name, price/sale, category |
| `repair-service` | `RepairServiceCard` | Service name, optional model |
| `repair-model` | `RepairModelsPanel` chips | Device model hint |
| `screen-quality` | `ScreenQualityPicker` | Tier label or compare-all request |
| `cart` | FloatingCart (guest inquiry) | Cart items + total |
| `directions` | `LocationSection` | Shop address + maps link |
| `gaming` | Gaming page CTA | Gaming gear inquiry |
| `order-receipt` | `OrderSuccessPanel` | Full order receipt text |
| `repair-receipt` | `RepairSuccessPanel` | Repair intake summary |
| `general` | Global WhatsApp float, general links | Generic inquiry |

### How prefill reaches Contact page

1. **URL query:** `/contact?subject=...&message=...` via `buildContactPath()`
2. **Router state:** `navigateToContact(navigate, prefill)` sets `location.state.contactPrefill`
3. Contact page reads both; shows green **prefill banner** when prefilled
4. Logged-in customers: name/email/phone auto-filled from account

### Contact form submit
`POST /api/contact` — stores message in `contact_messages`; staff reply via Admin Messages tab.

### WhatsApp send from Contact (auto-capture)
`composeContactWhatsAppBody()` → `whatsappLink()` — user reviews the composed message, same as before. **Difference (see changelog):** clicking **"Send via WhatsApp"** now also silently calls `POST /api/contact` first (awaited) so the inquiry is guaranteed to land in Admin Messages / Ops desk **immediately**, before the `wa.me` tab opens — it no longer depends on the customer actually pressing send inside their own WhatsApp app.

**Policy limitation (important, be honest about this):** WhatsApp does **not** allow a website to silently send a message from the *customer's own* WhatsApp account — that's a WhatsApp anti-spam policy, not something code can bypass. The `wa.me` link still requires the customer to tap send manually. What changed is that staff no longer depend on that manual tap to know about the inquiry.

**Optional staff-side ping:** If `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` (Meta Cloud API, same env vars already used for OTP in `backend/services/otpDelivery.js`) are set, `POST /api/contact` also fires a real outbound WhatsApp message **to the shop's own number** (`SHOP.phoneIntl`) with a short inquiry summary, via `notifyShopWhatsApp()` (reuses the existing Cloud API sender, no new integration code). Skipped silently if not configured; never blocks or fails the contact submission (wrapped in try/catch, fire-and-forget).

### Components updated for prefill routing
`WhatsAppButton.jsx`, `ProductCard.jsx`, `RepairServiceCard.jsx`, `RepairModelsPanel.jsx`, `ScreenQualityPicker.jsx`, `LocationSection.jsx`, `Gaming.jsx`, `FloatingCart.jsx`, `OrderSuccessPanel.jsx`, `RepairSuccessPanel.jsx`, `config/shop.js`, `config/repairIntake.js`, `config/repairModels.js`

**Shop owner note:** Ab har inquiry Contact page se guzarti hai — customer message edit kar sakta hai, aur form submit karne par aapko Admin → Messages mein dikhega.

---

## 15. Admin panel & Ops desk

### `/admin` page (`Admin.jsx`)

**Tabs:**

| Tab ID | Component | Who sees it |
|--------|-----------|-------------|
| `add` | `AddProductForm.jsx` | All staff (edit mode when product selected) |
| `products` | Product list with stock badges, edit/delete | All staff (delete: admin+) |
| `bookings` | Repair intake list + status dropdown | All staff |
| `messages` | `AdminChatInbox.jsx` | All staff |
| `sales` | `AdminSalesReport.jsx` | All staff |
| `admins` | `AdminManagement.jsx` | **super_admin only** |

**Also on admin page (top):**
- `ShopStatusControl.jsx` — manual open/closed override (admin+)

**URL deep link:** `/admin?tab=sales` etc.

**Polling:** `startVisibilityPoll(loadData, 45_000)` — only when browser tab visible.

### Floating Ops desk (`AdminFloatingDashboard.jsx`)

Visible when staff logged in (not on gaming page styling). **⚡ Ops** tab on left edge.

**Tabs inside desk:**

| Tab | Contents |
|-----|----------|
| Orders | Pending count, quick status buttons (Verify Payment, Ship, Rider, Done) |
| Repairs | Booking list + status updates |
| Messages | Embedded `AdminChatInbox` |
| Sales | Embedded `AdminSalesReport` (staff with permission) |
| Team | Embedded `AdminManagement` (super_admin only) |

**Badge:** pending orders + pending repairs + unread messages.

**Quick actions:** `AddProductModal.jsx` from desk header.

**Order quick statuses:** `pending` → `payment_verified` → `shipped` → `out_for_delivery` → `delivered` / `cancelled`

### Staff toolbar (`StaffToolbar.jsx`)
Quick links: Admin, Add product, shop status.

### Discount panel (`AdminDiscountPanel.jsx`)
Bulk/set per-product discounts (accessible from admin context).

### Team Access (`AdminManagement.jsx`) — super_admin only

- Add staff: name, Gmail, role (admin/editor), password
- One-time password shown in modal — copy to WhatsApp staff ko
- Block/unblock (clears sessions)
- Reset password
- Remove (cannot remove self)

See `STAFF-ACCESS.md` for Roman Urdu walkthrough.

---

## 16. Sales & profit tracking

- Products have `price`, `cost_price`, `stock`, `discount_percent`, `warranty`
- `getSalePrice()` / `hasDiscount()` in `utils/pricing.js`
- Low stock threshold: 5
- **API:** `GET /api/admin/sales-report?period=day|week|range&from=&to=`
- **UI:** `AdminSalesReport.jsx` — summary cards, order table, CSV export
- **Profit** = sale price − cost_price per line item (cost hidden from customers)
- CSV columns include Order ID, items, sale, cost (Asal), profit, status

**Shop owner note:** `cost_price` sirf admin mein dikhta hai — customer ko nahi. Sales tab se din/week/custom range dekh sakte hain.

---

## 17. Mobile UX, sounds & animations

| Feature | File(s) |
|---------|---------|
| Mobile nav drawer | `Navbar.jsx`, `mobile-nav.css`, `useNavDrawerThumb.js` |
| Nav thumb sound | `utils/navThumbSound.js` |
| Button effects | `ButtonEffects.jsx`, `premium.css` |
| Fly-to-cart | `FlyToCart.jsx` |
| Scroll reveal | `useScrollReveal.js` |
| Page transitions | `PageTransition.jsx` |
| Gaming sounds | `utils/gamingSound.js` |
| Responsive floats | `responsive-floats.css` |
| Theme toggle | `ThemeContext.jsx` |
| Custom cursor (premium) | `premium/CustomCursor.jsx` |
| Case previewer | `premium/CasePreviewer.jsx` |
| Open/closed badge | `OpenBadge.jsx`, `ShopStatusContext.jsx` |

---

## 18. Environment variables

**File:** `.env.example` (copy to `.env` — **never commit** `.env`)

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` at runtime via start command only |
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
| `SYNC_ADMIN_ON_DEPLOY` | `1` = reset admin password on deploy (use carefully) |
| `RENDER_EXTERNAL_URL` | Auto-allowed in CORS on Render |

---

## 19. Deploy (Render + Cloudflare)

1. Push repo to GitHub
2. Render → **New Web Service** → connect repo
3. **Build:** `npm run install:prod && npm run seed && npm run build`
4. **Start:** `NODE_ENV=production node backend/server.js`
5. Set `CORS_ORIGIN` after custom domain is live
6. Set `GMAIL_USER` + `GMAIL_APP_PASSWORD` for customer OTP
7. After first deploy: `npm run reset-admin` locally OR set `ADMIN_PASSWORD` before seed
8. Cloudflare: register **asfixgear.com**, DNS → Render
9. Render → Custom Domains → add root + www

**Guides:** `DEPLOY.md`, `DOMAIN-SETUP.md`

---

## 20. File structure

```
asfix-gear/
├── backend/
│   ├── server.js              # Express entry, static serve in prod, rate limiters
│   ├── store.js               # JSON CRUD, orders, stock, sales report, users
│   ├── seed.js                # Sample products & repair services
│   ├── seed-admin.js          # Default super admin (ADMIN_PASSWORD)
│   ├── reset-admin-password.js
│   ├── data/data.json         # Live data (gitignored with real customer data)
│   ├── auth/
│   │   ├── crypto.js          # scrypt hash, tokens, OTP hash
│   │   └── otp.js             # OTP generation/verify
│   ├── middleware/
│   │   ├── auth.js            # requireAuth, requireRole, optionalAuth
│   │   ├── rateLimit.js       # api, auth, write, otp limiters
│   │   └── security.js        # CORS, security headers
│   ├── routes/
│   │   ├── auth.js            # login, register OTP, team CRUD, profile
│   │   ├── products.js        # catalog CRUD, cost_price strip for public
│   │   ├── orders.js          # place, track, feedback, staff status
│   │   ├── repairs.js         # services, book, staff bookings
│   │   ├── contact.js         # public submit, staff inbox
│   │   ├── shop.js            # open/closed status
│   │   └── admin.js           # sales report
│   └── services/
│       └── otpDelivery.js     # email, SMS, WhatsApp OTP delivery
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Global shell, floats, staff panels
│   │   ├── main.jsx           # Providers + CSS imports
│   │   ├── pages/             # Home, Shop, Gaming, Admin, Account, Contact, etc.
│   │   ├── components/        # UI, admin, gaming, premium, repair
│   │   ├── context/           # Auth, Cart, Gaming, Language, Theme, ShopStatus
│   │   ├── config/
│   │   │   ├── shop.js        # Shop contact info + contact path helpers
│   │   │   ├── products.js    # Categories, default images
│   │   │   ├── permissions.js # Role checks
│   │   │   ├── repairIntake.js
│   │   │   └── repairModels.js
│   │   ├── hooks/
│   │   │   ├── useShopGate.js
│   │   │   ├── useScrollReveal.js
│   │   │   └── useNavDrawerThumb.js
│   │   ├── locales/translations.js
│   │   ├── api/client.js      # fetch wrapper + all API methods
│   │   └── utils/
│   │       ├── contactPrefill.js   # ★ WhatsApp → Contact prefill engine
│   │       ├── pricing.js
│   │       ├── receipts.js
│   │       ├── stock.js
│   │       ├── visibilityPoll.js
│   │       └── gamingSound.js, navThumbSound.js
│   └── dist/                  # Vite build (served in production)
├── scripts/
│   ├── check-i18n.js
│   └── check-secrets.js
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-hint.yml
├── DEPLOY.md
├── DOMAIN-SETUP.md
├── STAFF-ACCESS.md
├── AUTOMATIONS.md
├── WEBSITE-FULL-PROMPT.md     # ★ this file
└── package.json
```

---

## 21. API routes (complete)

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check `{ status, brand, storage }` |
| GET | `/api/stats` | Shop stats (product count, etc.) |
| GET | `/api/products` | List products (`?featured=true`, `?category=Gaming`) — cost_price hidden |
| GET | `/api/products/:id` | Product detail — cost_price hidden for guests |
| GET | `/api/products/categories` | Category list |
| GET | `/api/repairs/services` | Repair service cards data |
| POST | `/api/repairs/book` | Book repair (rate limited) |
| POST | `/api/contact` | Contact message (optional auth links customer) |
| POST | `/api/auth/login` | Staff or customer password login |
| POST | `/api/auth/register` | **410** — disabled, use OTP flow |
| POST | `/api/auth/register/start` | Customer signup OTP start (otp rate limit) |
| POST | `/api/auth/register/verify` | Customer signup OTP verify |
| POST | `/api/auth/login/otp/start` | Phone login OTP start |
| POST | `/api/auth/login/otp/verify` | Phone login OTP verify |
| GET | `/api/orders/track` | Track order — query: `orderId`, `phone` |
| POST | `/api/orders/feedback` | Order feedback (rating + comment) |
| GET | `/api/shop/status` | Shop open/closed (hours + manual override) |
| PATCH | `/api/orders/:id/gmail` | Save Gmail on order for invoice (orderId + phone verify) |

### Customer (auth + role: `customer`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Logout (invalidate session) |
| PATCH | `/api/auth/profile` | Update name, phone |
| PATCH | `/api/auth/change-password` | Change password |
| GET | `/api/auth/my-orders` | Order history |
| GET | `/api/auth/my-messages` | Contact messages sent by customer |
| POST | `/api/orders` | Place order (stock check, auth required) |

### Staff (auth + role: `super_admin` | `admin` | `editor`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/products` | Add product |
| PUT | `/api/products/:id` | Update product |
| PATCH | `/api/products/:id/discount` | Set discount % |
| DELETE | `/api/products/:id` | Delete product (**admin+** only) |
| GET | `/api/repairs/bookings` | All repair bookings |
| PATCH | `/api/repairs/bookings/:id/status` | Update booking status |
| GET | `/api/orders` | All orders |
| PATCH | `/api/orders/:id/status` | Update order shipping status |
| GET | `/api/contact` | All contact messages |
| PATCH | `/api/contact/:id/reply` | Staff reply to message |
| PATCH | `/api/shop/status` | Manual shop open/closed (**admin+**) |
| GET | `/api/admin/sales-report` | Sales & profit (`period=day\|week\|range`) |

### Super admin only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/users` | List team members |
| GET | `/api/auth/admins` | Alias list (legacy) |
| POST | `/api/auth/users` | Create staff — returns `temporary_password` once |
| POST | `/api/auth/admins` | Create staff (legacy alias) |
| PATCH | `/api/auth/users/:id/block` | Block/unblock staff |
| PATCH | `/api/auth/users/:id/reset-password` | Reset password — temp password once |
| PATCH | `/api/auth/admins/:id` | Update staff (legacy) |
| DELETE | `/api/auth/users/:id` | Remove staff |
| DELETE | `/api/auth/admins/:id` | Remove staff (legacy) |

**Rate limits** (`server.js`): `apiLimiter` on `/api`, `authLimiter` on login/register, `otpLimiter` on OTP start, `writeLimiter` on repairs/contact/orders.

**Body limit:** `express.json({ limit: '256kb' })`

---

## 22. Data model (`data.json`)

```json
{
  "meta": {
    "nextProductId": 1,
    "nextServiceId": 1,
    "nextBookingId": 1,
    "nextMessageId": 1,
    "nextUserId": 1,
    "nextOrderId": 1,
    "nextVerificationCodeId": 1
  },
  "users": [{
    "id", "name", "email", "username", "password_hash", "role",
    "active", "blocked", "phone", "created_at", "last_login", "created_by"
  }],
  "sessions": [{ "token", "user_id", "expires_at" }],
  "products": [{
    "id", "name", "category", "price", "cost_price", "stock",
    "discount_percent", "featured", "description", "image", "warranty"
  }],
  "repair_services": [{ "id", "name", "description", "icon", "duration", "supported_models" }],
  "repair_bookings": [{
    "id", "booking_ref", "customer_name", "phone", "device", "issues",
    "screen_quality", "status", "status_history", "activity_log", "created_at"
  }],
  "orders": [{
    "id", "order_id", "items", "total_amount", "payment_mode", "shipping_status",
    "gmail", "customer_user_id", "stock_deducted", "status_history",
    "activity_log", "customer_feedback", "created_at", "updated_at"
  }],
  "contact_messages": [{
    "id", "name", "email", "phone", "message", "user_id",
    "staff_reply", "replied_at", "created_at"
  }],
  "verification_codes": [{ "email_or_phone", "code_hash", "expires_at", "purpose" }],
  "settings": {
    "shop": { "manual_override": null, "updated_at", "updated_by" }
  }
}
```

**Never commit** production `data.json` with real customer data, tokens, or password hashes.

---

## 23. How to change common things

### Change phone number / email / address / hours
**File:** `frontend/src/config/shop.js`  
Sab jagah auto-update: contact page, checkout payment instructions, map, receipts, OTP fallback links.

### Change payment number or merchant name
**Files:**
- Phone: `frontend/src/config/shop.js` → `SHOP.phone`
- Merchant name: `frontend/src/components/premium/FloatingCart.jsx` → `MERCHANT_NAME = 'ASAD SHAHZAD'`
- Translations: `cart.jazzcash`, `cart.easypaisa`, `cart.paymentStepSend` in `translations.js`

### Add a new product (staff UI)
1. Login as staff → `/admin` → **Add Product** tab  
   **OR** Ops desk → **+** quick add modal
2. Fill: name, category, price, cost price, stock, description, image, optional discount/warranty
3. **Featured** checkbox = shows on home (non-gaming filter still applies)

**Seed alternative:** edit `backend/seed.js` → `npm run seed` (only for fresh/dev data).

### Add a new product category
**File:** `frontend/src/config/products.js` → `CATEGORIES` array + `DEFAULT_IMAGES` entry.

**Accessory taxonomy note:** `Cases` = pouch/case, `Back Covers` = rigid back covers, `Screen Guards` = screen protectors/front glass. Tag real products as `"<Model> Back Cover"`, `"<Model> Case"`, etc. — Shop search (`/shop?search=<model>`) is a simple case-insensitive substring match on product name, so any product named with the model in it will surface correctly from the mega menu / repair models panel model links.

### Add repair service
**Backend seed:** `backend/seed.js` repair_services array, OR insert via `data.json` (dev only).  
Frontend loads from `GET /api/repairs/services`.

### Add staff member
1. Login as **super_admin** (`asad`)
2. `/admin` → **Team** tab OR Ops desk → **Team**
3. Add Gmail, role, password → copy one-time password from modal

### Change shop open/closed manually
Admin page or Ops desk → `ShopStatusControl` → override (admin+).  
Overrides `isShopOpen()` hours check until cleared.

### Change translations / add Roman Urdu text
**File:** `frontend/src/locales/translations.js` — add key in **both** langs (`en` + `roman`).  
Run: `npm run check:i18n`

### Change repair screen quality options
**File:** `frontend/src/config/repairIntake.js` → `SCREEN_QUALITY_TIERS`  
Also add matching i18n keys under `screenQuality.*` in translations.

### Change device models for repair quotes
**Files:** `repairIntake.js` (intake form brands), `repairModels.js` (models panel chips)

### Change default admin password
```powershell
$env:ADMIN_PASSWORD="YourNewPassword"
npm run reset-admin
```
On Render: set `ADMIN_PASSWORD` env var before seed, or run reset script against production data.

### Disable COD (already done)
COD removed from checkout and translations. Valid modes: `jazzcash`, `easypaisa`, `bank` only.

### Change contact prefill message templates
**File:** `frontend/src/utils/contactPrefill.js` → `buildContactPrefill()` switch cases.

### Change CORS for new domain
Render env: `CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com`

---

## 24. Default credentials

### Super admin (seed only — **change after deploy**)

| Field | Value |
|-------|-------|
| Username | `asad` |
| Email | `asadshahzad777111@gmail.com` |
| Password | `AsFix2026!` (or `ADMIN_PASSWORD` env var at seed time) |

```powershell
npm run reset-admin   # uses ADMIN_PASSWORD env or default above
```

**Shop owner note:** Pehli deploy ke baad password zaroor change karein — `npm run reset-admin` ya Render par `ADMIN_PASSWORD` set karke redeploy.

### Customer accounts
No default — customers self-register via Gmail OTP at `/account/register`.

---

## 25. Git & deploy commands

```powershell
cd C:\Users\asads\asfix-gear

# Status
git status

# Stage & commit (example)
git add WEBSITE-FULL-PROMPT.md
git commit -m "Update full site prompt documentation"

# Push to GitHub (triggers Render auto-deploy if connected)
git push origin main

# Pre-merge checks
npm run check:secrets
npm run check:i18n
```

**Render auto-deploy:** Push to `main` → Render rebuilds with `install:prod && seed && build` → restarts server.

**Do not commit:** `.env`, `backend/data/data.json` (with real data), tokens, password hashes.

---

## 26. Security checklist

- [ ] Change default admin password after deploy (`npm run reset-admin`)
- [ ] Set `CORS_ORIGIN` to exact domain(s) in production
- [ ] Configure Gmail OTP on Render (`GMAIL_USER`, `GMAIL_APP_PASSWORD`)
- [ ] Run `npm run check:secrets` before merge
- [ ] Keep `.env` out of git
- [ ] JSON body limit 256kb
- [ ] Rate limits on auth, OTP, write endpoints
- [ ] Staff Gmail-only for team accounts (`@gmail.com`)
- [ ] Generic error messages to clients (no stack traces)
- [ ] `cost_price` never exposed to public product API
- [ ] Customer orders require auth; track/feedback require order ID + phone

---

## 27. Recent changes changelog

| Commit | Summary |
|--------|---------|
| _pending_ | **Contact auto-capture:** "Send via WhatsApp" on the Contact page now silently submits to `POST /api/contact` (awaited) before opening the `wa.me` link — inquiry is guaranteed to land in Admin Messages / Ops desk even if the customer never completes the manual WhatsApp send. Optional: if `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` are set, staff also get a real WhatsApp ping to the shop's own number via `notifyShopWhatsApp()` (reuses `otpDelivery.js` Cloud API sender). |
| _pending_ | **Comprehensive device catalog:** `repairModels.js` expanded to 14 brands / ~400 models, series-grouped (Apple, Samsung, OnePlus, Xiaomi/Redmi/POCO, Vivo/iQOO, Oppo, Infinix, Tecno, Google Pixel, Realme, Motorola, Nothing, Honor, Itel). `SHOP_BRANDS` (`products.js`) expanded to match; `repairIntake.js` `DEVICE_BRANDS` now derived from the same source instead of a separate hand-written list. Added `Back Covers` product category alongside existing `Cases` and `Screen Guards`. |
| `6f20586` | **Mega menu + home polish:** `ShopMegaMenu.jsx` upgraded to a true 2-level brand→model slide-out (desktop). Home product cards now show low/out-of-stock badges via `utils/stock.js`. Docs updated. |
| `5fea50e` | **2026 auth redesign:** `AccountLogin`, `AccountRegister`, `Login`, `CustomerLoginModal` redesigned with a shared glassmorphic `AuthUI.jsx` component system (`auth-2026.css`) — animated tabs, step indicators, gradient CTAs with loading spinners, theme-aware. Logic unchanged. |
| `10ad808` | **Urdu removal:** Removed Urdu script (`ur`) everywhere — site is now English + Roman Urdu only, LTR-only (RTL CSS/fonts removed). |
| `9fb61d4` | **Contact prefill:** All WhatsApp intents route through `/contact` with prefilled subject/message (`contactPrefill.js`). WhatsApp float → general contact path. Product, repair, cart, gaming, directions, receipts all prefilled. |
| `524be2b` | **Home cleanup:** Removed duplicate home CTAs (hero WhatsApp, bottom CTA card). Added initial `WEBSITE-FULL-PROMPT.md`. |
| `dde1441` | Fix `deploy-hint` workflow empty runs — manual-only guard. |
| `6a52a69` | Deploy-hint workflow fix + sales/profit staff tools polish. |
| `c6e50dc` | **Polish pass:** OTP signup UX, home improvements, admin form persistence, order feedback. |
| `0598af8` | **Sales/stock:** ProductCard cleanup after sales report + shop gate integration. Stock badges in admin. |
| `8ff7229` | **Shop gate:** Customer login required before add-to-cart and checkout (`useShopGate`). |
| `51b4459` | **No COD:** Cash on Delivery removed from checkout and all translations. |
| `291d64c` | CI secrets scan fix + branded Gmail OTP emails. |
| `4890fb1` | **JazzCash/Easypaisa checkout** + customer order dashboard stats. |
| `3ad77ba` | Customer auth visibility in nav for guests/mobile. |
| `39b65d6` | Customer OTP verification, account settings, guest welcome banner. |
| `afd915e` | Customer username registration + login modal. |
| `ec49a08` | Customer accounts with order + chat history linking. |
| `2296643` | Fix blank production site (CORS blocking JS bundles). |
| `22761bc` | Fix blank admin page after staff login. |
| `3f6aabd` | Fix super admin login email typo + sync on deploy. |
| `735076f` | Initial AsFix Gear website. |

---

## 28. Recreate-from-scratch prompt (for AI / new dev)

```
Build "AsFix & Gear" — a Lahore mobile repair + accessories shop website.

Stack: React 19 + Vite frontend, Express + JSON file backend, single Render deploy.

Features:
- Dual Shop/Gaming modes with separate UI themes
- i18n: English + Roman Urdu only, LTR (translations.js, check:i18n)
- Home: hero, features, repair steps, services, featured products (no gaming), map — no duplicate WhatsApp on hero
- Shop catalog with categories, search, discounts, stock (low/out badges), login gate for cart
- Gaming page with PUBG-style UI and Gaming-category products only
- Repair intake form with screen quality tiers (Low/Medium/High/Compare), models panel, dead-mobile policy
- Contact/Rabta page with URL + router-state prefill from all WhatsApp CTAs (contactPrefill.js)
- Customer OTP signup (Gmail 6-digit) and phone OTP login (SMS + WhatsApp fallback)
- Login required for cart; JazzCash/Easypaisa/Bank only (03039227000, ASAD SHAHZAD) — no COD
- Order tracking (order ID + phone), WhatsApp receipts, customer feedback
- Staff auth: super_admin, admin, editor — Team Access for super_admin only
- Admin panel tabs: Add Product, Products, Repair Intake, Messages, Sales & Profit, Team
- Floating Ops desk: Orders, Repairs, Messages, Sales, Team with quick status buttons
- Sales report with cost_price profit, CSV export, day/week/range filters
- Stock deduct on order, restore on cancel
- Mobile nav drawer, sounds, animations, floating repair button, theme toggle
- Deploy on Render with Cloudflare domain asfixgear.com
- Env: GMAIL_USER, GMAIL_APP_PASSWORD, CORS_ORIGIN
- Default admin: asad / AsFix2026! (change after deploy)

Shop: Asad Shahzad, 03039227000, asadshahzad777111@gmail.com, Lahore, 9AM–9PM daily.
```

---

## 29. Related docs

| File | Contents |
|------|----------|
| `DEPLOY.md` | Render deploy, Gmail OTP, troubleshooting |
| `DOMAIN-SETUP.md` | Cloudflare + custom domain DNS |
| `STAFF-ACCESS.md` | Team roles, Team Access UI (Roman Urdu) |
| `AUTOMATIONS.md` | Cursor GitHub app + automations |
| `README.md` | Quick start |
| `.cursor/rules/` | Security and mobile/i18n rules for contributors |
| `.cursor/skills/` | add-product, deploy-asfix, mobile-qa, security-audit |

---

*Last updated: July 2026 — matches AsFix & Gear codebase including commit `9fb61d4` (contact prefill), sales/stock, customer OTP, JazzCash/Easypaisa, shop login gate, and home cleanup.*
