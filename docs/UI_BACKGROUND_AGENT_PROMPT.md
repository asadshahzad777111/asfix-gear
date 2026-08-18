# UI background — Agent prompt (Admin + Super user + POS)

Copy the block below into a new Cursor Agent chat. Fill `[RESTAURANT_NAME]` (or brand name) before send.

Roman Urdu: *Admin, Super user, aur POS APK WebView ka background ek hi hona chahiye — mixed themes nahi.*

---

## Copy-paste prompt

```
Keep Admin + Super user + POS APK WebView background identical for [RESTAURANT_NAME]. No mixed themes.

CONTEXT:
- Staff POS Android APK loads the live website WebView (e.g. /pos) — CSS/theme must match Admin panels.
- Super user and Admin use the same chrome/background; roles differ, atmosphere does not.
- Public storefront marketing pages already use shared theme tokens — do not invent a separate staff-only flat gray (no WordPress #f0f0f1 shell) that fights the shop look.

SHARED TOKENS (required):
- Use CSS variables from themes.css: `--asfix-bg`, `--asfix-bg-gradient` (aliases of `--bg` / `--bg-gradient`).
- Apply the same shell background to:
  - `.app--admin`
  - `.wp-admin-shell` (Admin + Super user)
  - `.counter-shell` / POS (`/pos`) — including `.wp-admin-shell.counter-shell`
- Dark + light follow `data-theme` / `asfix-theme` (ThemeContext). One composition: subtle orange mist / midnight gradient already used on the shop body — not a different flat panel per role.
- Do NOT override `--asfix-bg` or `--asfix-bg-gradient` inside Admin/POS shells to a hard-coded gray or charcoal that diverges from the shop.

RULES:
- Prefer existing AsFix patterns; no new theme system.
- Cards/panels may stay elevated (white or dark surfaces) — the ROOT/SHELL atmosphere must match.
- Notifications / Gmail-inbox alert UI styling must sit on this same shell; do not introduce a second “comes and goes” background.
- No secrets in git. Push to main only when the user says deploy / live / push / “kr do”.

After implement: tell user to hard-refresh the site and reopen the POS APK so WebView picks up CSS.
```

---

## AsFix reference (already wired)

| Token | Source | Used by |
|-------|--------|---------|
| `--asfix-bg` | `frontend/src/themes.css` (`[data-theme]`) | Admin shell, POS shell |
| `--asfix-bg-gradient` | same | Admin shell, POS shell |
| `--pos-shell-bg` | `admin-counter-bill.css` → `var(--asfix-bg)` | `/pos` Counter |

Files to touch if atmosphere drifts again: `themes.css`, `admin-wp.css`, `admin-counter-bill.css` (not public marketing layouts unless they already share tokens).
