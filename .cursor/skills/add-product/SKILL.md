---
name: add-product
description: Add a new shop or gaming product to AsFix & Gear via staff UI or seed data. Use when user wants new inventory items.
---
# Add product — AsFix & Gear

## Staff UI (preferred)

1. Log in as staff/admin
2. Click **+ Product** in staff toolbar or admin dashboard
3. Fill name, price, category, image URL, stock
4. Save — product appears in shop/gaming grid via API

## Seed / bulk (dev)

- Shop products: edit `backend/seed.js` or `backend/data/` after seed
- Gaming products: `backend/seed-gaming.js`
- Re-run: `npm run seed`

## Frontend

- Product cards read from `/api/products` — no hardcoded list in React unless fallback
- New categories may need translation keys in `frontend/src/locales/translations.js` (all 3 langs)

## Images

- Use HTTPS image URLs; run `node backend/fix-images.js` if broken links after seed
