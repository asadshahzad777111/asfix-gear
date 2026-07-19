# AsFix Products — Google Sheet process

Tight, professional stock sheet for AsFix & Gear.  
**Master of truth remains the website admin** until sync is built. This sheet is your day-to-day working copy + search.

## Files

| File | Purpose |
|------|---------|
| `AsFix_Products_Master.csv` | Import into Google Sheets (headers + example rows) |
| `GOOGLE_SHEETS_SETUP.txt` | Step-by-step: import, formulas, Search tab, share |

## Quick start

1. Open [Google Sheets](https://sheets.google.com) → **Blank**
2. **File → Import → Upload** → `AsFix_Products_Master.csv`
3. Rename sheet tab to **Products**
4. Follow `GOOGLE_SHEETS_SETUP.txt` (sale_price formula + Search tab)
5. Share with staff (Editor / Viewer)

## Columns (match website)

`id` · `name` · `category` · `price` · `discount_percent` · `sale_price` · `stock` · `compatible_models` · `status` · `notes`

## Rules

1. Edit sheet during the day; push important changes to website admin.
2. Do not treat sheet as final truth until website sync exists.
3. Billing / thermal print = later phase (not in this sheet).

## Next (when you ask)

- Export live products from website into this CSV
- Sync sheet ↔ website
- Bill print layout + mobile Bluetooth printer
