# Staff Access — AsFix & Gear

Professional team login and Super Admin controls for shop staff.

---

## GitHub / Cursor settings (NOT a website error)

Agar aap **GitHub** par **Cursor GitHub App** settings dekhte hain aur neeche **"Danger zone"** (Suspend / Uninstall) dikhe — yeh **normal** hai. Yeh aapki website ka error **nahi** hai.

| Kya karein | Detail |
|------------|--------|
| **Repository access** | **All repositories** select karein **ya** sirf `asfix-gear` repo choose karein |
| **Save** | Changes ke baad **Save** zaroor click karein |
| **Danger zone** | Sirf tab use karein jab app hataani ho — daily use ke liye ignore karein |

Yeh screen Cursor ko GitHub repo se connect karne ke liye hoti hai (Automations, PR review, cloud agent). AsFix website (`/login`, shop, admin) is se alag chalti hai.

---

## Roles

| Role | Login | Permissions |
|------|-------|-------------|
| **Super Admin** (owner `asad`) | Gmail + password | Full control + **Team Access** |
| **Admin** | Gmail + password | Products, orders, repairs — no team settings |
| **Staff Editor** | Gmail + password | View/update orders & repairs — no delete, no team |

---

## Staff login rules

- Staff **@gmail.com** se login karte hain (e.g. `ali@gmail.com`)
- Password **hashed** store hota hai (`scrypt` — readable plaintext DB mein **kabhi** nahi)
- **Blocked** staff login nahi kar sakte — clear error message

---

## Super Admin — Team Access

**Kahan:** `/admin` → **Team** tab **ya** floating **Ops** desk → **Team** tab (super admin only)

### Naya staff add karna

1. **Full Name**, **Gmail** (`@gmail.com`), **Role** (Staff Editor / Admin)
2. **Password** + **Confirm password** (min 6 chars)
3. Submit → modal mein password **ek dafa** dikhega → **Copy** karke staff ko WhatsApp/securely bhejein
4. Password DB mein hash ke tor par save — dubara show nahi hoga

### Staff list

| Column | Meaning |
|--------|---------|
| Name | Display name |
| Gmail | Login email |
| Role | Admin / Staff Editor |
| Status | **Active** (green) / **Blocked** (red) |
| Last login | Last successful sign-in |
| Actions | Block, Reset PW, Remove |

### Block / Unblock

- **Block** → staff turant logout (sessions clear), login fail
- **Unblock** → staff dubara login kar sakta hai

### Reset password

1. **Reset PW** → naya password set karein
2. Modal mein naya password **ek dafa** show — copy karein

### Remove

- Staff account delete (super admin khud ko remove nahi kar sakta)

---

## API (super_admin only)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/users` | List team |
| POST | `/api/auth/users` | Create staff — returns `temporary_password` once |
| PATCH | `/api/auth/users/:id/block` | Toggle `blocked` |
| PATCH | `/api/auth/users/:id/reset-password` | Reset — returns `temporary_password` once |
| DELETE | `/api/auth/users/:id` | Remove staff |

Staff (`editor` / `admin`) in routes par **403** milta hai.

---

## User record (`data.json`)

```json
{
  "id": 2,
  "name": "Ali Khan",
  "email": "ali@gmail.com",
  "username": "ali",
  "password_hash": "salt:hash",
  "role": "editor",
  "active": true,
  "blocked": false,
  "created_at": "2026-06-29T...",
  "last_login": "2026-06-29T...",
  "created_by": 1
}
```

**Never commit** real `data.json` with production passwords to GitHub.

---

## Quick test

```powershell
npm run dev
```

1. Login as super admin (`asad` / seed password)
2. Admin → Team → add `test@gmail.com` staff
3. Copy password from modal → logout → login as new staff
4. Block staff from Team tab → login should fail with blocked message

See also: [AUTOMATIONS.md](./AUTOMATIONS.md) for Cursor GitHub app + automations.
