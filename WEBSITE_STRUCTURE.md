# AsFix & Gear — Website Structure

Comprehensive reference for the frontend SPA, routing, page layout, shared components, styling, and known issues. Last reviewed against the codebase structure in this repo.

---

## 1. Tech Stack

### Architecture

- **Client-side rendering (CSR)** — React 19 SPA built with Vite 6. All pages render in the browser; data is fetched from the Express REST API at runtime.
- **Production serving** — Express serves `frontend/dist` as static files and falls back to `index.html` for client-side routes (`backend/server.js`).
- **PWA** — `vite-plugin-pwa` registers a service worker with `navigateFallback: '/index.html'` (API routes excluded).
- **Code splitting** — Home loads eagerly; all other routes are lazy-loaded via `React.lazy` in `PageTransition.jsx`.
- **Storage backend** — MongoDB Atlas when configured, otherwise JSON file store at `backend/data/data.json`.

### Root (`package.json`)

| Package / tool | Version | Role |
|---|---|---|
| `concurrently` | ^9.1.2 | Run backend + frontend dev servers together |
| `playwright` | ^1.49.1 | E2E / smoke tests |

### Frontend (`frontend/package.json`)

| Package | Version | Role |
|---|---|---|
| `react` | ^19.0.0 | UI library |
| `react-dom` | ^19.0.0 | DOM renderer |
| `react-router-dom` | ^7.1.1 | Client-side routing |
| `framer-motion` | ^11.18.2 | Page/product animations |
| `leaflet` | ^1.9.4 | Map on Contact / Location sections |
| `vite` | ^6.0.7 | Build tool & dev server |
| `@vitejs/plugin-react` | ^4.3.4 | React JSX/refresh support |
| `vite-plugin-pwa` | ^1.3.0 | Service worker & web manifest |

### Backend (`backend/package.json`)

| Package | Version | Role |
|---|---|---|
| `express` | ^4.21.2 | HTTP API & static file host |
| `cors` | ^2.8.5 | Cross-origin API access |
| `mongodb` | ^6.16.0 | Optional Atlas storage |
| `@aws-sdk/client-s3` | ^3.1078.0 | Cloudflare R2 image uploads |
| `multer` | ^2.2.0 | Multipart upload handling |
| `nodemailer` | ^6.10.1 | Email (where configured) |

### React context providers (`frontend/src/main.jsx`)

Wrapped around the app in this order:

1. `ThemeProvider` — light / dark / auto theme
2. `LanguageProvider` — English / Urdu i18n
3. `AuthProvider` — staff & customer sessions
4. `ShopStatusProvider` — open/closed shop status
5. `GamingProvider` — gaming mode UI state
6. `CartProvider` — shopping cart

### Global shell (`frontend/src/App.jsx`)

Present on most pages (hidden on `/admin` and partially on `/gaming`):

- `AmbientBackground`, `Navbar`, `GuestWelcomeBanner`, `Footer`
- `ChatAssistant`, `FloatingRepairButton`, `FloatingCart`, `FlyToCart`
- `GamingModeButton`, `ExitGamingButton`, `GamingTransition`, `ButtonEffects`
- `ErrorBoundary` wraps route content (and the whole app at root level)

---

## 2. Routes

Defined in `frontend/src/components/premium/PageTransition.jsx`.

| Path | Page component | Auth | Notes |
|---|---|---|---|
| `/` | `Home` | Public | Eager-loaded (not lazy) |
| `/gaming` | `Gaming` | Public | Gaming-themed product catalog |
| `/shop` | `Shop` | Public | Supports `?category=`, `?brand=`, `?search=` |
| `/shop/:id` | `ProductDetail` | Public | Single product view |
| `/repair` | `Repair` | Public | Repair booking & services |
| `/contact` | `Contact` | Public | Contact form + WhatsApp |
| `/track` | `OrderTrack` | Public | Order status lookup |
| `/account/login` | `AccountLogin` | Public | Customer login (password or OTP) |
| `/account/forgot-password` | `AccountForgotPassword` | Public | Password reset flow |
| `/account/register` | `AccountRegister` | Public | Customer registration |
| `/register` | — | Public | Redirects to `/account/register` |
| `/account` | `Account` | **Customer** (`CustomerRoute`) | Orders, messages, addresses, rates |
| `/account/settings` | `AccountSettings` | **Customer** (`CustomerRoute`) | Profile & password |
| `/login` | `Login` | Public | **Staff-only** login → `/admin` |
| `/admin` | `Admin` | **Staff** (`ProtectedRoute`) | WordPress-style admin panel |
| `*` | `NotFound` | Public | 404 page |

### Auth guards

**`ProtectedRoute`** (`frontend/src/components/ProtectedRoute.jsx`)

- Used for `/admin`
- Requires logged-in user with staff role (`isStaff`)
- Unauthenticated → redirect to `/login` (preserves `from` in location state)
- Logged-in non-staff → redirect to `/`

**`CustomerRoute`** (`frontend/src/components/CustomerRoute.jsx`)

- Used for `/account` and `/account/settings`
- Staff users → redirect to `/admin`
- Unauthenticated or non-customer → redirect to `/account/login`

**Login page split**

- `/login` — staff credentials only; rejects customer accounts
- `/account/login` — customer password or phone OTP; rejects staff accounts

---

## 3. Page Breakdowns

### Home (`/`)

File: `frontend/src/pages/Home.jsx`

Top to bottom:

1. **`HomeHero`** — Bento hero with tagline, gradient title, shop-now CTA, open-hours badge (`OpenBadgeLarge`), and featured product image (or phone mock placeholder).
2. **`CollectionGrid`** — Four main collection cards (Cases, Chargers, Screen Guards, Audio). Model-specific categories open **`PhoneFinderModal`**; others navigate to `/shop?category=…`.
3. **`PromoBanners`** — Up to two on-sale products with discount ribbon and link to product detail. Hidden when no sale items.
4. **Loading / error state** — Shown between promo and carousels when products fail to load or are still fetching.
5. **`ProductCarousel` — Top Selling** — Featured or first eight shop products (excludes Gaming category).
6. **`ProductCarousel` — New Arrivals** — Latest products by ID, with “View all” link to `/shop`.
7. **`TrendingCategories`** — Horizontal chip row for all shop categories; model-specific ones open **`PhoneFinderModal`**.
8. **Reviews section** — Eyebrow + title + **`Testimonials`** carousel/grid.
9. **`LocationSection`** — Shop address, hours, and embedded map.

Data: fetches all products via `api.getProducts()`, caches with `readProductsCache` / `writeProductsCache`, filters out Gaming and unpublished items.

> **Note:** `BrandGrid.jsx` and `ModelGrid.jsx` exist under `components/home/` but are **not** currently mounted on the Home page.

---

### Shop (`/shop`)

File: `frontend/src/pages/Shop.jsx`

1. **`PageHeader`** — Eyebrow, title, subtitle; staff see “Add product” button.
2. **Active brand chip** — Shown when a brand filter is active; clear button resets URL params.
3. **Filters bar**
   - Category pills (All + dynamic categories from API)
   - Sale-only toggle
   - **`BrandPickerDropdown`** — filter by phone brand
   - **`ShopModelPicker`** — shown when a brand is selected; filters by model name
   - Search input (synced to `?search=` URL param)
   - Staff-only quick-add button
4. **Product grid** — **`ProductCard`** for each published product; loading, empty, and error states.
5. **Staff FAB + `AddProductModal`** — Floating add button and modal for quick product creation (`?add=1` URL opens modal).

Background polling refreshes stock every 25 s when tab is visible.

---

### Repair (`/repair`)

File: `frontend/src/pages/Repair.jsx`

1. **`PageHeader`** — Repair eyebrow, title, subtitle with shop owner name.
2. **`RepairSteps`** — Visual step-by-step “how it works” section.
3. **`RepairIntakeForm`** — Main booking form (device, issues, contact, terms, submit).
4. **`ScreenQualityPicker`** — Optional screen quality selector (informational; feeds repair context).
5. **`RepairModelsPanel`** — Browse supported device models / brands.
6. **Services grid** — API-loaded repair services rendered as **`RepairServiceCard`** cards.

Styles: `repair-page`, `repair-responsive.css`.

---

### Product Detail (`/shop/:id`)

File: `frontend/src/pages/ProductDetail.jsx`

1. **Back link** — `PremiumLink` to `/shop`.
2. **Image column**
   - Main product image with category animation classes (`gaming`, `charger`, etc.)
   - **`DiscountRibbon`** when on sale
   - **Gallery thumbnails** — standard image gallery for all products including Cases (see Known Issues for `CasePreviewer` note)
3. **Info column**
   - Category eyebrow, sale banner, product name
   - **`ProductPrice`** with savings line
   - Description (plain text or HTML via `dangerouslySetInnerHTML`)
   - Warranty line (if set)
   - Stock status message (in stock / low / out)
4. **Actions**
   - Add to cart (`PremiumButton`) — gated by **`useShopGate`** / customer login
   - Order via WhatsApp or request restock link
   - Contact link
5. **Modals** — **`ShopLoginPrompt`**, **`CustomerLoginModal`** for guest checkout gate

Uses `framer-motion` for entrance animation.

---

### Gaming (`/gaming`)

File: `frontend/src/pages/Gaming.jsx`

1. **Animated background** — Hex grid and glow orbs (`gaming-page-bg`).
2. **Hero section**
   - **`GamingLogo`**, badge, glitch title, accent line, subtitle
   - PUBG-themed tag chips
   - CTAs: scroll to products, WhatsApp order, exit gaming mode
   - Stats row (product count, PUBG triggers, latency)
3. **Marquee strip** — Scrolling gaming gear keywords.
4. **Products section** (`#gaming-products`)
   - Section header with logo
   - Loading spinner or empty state (staff link to admin add tab)
   - **`GamingProductCard`** grid
5. **CTA footer** — WhatsApp order prompt with shop phone.

App shell switches to `app--gaming` class; navbar/footer/chat are hidden. Stock polled every 20 s.

---

### Contact (`/contact`)

File: `frontend/src/pages/Contact.jsx`

1. **`PageHeader`** — Contact eyebrow, title, subtitle.
2. **Two-column grid**
   - **Info card** — Address, phone, WhatsApp, email, hours, link to form
   - **Contact form** — Name, email, phone, subject, message; submit to API; WhatsApp button auto-saves message first then opens WhatsApp
   - Prefill support from URL params (`subject`, `message`, `order_id`) or router state
   - Logged-in customers auto-fill name/email/phone
3. **`LocationSection`** — Map and location details at bottom.

---

### Account

#### `/account/login` — `AccountLogin.jsx`

- **`AuthUI`** shell (tabs, steps, alerts)
- Password login or phone OTP flow via **`OtpInput`**
- Redirects staff to `/admin`; logged-in customers to intended `from` path

#### `/account/register` — `AccountRegister.jsx`

- Customer registration with phone verification

#### `/account/forgot-password` — `AccountForgotPassword.jsx`

- Password reset request flow

#### `/account` — `Account.jsx` (customer auth required)

1. **`PageHeader`** — Welcome message with user name
2. **Account panel header** — User info, logout, link to settings
3. **Tabs**
   - **Orders** — Stats cards (total / pending / completed), order list with ID copy, payment mode, city, address, rider info, track link, **`OrderHelpActions`**
   - **Messages** — Customer messages with staff replies
   - **Addresses** — **`AddressBook`** component
   - **Rates** — **`RepairRateBot`** iPhone repair rate lookup

#### `/account/settings` — `AccountSettings.jsx` (customer auth required)

1. **`PageHeader`**
2. **Profile section** — Edit display name
3. **Password section** — Change password via **`PasswordField`**
4. Logout action

---

### Admin (`/admin`)

File: `frontend/src/pages/Admin.jsx`  
Layout: **`AdminLayout`** (WordPress-inspired sidebar + top admin bar)

Uses `?tab=` URL param. Valid tabs:

| Tab | Content |
|---|---|
| `dashboard` | **`AdminDashboard`** — KPI cards, quick navigation |
| `products` | Sortable/filterable product table, bulk delete, edit/duplicate |
| `add` | **`AddProductForm`** — create or edit product (WordPress-style panels) |
| `categories` | **`AdminCategories`** — manage shop categories |
| `stock` | **`AdminStockManager`** — adjust stock levels |
| `orders` | **`AdminOrderCard`** list with status filters, mark paid, assign rider, deliver |
| `customers` | **`AdminCustomers`** — customer list & details |
| `bookings` | Repair intake cards + desktop table; status updates, staff notes |
| `messages` | **`AdminChatInbox`** — contact / chat messages |
| `feedback` | **`AdminFeedback`** — reviews & feedback |
| `sales` | **`AdminSalesReport`** — sales analytics (role-gated) |
| `admins` | **`AdminManagement`** — team / role management (role-gated) |
| `settings` | **`AdminSettings`** general — shop settings, data backup download |
| `payments` | **`AdminSettings`** payments section |

Global admin features:

- **`AdminStockAlert`** banner when low-stock products exist
- Visibility polling every 45 s for live data
- Role-based visibility via `config/permissions.js` (`canManageTeam`, `canViewSalesReport`, etc.)
- Admin shell hides main site navbar, footer, cart, and chat

Product editor sub-panels (`components/admin/product-editor/`):

- `ProductImagePanel`, `ProductGalleryPanel`, `ProductBrandPanel`
- `ProductCategoriesPanel`, `ProductTagsPanel`, `ProductPermalinkPanel`
- `ProductPublishPanel`, `RichTextEditor`

---

## 4. Reusable Components

Grouped by area. All paths relative to `frontend/src/components/`.

### Layout & navigation

| Component | Path |
|---|---|
| `Navbar` | `Navbar.jsx` |
| `Footer` | `Footer.jsx` |
| `PageHeader` | `PageHeader.jsx` |
| `PageFallback` | `PageFallback.jsx` |
| `PageTransition` | `premium/PageTransition.jsx` |
| `NavDrawerItem` | `NavDrawerItem.jsx` |
| `AccountMenu` | `AccountMenu.jsx` |
| `Logo` | `Logo.jsx` |

### Navigation sub-components

| Component | Path |
|---|---|
| `NavSearch` | `nav/NavSearch.jsx` |
| `SearchBrandIcon` | `nav/SearchBrandIcon.jsx` |
| `ShopMegaMenu` | `nav/ShopMegaMenu.jsx` |

### Auth & access

| Component | Path |
|---|---|
| `ProtectedRoute` | `ProtectedRoute.jsx` |
| `CustomerRoute` | `CustomerRoute.jsx` |
| `AuthUI` (+ sub-exports) | `auth/AuthUI.jsx` |
| `PasswordField` | `auth/PasswordField.jsx` |
| `OtpInput` | `OtpInput.jsx` |
| `CustomerLoginModal` | `CustomerLoginModal.jsx` |
| `ShopLoginPrompt` | `ShopLoginPrompt.jsx` |
| `StaffAccessPanel` | `StaffAccessPanel.jsx` |
| `StaffToolbar` | `StaffToolbar.jsx` |
| `PasswordRevealModal` | `PasswordRevealModal.jsx` |

### Shop & products

| Component | Path |
|---|---|
| `ProductCard` | `ProductCard.jsx` |
| `BrandPickerDropdown` | `BrandPickerDropdown.jsx` |
| `ShopModelPicker` | `shop/ShopModelPicker.jsx` |
| `PhoneFinderModal` | `PhoneFinderModal.jsx` |
| `AddProductModal` | `AddProductModal.jsx` |
| `AddProductForm` | `AddProductForm.jsx` |
| `DiscountPicker` (+ `ProductPrice`, `DiscountRibbon`) | `DiscountPicker.jsx` |
| `ModelMultiPicker` | `ModelMultiPicker.jsx` |
| `ShopStatusControl` | `ShopStatusControl.jsx` |

### Home sections

| Component | Path |
|---|---|
| `HomeHero` | `home/HomeHero.jsx` |
| `CollectionGrid` | `home/CollectionGrid.jsx` |
| `PromoBanners` | `home/PromoBanners.jsx` |
| `ProductCarousel` | `home/ProductCarousel.jsx` |
| `HomeProductCard` | `home/HomeProductCard.jsx` |
| `TrendingCategories` | `home/TrendingCategories.jsx` |
| `BrandGrid` | `home/BrandGrid.jsx` *(not mounted on Home)* |
| `ModelGrid` | `home/ModelGrid.jsx` *(not mounted on Home)* |

### Repair

| Component | Path |
|---|---|
| `RepairSteps` | `RepairSteps.jsx` |
| `RepairIntakeForm` | `RepairIntakeForm.jsx` |
| `RepairServiceCard` | `RepairServiceCard.jsx` |
| `RepairModelsPanel` | `RepairModelsPanel.jsx` |
| `RepairSuccessPanel` | `RepairSuccessPanel.jsx` |
| `ScreenQualityPicker` | `ScreenQualityPicker.jsx` |
| `FloatingRepairButton` | `FloatingRepairButton.jsx` |

### Orders & cart

| Component | Path |
|---|---|
| `FloatingCart` | `premium/FloatingCart.jsx` |
| `FlyToCart` | `premium/FlyToCart.jsx` |
| `OrderTimeline` | `OrderTimeline.jsx` |
| `OrderSuccessPanel` | `OrderSuccessPanel.jsx` |
| `OrderHelpActions` | `OrderHelpActions.jsx` |
| `OrderFeedbackForm` | `OrderFeedbackForm.jsx` |
| `PaymentInstructions` | `PaymentInstructions.jsx` |
| `MapAddressPicker` | `MapAddressPicker.jsx` |

### Gaming

| Component | Path |
|---|---|
| `GamingLogo` | `gaming/GamingLogo.jsx` |
| `GamingProductCard` | `gaming/GamingProductCard.jsx` |
| `GamingModeButton` | `gaming/GamingModeButton.jsx` |
| `ExitGamingButton` | `gaming/ExitGamingButton.jsx` |
| `GamingTransition` | `gaming/GamingTransition.jsx` |
| `ShopModeButton` | `gaming/ShopModeButton.jsx` |
| `ShopLogo` | `gaming/ShopLogo.jsx` |

### Premium / effects

| Component | Path |
|---|---|
| `PremiumButton` / `PremiumLink` | `premium/PremiumButton.jsx` |
| `CasePreviewer` | `premium/CasePreviewer.jsx` *(exists; not used in ProductDetail)* |
| `CustomCursor` | `premium/CustomCursor.jsx` |
| `motionUtils` | `premium/motionUtils.jsx` |
| `AmbientBackground` | `AmbientBackground.jsx` |
| `ButtonEffects` | `ButtonEffects.jsx` |
| `Marquee` | `Marquee.jsx` |

### Account

| Component | Path |
|---|---|
| `AddressBook` | `account/AddressBook.jsx` |
| `RepairRateBot` | `account/RepairRateBot.jsx` |

### Admin

| Component | Path |
|---|---|
| `AdminLayout` | `admin/AdminLayout.jsx` |
| `AdminDashboard` | `admin/AdminDashboard.jsx` |
| `AdminCategories` | `admin/AdminCategories.jsx` |
| `AdminCustomers` | `admin/AdminCustomers.jsx` |
| `AdminFeedback` | `admin/AdminFeedback.jsx` |
| `AdminSettings` | `admin/AdminSettings.jsx` |
| `AdminPayments` | `admin/AdminPayments.jsx` |
| `AdminStockAlert` | `admin/AdminStockAlert.jsx` |
| `AdminManagement` | `AdminManagement.jsx` |
| `AdminChatInbox` | `AdminChatInbox.jsx` |
| `AdminSalesReport` | `AdminSalesReport.jsx` |
| `AdminOrderCard` | `AdminOrderCard.jsx` |
| `AdminStockManager` | `AdminStockManager.jsx` |
| `AdminDiscountPanel` | `AdminDiscountPanel.jsx` |
| `AdminFloatingDashboard` | `AdminFloatingDashboard.jsx` |

### Shared / utility UI

| Component | Path |
|---|---|
| `ErrorBoundary` | `ErrorBoundary.jsx` |
| `ChatAssistant` | `ChatAssistant.jsx` |
| `Testimonials` | `Testimonials.jsx` |
| `LocationSection` | `LocationSection.jsx` |
| `OpenBadge` | `OpenBadge.jsx` |
| `GuestWelcomeBanner` | `GuestWelcomeBanner.jsx` |
| `ThemeToggle` | `ThemeToggle.jsx` |
| `LanguageToggle` | `LanguageToggle.jsx` |

---

## 5. Styling Approach

### Method

- **Plain CSS** — no CSS-in-JS, no Tailwind. Component markup uses semantic class names.
- **CSS custom properties** — theme tokens defined in `themes.css`, toggled via `[data-theme='light']` / `[data-theme='dark']` on `<html>`.
- **Responsive layers** — dedicated breakpoint files imported after base styles.
- **Scoped component CSS** — a few co-located stylesheets (home, nav, chat, admin).

### Theme variables (`frontend/src/themes.css`)

Shared `:root` tokens:

- Layout: `--glass-blur`, `--radius`, `--radius-lg`, `--font`, `--font-display`, `--font-price`, `--touch-min`, `--container-inline`
- Breakpoints: `--bp-tablet`, `--bp-mobile`, `--bp-phone`
- Brand colors: `--primary`, `--primary-glow`, `--violet`, `--violet-glow`, `--mint`, `--mint-glow`, `--mint-focus`

Per-theme (`[data-theme='dark']` / `[data-theme='light']`):

- Surfaces: `--bg`, `--bg-gradient`, `--bg-card`, `--bg-elevated`, `--glass`, `--glass-edge`, `--border`
- Navigation: `--nav-glass`, `--drawer-bg`, `--nav-menu-solid`, `--nav-menu-border`, `--nav-hover`
- Text: `--text`, `--text-muted`
- Inputs & overlays: `--input-bg`, `--input-border`, `--overlay`, `--pill-bg`
- Shadows: `--shadow-elevated`, `--shadow-nav`, `--shadow-hover`, `--shadow-modal`
- Commerce: `--price-color`, `--price-sale-color`
- Misc: `--section-tint`, `--grid-line`, `--orb-strength`, `--theme-toggle-glow`, `--cart-panel-bg`

Theme managed by `ThemeContext` + **`ThemeToggle`** in navbar.

### CSS files (import order from `main.jsx`)

| File | Purpose |
|---|---|
| `themes.css` | Theme variable definitions, theme toggle styles |
| `index.css` | Global base styles, typography, buttons, forms, layout utilities |
| `gaming.css` | Gaming page theme, hero, cards, marquee |
| `premium.css` | Premium product animations, cart, glass effects |
| `responsive-floats.css` | Floating cart / FAB positioning |
| `mobile-nav.css` | Mobile navigation drawer |
| `footer-responsive.css` | Footer breakpoints |
| `repair-responsive.css` | Repair page mobile layout |
| `site-responsive.css` | General site breakpoint rules |
| `mobile-performance.css` | Reduced motion / mobile perf tweaks |
| `components/home/home.css` | Home page sections |
| `components/nav/nav-upgrade.css` | Navbar upgrades |
| `components/chat-assistant.css` | Chat widget |
| `auth-2026.css` | Login / register / account auth pages |
| `components/admin/admin-wp.css` | WordPress-style admin panel (also imported in `Admin.jsx`) |

Additional co-located CSS not in `main.jsx`:

- `components/chat-assistant.css` — imported globally via `main.jsx`
- `admin-wp.css` — imported in both `main.jsx` and `Admin.jsx`

---

## 6. Known Issues & Technical Debt

### `backend/routes/admin.js` — TODO

```text
// TODO: REMOVE AFTER MONGODB MIGRATION COMPLETE — temporary full-store export for Render free tier (no shell).
```

The `GET /api/admin/export-data` endpoint exports the full JSON store as a downloadable backup. Intended as a temporary workaround until MongoDB migration is complete.

### `ErrorBoundary.jsx` — blank-page mitigation

The component docblock notes that uncaught render errors previously caused the **entire app to unmount** (blank white page), which was the #1 recurring bug report. `ErrorBoundary` wraps both the root app and each route (`key={location.pathname}`) to show a bilingual recovery screen instead of a blank page. Errors are logged to the console; stack trace shown in dev only.

### `CasePreviewer.jsx` — unused on Product Detail

`frontend/src/components/premium/CasePreviewer.jsx` provides an interactive “Custom Case Studio” color preview. It was **removed from `ProductDetail.jsx`** — case products now use the **standard image gallery** (main image + thumbnail row) like all other products. The component file still exists and could be re-wired later.

### Orphaned home components

`BrandGrid.jsx` and `ModelGrid.jsx` are implemented but **not imported** by `Home.jsx` or any other page currently.

### Storage dual-backend

The app supports both MongoDB Atlas and local `data.json`. Migration scripts exist at repo root (`scripts/migrate-json-to-mongo.mjs`). Until migration is fully complete, some admin tooling (backup export) remains JSON-oriented.

### Render cold starts

Shop and Home show a “server starting” retry UI when the API is waking up (common on Render free tier). `ensureApiReady()` and `wakeApiServer()` mitigate this but users may still see brief load failures.

### Admin bookings tab routing

In `Admin.jsx`, the `bookings` tab content is rendered by the final `else` branch (fallback), not an explicit `tab === 'bookings'` check. Functionally correct but easy to misread when extending tab logic.

---

## Quick File Map

```
frontend/src/
├── main.jsx              # Entry, providers, CSS imports, PWA SW
├── App.jsx               # Global shell
├── pages/                # Route-level page components
├── components/           # Reusable UI (see section 4)
├── context/              # React context providers
├── api/client.js         # API fetch wrapper
├── config/               # shop.js, products.js, permissions.js
├── hooks/                # useShopGate, etc.
└── utils/                # pricing, stock, i18n helpers

backend/
├── server.js             # Express app, static SPA, API mount
├── routes/               # REST route modules
├── store.js              # Data access (Mongo or JSON)
└── middleware/           # auth, rate limits, CORS, security
```
