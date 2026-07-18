# n8n + AsFix & Gear

Website (Vercel) aur API (Render) pehle se alag hain. **n8n unke saath webhook se attach hota hai** — Vercel pe n8n host mat karo (serverless sleep / time limits).

```
asfixgear.com (Vercel)
       │
       ▼
Render API  ──POST webhook──►  n8n (local / n8n Cloud / Railway)
  order | repair | contact         │
                                   ├─ Gmail / Telegram / Sheets
                                   └─ (baad mein social / WhatsApp API)
```

## 1) n8n chalao (local — free)

```powershell
cd C:\Users\asads\asfix-gear
docker compose -f docker-compose.n8n.yml up -d
```

Browser: [http://localhost:5678](http://localhost:5678)

Ya [n8n Cloud](https://n8n.io/cloud/) trial — public HTTPS webhook milta hai (Render se call asani).

## 2) Workflow (Gmail + Sheet + Review) — recommended

Full checklist: **[n8n/SETUP-GMAIL-SHEET.md](n8n/SETUP-GMAIL-SHEET.md)**

1. Import `n8n/asfix-gmail-sheet-review.json`
2. Google Sheet tab **Leads** (headers: `asfix-leads-sheet-template.csv`)
3. Connect **Gmail** + **Google Sheets** credentials in n8n
4. Paste Sheet ID in the Sheets node → **Active** ON
5. Copy Production Webhook URL → Render `N8N_WEBHOOK_URL`

Minimal webhook-only sample (no Gmail yet): `n8n/asfix-events-webhook.json`

## 3) Render pe env (API)

Render → `asfix-gear` service → **Environment**:

| Key | Value |
|-----|--------|
| `N8N_WEBHOOK_URL` | Production webhook URL (sab events) |

Optional (alag workflows):

- `N8N_WEBHOOK_ORDER`
- `N8N_WEBHOOK_REPAIR`
- `N8N_WEBHOOK_CONTACT`

Save → **Manual Deploy**.

Check: `https://asfix-gear.onrender.com/api/health` → `"n8n": "configured"`

## 4) Payload shape

```json
{
  "source": "asfixgear",
  "event": "order_created",
  "at": "2026-07-18T12:00:00.000Z",
  "data": { "order_id": "...", "customer_name": "...", "phone": "..." }
}
```

Events:

- `order_created`
- `repair_created`
- `contact_created`

## 5) Local n8n + live Render

Localhost webhook Render se **nahi** call hota. Options:

- **n8n Cloud / Railway** (public URL), ya
- [ngrok](https://ngrok.com/) → `ngrok http 5678` → us HTTPS URL ko `N8N_WEBHOOK_URL` do (sirf test)

## 6) Social / Canva / TikTok

Yeh attach **sirf website events** hai. IG/FB/TikTok + Canva cutout alag Meta/Canva APIs chahiye — pehle Gmail/Telegram/Sheet confirm karo.

## Security

- Webhook URL secret rakho (share mat karo)
- n8n mein spam / cold WhatsApp marketing mat lagaana
- Production pe n8n basic auth / VPN prefer karo
