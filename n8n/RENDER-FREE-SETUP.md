# Free n8n on Render (+ free Postgres)

Community n8n (Docker) + Render PostgreSQL. **Free tier sleeps** after idle — pehla webhook ~30–60s late ho sakta hai. Baad mein paid instance / paid DB le lena.

```
asfixgear.com API (asfix-gear)
        │
        │  N8N_WEBHOOK_URL
        ▼
asfix-n8n.onrender.com  ←──  asfix-n8n-db (Postgres)
```

## A) Render pe PostgreSQL (free)

1. [Render Dashboard](https://dashboard.render.com) → **New +** → **PostgreSQL**
2. Name: `asfix-n8n-db`
3. Plan: **Free**
4. Region: same as your other services (e.g. Oregon / Singapore — jo API use karti ho)
5. **Create Database**
6. Database page → **Connections** / **Info** se ye copy karo (Internal):
   - Host
   - Port
   - Database
   - User
   - Password

## B) Render pe n8n Web Service (Docker, free)

1. **New +** → **Web Service**
2. Connect GitHub repo `asadshahzad777111/asfix-gear`
3. Settings:
   - **Name:** `asfix-n8n`
   - **Language / Runtime:** **Docker**
   - **Dockerfile Path:** `n8n/Dockerfile`
   - **Docker Context:** `n8n` (agar field ho)
   - **Branch:** `main`
   - **Instance type:** **Free**
4. **Environment** variables:

| Key | Value |
|-----|--------|
| `DB_TYPE` | `postgresdb` |
| `DB_POSTGRESDB_HOST` | *(from Postgres Internal Host)* |
| `DB_POSTGRESDB_PORT` | `5432` (ya jo dikhe) |
| `DB_POSTGRESDB_DATABASE` | *(database name)* |
| `DB_POSTGRESDB_USER` | *(user)* |
| `DB_POSTGRESDB_PASSWORD` | *(password)* |
| `DB_POSTGRESDB_SSL_ENABLED` | `true` |
| `N8N_PROTOCOL` | `https` |
| `N8N_ENCRYPTION_KEY` | koi random 32+ character string (ek baar set, kabhi change mat karna) |
| `GENERIC_TIMEZONE` | `Asia/Karachi` |
| `TZ` | `Asia/Karachi` |

5. **Create Web Service** → pehla deploy wait karo (~5–10 min pehli baar).
6. Jab URL mil jaye (example `https://asfix-n8n.onrender.com`):

| Key | Value |
|-----|--------|
| `N8N_HOST` | `asfix-n8n.onrender.com` *(bina https://)* |
| `WEBHOOK_URL` | `https://asfix-n8n.onrender.com/` |

7. Save → **Manual Deploy** dubara.

## C) n8n pe pehli setup

1. Browser: `https://asfix-n8n.onrender.com` (sleep ho to 1 min wait)
2. Owner account banao (email + password) — yeh **tumhara** n8n login hai
3. **Import** workflow: `n8n/asfix-gmail-sheet-review.json`
4. Google Sheets + Gmail credentials connect
5. Workflow **Active**
6. Webhook **Production URL** copy  
   Example: `https://asfix-n8n.onrender.com/webhook/asfix-events`

## D) AsFix API se jodo

Render → service **`asfix-gear`** (website API) → Environment:

| Key | Value |
|-----|--------|
| `N8N_WEBHOOK_URL` | Production webhook URL from step C |

Save → Manual Deploy API.

Check: `https://asfix-gear.onrender.com/api/health` → `"n8n":"configured"`

## E) Local free test (optional)

```powershell
cd C:\Users\asads\asfix-gear
docker compose up -d
```

Open http://localhost:5678 — Postgres included. Live API localhost hit nahi karti; sirf practice.

## Files

| File | Role |
|------|------|
| `n8n/Dockerfile` | Render Docker image |
| `n8n/render-start.sh` | Maps Render `PORT` → n8n |
| `docker-compose.yml` | Local n8n + Postgres |
| `n8n/render.yaml` | Optional Blueprint (advanced) |

## Paid upgrade later

- Render Web Service → paid (no sleep)
- Postgres → paid (no pause)
- Same env vars; encryption key **same** rakho warna credentials toot jayengi
