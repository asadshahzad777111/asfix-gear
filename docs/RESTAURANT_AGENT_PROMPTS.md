# Restaurant + POS — Ready Agent Prompts

Copy **one** section below, paste it into Cursor (or any AI agent), then fill the placeholders.

**Placeholders (fill before send):**
- `[RESTAURANT_NAME]` — restaurant / brand name
- `[RECEIPT_NOTES]` — thermal receipt details (shop name on paper, 58mm vs 80mm, logo/QR yes-no, Urdu/English lines, footer phone, etc.)

Roman Urdu: *Ek section copy karo → agent ko paste → naam aur receipt notes bhar do. Features abhi implement mat karwana; pehle clear prompt do.*

---

## How to use

1. Open this file: `docs/RESTAURANT_AGENT_PROMPTS.md`
2. Copy **exactly one** prompt block (Master, or a focused one).
3. Paste into a new Cursor Agent chat (or any coding agent).
4. Replace `[RESTAURANT_NAME]` and `[RECEIPT_NOTES]` with real values.
5. Say clearly what you want next: *plan only*, *implement*, or *deploy / push main* when live update is needed.
6. Do **not** paste secrets (`.env`, tokens, passwords). Shop phone/address stay in config files like AsFix.

**Tip:** Start with Master if the whole system is new. Use a focused prompt if only print / staff APK / customer app / menu sync is needed.

---

## 1. Master prompt — full restaurant system

```
You are building a restaurant ordering + POS system for [RESTAURANT_NAME], modeled on the AsFix & Gear stack — not a Zobaze clone.

STACK (match AsFix patterns):
- Frontend: React + Vite (frontend/)
- Backend: Express API (backend/)
- Staff POS Android: Capacitor app under mobile/asfix-pos (or equivalent for this restaurant)
- Live reference: https://asfixgear.com — deploy by pushing to main when the user says deploy / live / push / "kr do"
- Never commit secrets (.env, tokens, real customer data in data.json)

GOALS (full system):

1) THERMAL RECEIPTS
- Match real paper receipts for [RESTAURANT_NAME]
- Support 58mm and/or 80mm as specified
- Accurate layout: name, items, qty, rates, totals, taxes/service if any, footer
- Receipt notes from owner: [RECEIPT_NOTES]
- Prefer existing print pipeline patterns (smart/thermal/BT) — do not invent fake Windows kernel printer drivers

2) STAFF POS APK
- Counter sale + admin/staff flows
- Catalog, cart, checkout, print
- Auth-gated admin; no bypass of requireAuth / requireRole style checks
- Same data source as the public restaurant menu

3) CUSTOMER APP / PWA / WEBSITE
- Home order: browse menu, cart, place order
- Modes: takeaway + delivery (+ dine-in/scan if asked)
- Optional table/QR scan to order
- Clean UX; sync with shared catalog

4) MENU / DATA SYNC
- One catalog of truth (backend)
- Staff POS and public restaurant menu page stay in sync (items, prices, availability)
- No duplicated hard-coded menus that drift apart

RULES:
- Prefer existing AsFix patterns over new heavy libraries
- No Zobaze UI/feature clone — build for this restaurant’s real workflow
- Security: validate input, rate-limit public POSTs, no token/password logging
- When user asks to deploy: commit focused files + push origin/main (no force push, no secrets)
- Ask before large scope; implement only what is requested in each turn

First reply: short plan (files/areas you will touch), then wait for “go” unless user already said implement.
```

Roman Urdu: *Poora system — receipt, staff POS, customer order, menu sync — ek saath. Pehle plan, phir implement.*

---

## 2. Thermal print only

```
Focus ONLY on thermal receipt printing for [RESTAURANT_NAME]. Do not build customer app or unrelated POS features unless required for print.

REQUIREMENTS:
- Match paper receipt layout accurately (name, items, qty, price, total, footer)
- Paper width: follow [RECEIPT_NOTES] (58mm and/or 80mm)
- Owner receipt notes: [RECEIPT_NOTES]
- Use / extend existing AsFix-style print pipeline (thermal / Bluetooth / print queue) — no fake Windows kernel drivers
- Staff can print from counter / POS after a sale or custom bill style flow if needed
- Test mentally for 58 vs 80 cutoffs (line wrapping, logo size, QR)

STACK: React/Vite frontend, Express backend, Capacitor mobile/asfix-pos where print runs on Android.
Live: asfixgear.com patterns; push main only when user asks deploy.

No secrets in git. No Zobaze clone.

First: list exact files you will change for print only, then implement when asked.
```

Roman Urdu: *Sirf bill print — size aur naam paper jaisa hona chahiye.*

---

## 3. Staff POS APK only

```
Focus ONLY on the Staff POS Android APK / counter for [RESTAURANT_NAME].

REQUIREMENTS:
- Capacitor-style shell loading the POS web app (AsFix pattern: mobile/asfix-pos → live /pos)
- Counter: browse catalog, cart, charge, print receipt
- Admin/staff: products, orders, settings as needed — auth required (requireAuth + roles)
- Thermal print integration if already in stack; receipt notes: [RECEIPT_NOTES]
- Same catalog API as the restaurant — do not hard-code a separate menu
- Offline/edge cases: be honest; prefer stable online POS like AsFix unless user asks offline

Do NOT build the customer-facing order app in this task unless explicitly required for staff flows.
No secrets. No Zobaze clone. Push main only when user says deploy.

First: short plan (screens + API), then implement on go.
```

Roman Urdu: *Staff phone/tablet POS — counter + admin. Customer app alag task.*

---

## 4. Customer order APK / website page only

```
Focus ONLY on the customer-facing order experience for [RESTAURANT_NAME].

DELIVER:
- Website page and/or PWA / customer APK (clarify which the user wants)
- Home: menu browse, item detail, cart
- Order types: takeaway, delivery (and scan-to-table if requested)
- Checkout: customer name/phone, address for delivery, notes
- Orders hit the same backend catalog/orders API used by staff POS
- Clear status UX (placed / preparing / ready) if APIs exist or are in scope

Receipt printing is staff-side — do not expand into full thermal work unless asked.
Staff POS APK is out of scope for this prompt.

Receipt/brand notes for any customer-visible bill/confirmation: [RECEIPT_NOTES]

Stack: React/Vite + Express like AsFix. No secrets. No Zobaze clone.
Deploy: push main only when user asks.

First: propose routes/pages + data flow, then implement on go.
```

Roman Urdu: *Customer order — ghar se / takeaway / delivery / scan. Staff POS is prompt mein nahi.*

---

## 5. Menu sync POS → restaurant page

```
Focus ONLY on keeping the restaurant public menu in sync with Staff POS catalog for [RESTAURANT_NAME].

REQUIREMENTS:
- Single source of truth in the backend (products/categories/availability/prices)
- Staff POS reads/writes that catalog
- Public restaurant menu page reads the same API (or a public safe subset — no cost prices, no admin fields)
- When staff adds/edits/hides an item in POS, the website menu updates without a second manual list
- Handle images, sold-out, category order cleanly
- Do not duplicate menus in frontend constants

Out of scope unless asked: thermal redesign, full customer checkout, APK packaging.

Optional brand/receipt context (for naming consistency only): [RECEIPT_NOTES]

Stack: AsFix-like React/Vite + Express. No secrets. No Zobaze clone.
Push main only when user says deploy.

First: map current product APIs + menu page, then implement sync gaps on go.
```

Roman Urdu: *POS mein item add/edit → website restaurant menu pe same data. Do alag lists nahi.*

---

## Quick chooser

| Need | Copy section |
|------|----------------|
| Whole restaurant system | **1. Master** |
| Only printer / bill paper match | **2. Thermal** |
| Only staff counter APK | **3. Staff POS** |
| Only customer order site/app | **4. Customer** |
| Only menu sync POS ↔ page | **5. Menu sync** |
| Admin + POS same background | **[`docs/UI_BACKGROUND_AGENT_PROMPT.md`](./UI_BACKGROUND_AGENT_PROMPT.md)** |

---

*File purpose: hand this path to any agent. Do not treat this file as implemented product code.*
