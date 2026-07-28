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
| remote print / iPhone print | Print queue: `backend/routes/print-jobs.js`, `useSmartThermalPrint`, agents |
| light/dark theme | ThemeContext + Counter bar (`asfix-theme`) |
| Android POS app | `mobile/asfix-pos/` — JS fixes often need **website deploy only** (app loads asfixgear.com/pos) |
| shop phone/address | `frontend/src/config/shop.js` only |

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

## Before claiming done

- Frontend build should pass: `npm run build --prefix frontend`
- i18n: `npm run check:i18n` if strings changed
- Secrets: do not commit env files; ignore false positives in Android `gradlew` if unrelated

## Reply style for this owner

- Short, direct; Roman Urdu + English OK.
- After deploy: give exact next tap on phone (refresh / Select printer / Print).

## Cursor Cloud specific instructions

Dev environment is Node-only; deps are auto-installed on VM startup via the update script (`npm run install:all`). No DB, `.env`, or cloud creds are needed for local dev — the backend defaults to a JSON file store when `MONGODB_URI` is unset.

- Seed first: `npm run seed` creates the gitignored `backend/data/data.json` (8 products, gaming items, repair rates) plus a default admin (`asad` / `AsFix2026!`). A fresh Cloud VM has no data until you seed, so run this before expecting products/login to work. Re-seeding overwrites the local store.
- Run: `npm run dev` starts backend on `:5000` and Vite frontend on `:5173` together. Open `http://localhost:5173`. Vite proxies `/api` → `127.0.0.1:5000`, so no CORS/env setup is needed locally.
- Build/checks (standard commands, see root `package.json`): `npm run build --prefix frontend`, `npm run check:i18n` (if strings changed).
- `npm run check:secrets` reports a known false positive on `mobile/asfix-pos/android/gradlew` — ignore it (already noted in "Before claiming done").
- `mobile/asfix-pos/` (Capacitor Android) is not part of web dev — it just wraps the live `/pos` route and needs the Android SDK, which is not set up here.
