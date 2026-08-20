# AsFix & Gear — Agent instructions

Use this file when working from **Cursor Mobile** or **Cloud Agents**. The live site is controlled by pushing to `main` (Vercel frontend + Render API).

## Product

- **Shop:** AsFix & Gear — Lahore mobile repair + accessories  
- **Live site:** https://asfixgear.com  
- **Repo:** https://github.com/asadshahzad777111/asfix-gear  
- **Default branch:** `main`

## Stack

| Part | Path | Host |
|------|------|------|
| Frontend (React/Vite) | `frontend/` | Vercel → asfixgear.com |
| Backend (Express API) | `backend/` | Render |
| POS Android shell | `mobile/asfix-pos/` | Capacitor app loads live `/pos` |

## How to change the live website (mobile / cloud)

1. Edit code in this repo (Cloud Agent works on a GitHub clone).
2. Commit focused changes (no secrets).
3. **Push to `origin/main`** when the user says deploy / live / push / “kr do”.
4. Wait ~1–3 minutes for Vercel (UI) and Render (API) auto-deploy.
5. Tell the user to hard-refresh or reopen the AsFix POS app.

Do **not** force-push. Do **not** commit `.env`, `.env.txt`, or `backend/data/data.json` with real customer data.

## Common mobile commands (map user intent)

| User says (EN / Roman Urdu) | Do this |
|-----------------------------|---------|
| deploy / live / push / “deploy kr do” | Commit relevant files + `git push origin main` |
| fix POS / counter / print | `frontend/src/pages/Counter.jsx`, `AdminCounterBill.jsx`, print utils |
| custom bill / freeform bill / Osama bill / repair parts bill | `/pos` → **Custom bill** tab — see [POS Custom bill](#pos-custom-bill) |
| remote print / iPhone print | Print queue: `backend/routes/print-jobs.js`, `useSmartThermalPrint`, agents |
| light/dark theme | ThemeContext + Counter bar (`asfix-theme`) |
| Android POS app | `mobile/asfix-pos/` — JS fixes often need **website deploy only** (app loads asfixgear.com/pos) |
| shop phone/address | `frontend/src/config/shop.js` only |

## POS Custom bill

Freeform repair/parts bill on live POS (no inventory sale). Files: `frontend/src/components/admin/PosCustomBill.jsx`, receipt overrides in `AdminCounterBill.jsx`, mono helpers in `frontend/src/utils/receiptLogo.js`, shop profiles in `frontend/src/config/posCustomBillProfiles.js`.

- Open: AsFix POS / `/pos` → tab **Custom bill** (next to **Sale bill**). Same screen on **laptop browser** and phone.
- Shop identity setting: **My shop (AsFix)** vs **Someone else** — name / place / phone / logo / scanner-QR. Tap **Save as setting** to sync text fields phone ↔ laptop (Admin → Payments also has Custom bill profiles).
- Each line: **Name + Qty + Rate**. Empty name boxes are ignored and do not print.
- Optional **Save to DB when printing** / **Save to stock & sales**: asks **Actual rate (cost)** + **Sale price** per named line, upserts `POS Custom` products, then records a counter sale (`POST /orders/custom-bill-save`). Print-only still works with the checkbox off.
- Editable shop name / place / phone / date / time / mobile model / customer / notes.
- Optional **logo** (image upload) and **scanner/QR** (link text or QR PIC). Custom bills skip AsFix logo/site QR unless those options are on.
- Print uses the same thermal pipeline as sale receipts (`printSmart` / native BT).
- Draft persists in `localStorage` (`asfix_pos_custom_bill_v2`); logo/PIC per profile in `asfix_pos_custom_bill_media_v1`.

Phone after deploy: reopen AsFix POS → `/pos` → **Custom bill** → pick **My shop** or **Someone else** → fill lines → **Save as setting** (optional) → **Print bill**.

Laptop: open https://asfixgear.com/pos → same **Custom bill** tab.

## POS + thermal print (short)

- **AsFix POS Android app** prints via Bluetooth SPP plugin when printer is selected.
- **iPhone** cannot BT-print; use Print chooser → **Android / Laptop / Any station**.
- Android station must keep **AsFix POS open** + printer selected (agent polls print jobs).
- Laptop station needs COM bridge (`npm run thermal:bridge`) when a real serial COM exists.

## Security (always)

- Staff routes: `requireAuth` + `requireRole`.
- Never log tokens/passwords.
- Never invent Windows kernel printer drivers.
- Prefer existing patterns in `frontend/` and `backend/`.
- Cursor **GitHub Connect** UI (`cursor.com/api/auth/connect-github`) may 500/timeout; agents can still `git push` with existing remotes — do not block deploys on ConnectScm.

## Cursor Cloud specific instructions

- Boot deps: `.cursor/environment.json` runs `npm run install:all` (this is also the startup update script).
- Local run: `npm run dev` starts backend (:5000) + frontend (:5173) concurrently; Vite proxies `/api` → `127.0.0.1:5000`. No MongoDB needed — backend defaults to the JSON file store (`backend/data/data.json`); confirm via `GET /api/health` (`storage: json, ready: true`).
- First run needs data: `npm run seed` populates products, gaming items, repair services, and the seed super-admin (username `asad`, seed password in `seed-admin.js`). Re-seeding overwrites `backend/data/data.json`, so avoid it if you have local data you want to keep.
- Dev OTP: with no email/SMS provider configured, `NODE_ENV` is unset so signup/login OTP runs in dev mode — the 6-digit code is returned as `devCode` and shown on-screen as "Dev code" (and logged as `[OTP dev]`). Customer signup/login work end-to-end without real email. `register/start` regenerates the code each call, so verify with the most recently shown code (or drive `/api/auth/register/start` → `/api/auth/register/verify` directly).
- Cloud VM has **no shop Bluetooth printer** — verify JS/API only; ask user to test print on Android POS.
- Prefer PR → merge when unsure; push direct to `main` only if user clearly says deploy / live / “kr do”.
- Never commit secrets; put API keys in [Cloud Agents Secrets](https://cursor.com/dashboard/cloud-agents), not git.
- Useful checks: `npm run build --prefix frontend`, `npm run check:i18n`, `npm run check:secrets`.
- Full deploy notes: `DEPLOY.md` and `.cursor/skills/deploy-asfix/SKILL.md`.

## Before claiming done

- Frontend build should pass: `npm run build --prefix frontend`
- i18n: `npm run check:i18n` if strings changed
- Secrets: do not commit env files; ignore false positives in Android `gradlew` if unrelated

## Reply style for this owner

- Short, direct; Roman Urdu + English OK.
- After deploy: give exact next tap on phone (refresh / Select printer / Print).
