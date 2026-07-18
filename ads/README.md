# Free AsFix ads (no Canva / Placid)

HTML templates + Playwright → PNG + caption text.

## Admin panel (easiest)

1. Staff login → **Admin** → sidebar **Create Ad**
2. Image choose karo, **name + rate** likho, **Generate ad**
3. **Download PNG** + **Copy caption** → IG/FB pe post
4. Agar R2 + `N8N_WEBHOOK_URL` set ho to cloud URL + `ad_created` event n8n ko bhi jati hai

Direct URL: `/admin?tab=ads`

## CLI (optional)

1. Product pic yahan rakho: `ads/inbox/your-product.jpg`
2. Generate:

```powershell
cd C:\Users\asads\asfix-gear
npm run generate:ad -- --image ads/inbox/your-product.jpg --title "Luxury MagSafe Case" --price "Rs 650"
```

Story size:

```powershell
npm run generate:ad -- --image ads/inbox/your-product.jpg --title "Luxury MagSafe Case" --price "Rs 650" --format story
```

3. Output:
- `ads/out/<name>-square.png` (ya `-story.png`)
- `ads/out/<name>-square.txt` (caption + hashtags)

4. Instagram / Facebook pe **manual post** (Meta auto baad mein — free API setup alag).

## First-time Playwright browsers

```powershell
npx playwright install chromium
```

## Folders

| Path | Use |
|------|-----|
| `ads/inbox/` | Tum raw product pics dalo |
| `ads/templates/` | Free HTML designs (edit colors/text) |
| `ads/out/` | Generated PNG + captions (gitignored) |

## Website events (alag — pehle se)

Orders / repairs / contact → n8n webhook: see `N8N.md` + `n8n/RENDER-FREE-SETUP.md`.

Ads generator website stock/rates ko auto-post nahi karta — pehle creative banao, phir post.
