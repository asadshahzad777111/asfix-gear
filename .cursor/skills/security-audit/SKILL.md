---
name: security-audit
description: Security audit for AsFix & Gear — auth routes, env leaks, input validation. Use on PRs or before deploy.
---
# Security audit — AsFix & Gear

## Automated

```powershell
node scripts/check-secrets.js
```

## Manual review areas

### Auth (`backend/routes/auth.js`, `frontend/src/context/AuthContext.jsx`)
- Token required on staff mutations
- Passwords hashed, never returned in JSON
- Logout clears localStorage token

### Public endpoints
- `repairs`, `contact`, `orders` — validate required fields, reject oversize payloads
- No path traversal in static file serving

### Client
- No secrets in `frontend/src/` or committed env files
- WhatsApp links use shop phone from config, not user-controlled domains

### Data
- `backend/data/` must stay gitignored
- Production re-seeds on Render build — change default admin password after first login

Rule reference: `.cursor/rules/security.mdc`
