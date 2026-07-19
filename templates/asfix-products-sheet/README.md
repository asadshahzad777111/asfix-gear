# AsFix Products Sheet — full setup

## Live on website (recommended)

Staff login → **Admin → Products → Products Sheet**  
(or Dashboard → **Products Sheet**, or `/admin?tab=sheet`)

- Type product name → matching rows (price, discount, sale, stock)
- Edit inline → **Save** → website updates immediately
- **Export → Google Sheets** downloads CSV and opens Google Sheets
- **Import CSV** pulls Sheet edits back into the website

Live catalog snapshot: `AsFix_Products_Master_LIVE.csv` (re-export anytime from Admin).

Mobile + laptop: same Admin URL after staff login.

## Google Sheets (optional offline copy)

1. Admin → Products Sheet → **Export → Google Sheets**
2. In the new Google Sheet: **File → Import → Upload** the downloaded CSV
3. Edit prices/stock on the Sheet when needed
4. **File → Download → Comma Separated Values (.csv)**
5. Admin → Products Sheet → **Import CSV**

Master of truth = **website**. Sheet is a working / backup copy.

## Template files (manual seed)

| File | Purpose |
|------|---------|
| `AsFix_Products_Master.csv` | Blank starter if you have no products yet |
| `GOOGLE_SHEETS_SETUP.txt` | Search-tab formulas for a pure Sheets workflow |

## Bill print

Later phase — not part of this sheet setup.
