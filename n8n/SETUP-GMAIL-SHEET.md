# AsFix n8n — Gmail + Sheet + Review (abhi ye karo)

API pehle se events bhejti hai. Tumhe **n8n credentials + Render URL** set karne hain.

## Tum provide / prepare karo

| Cheez | Kaise |
|--------|--------|
| **n8n host** | [n8n Cloud](https://app.n8n.cloud) trial **ya** `docker compose -f docker-compose.n8n.yml up -d` + [ngrok](https://ngrok.com) public URL |
| **Google Sheet** | New Sheet → pehli row headers from `asfix-leads-sheet-template.csv` → tab rename **`Leads`** → URL se Sheet ID copy (`/d/SHEET_ID/edit`) |
| **Gmail** | Shop Gmail (`asadshahzad777111@gmail.com`) → n8n mein **Gmail** credential (OAuth “Sign in with Google” asaan) |
| **Google Sheets** | n8n mein **Google Sheets** credential (same Google account) |
| **Review link (optional)** | Google Business review short link → Render env `SHOP_GOOGLE_REVIEW_URL=https://...` |

## Steps (order)

1. n8n open → **Import** → `n8n/asfix-gmail-sheet-review.json`
2. Node **Append Google Sheet** → `PASTE_GOOGLE_SHEET_ID_HERE` hata ke apni Sheet ID
3. Har Gmail / Sheets node pe **Credential** select / create
4. Workflow **Active = ON**
5. **AsFix Webhook** → Production URL copy  
   Example: `https://xxxx.app.n8n.cloud/webhook/asfix-events`
6. **Render** → `asfix-gear` → Environment:
   ```
   N8N_WEBHOOK_URL=https://xxxx.app.n8n.cloud/webhook/asfix-events
   SHOP_GOOGLE_REVIEW_URL=https://g.page/r/YOUR_REVIEW_LINK
   ```
   → Save → **Manual Deploy**
7. Test:
   - Site se **Contact** form → Sheet mein row + (agar order/repair) shop Gmail
   - Staff panel se repair status **completed** → 2 din baad review email (customer email ho to)

## Events

| Event | Sheet | Gmail |
|-------|-------|-------|
| `order_created` | ✅ | Shop ko order alert |
| `repair_created` | ✅ | Shop ko repair alert |
| `contact_created` | ✅ | (sirf Sheet; chaho to Gmail node add) |
| `repair_completed` | ✅ | 2 din wait → customer review **agar email ho** |

**Note:** Repair form pe aksar sirf phone hota hai — email na ho to shop ko “review skip” email jati hai; WhatsApp se manually review link bhejo.

## Health check

`https://asfix-gear.onrender.com/api/health` → `"n8n": "configured"`
