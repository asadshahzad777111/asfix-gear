# AsFix & Gear — Automations Guide

Yeh guide batati hai ke project mein **kya automatic chalta hai** aur **Cursor Automations** kaise use karein.

---

## 1. Automatic (repo ke andar)

### GitHub Actions (jab GitHub par push karein)

| Workflow | Kab | Kya karta hai |
|----------|-----|----------------|
| `.github/workflows/ci.yml` | Har push / PR | install → seed → i18n check → secrets scan → frontend build → backend smoke (`/api/health`, `/api/products`) |
| `.github/workflows/deploy-hint.yml` | Manual (Actions tab) | Pre-deploy checklist + optional Render deploy hook |

**Activate:** GitHub repo connect karein → push to `main` → Actions tab mein CI green dikhe.

**Render one-click (optional):** Render se Deploy Hook URL lein → GitHub repo → Settings → Secrets → `RENDER_DEPLOY_HOOK` add karein → workflow manually run karein.

### Cursor Hooks (local Cursor IDE)

File: `.cursor/hooks.json`

| Hook | Event | Kaam |
|------|-------|------|
| `warn-env-commit.js` | `beforeShellExecution` | `git add/commit/push` par `.env` ya `backend/data` warning |
| `critical-file-hint.js` | `afterFileEdit` | Critical files edit par build/i18n reminder |

**Activate:** Hooks automatically load jab project open ho. Cursor → Settings → Hooks se verify karein.

### NPM scripts (terminal)

```powershell
npm run check:i18n      # en / roman / ur keys match
npm run check:secrets   # tracked files mein secrets scan
npm run build           # frontend production build
```

### Runtime (website)

- **Page Visibility polling** — `frontend/src/utils/visibilityPoll.js` — shop status, staff chat, admin desk tab hidden hone par polling band.
- **Gaming/Shop transitions** — `GamingContext.jsx` — faster timings (~1.1s total).

---

## 2. Cursor Project Rules

`.cursor/rules/` — agent ko hamesha ya file-specific guidance:

| Rule | Scope |
|------|--------|
| `security.mdc` | Secrets, auth, validation |
| `mobile-i18n.mdc` | 3 languages, mobile perf |
| `deploy.mdc` | Render deploy steps |
| `website-qa.mdc` | Menu, cart, repair QA |

**Activate:** Automatic jab aap Cursor Agent se is repo par kaam karein.

---

## 3. Project Skills

`.cursor/skills/` — agent specialized workflows:

| Skill | Use when |
|-------|----------|
| `deploy-asfix` | Deploy / Render / domain |
| `mobile-qa` | Mobile testing before merge |
| `add-product` | Naya product add karna |
| `security-audit` | PR ya deploy se pehle security |

**Activate:** Agent ko bolein: *"deploy-asfix skill use karo"* ya *"mobile QA run karo"*.

---

## 4. Cursor Automations (Cloud Agent)

Cursor → **Automations** → New automation. Neeche 4 recipes hain — **Trigger** aur **Prompt** copy-paste karein.

### Recipe 1 — Weekly site health (recommended)

| Field | Value |
|-------|--------|
| **Name** | AsFix Weekly Site Health |
| **Trigger** | Schedule — Every Monday 9:00 AM |
| **Repo** | Isi repo ka GitHub remote |
| **Prompt** | Neeche wala block |

```
AsFix & Gear weekly health check for this repo.

1. Run: npm run install:all && npm run seed && npm run build
2. Run: npm run check:i18n && npm run check:secrets
3. Grep frontend/src for TODO, FIXME, console.error left in production paths
4. List any broken image URLs in backend seed data patterns
5. Summarize: build OK/fail, i18n OK/fail, top 3 risks, suggested fixes

Keep summary short — Roman Urdu + English mix for the shop owner.
```

### Recipe 2 — PR security review

| Field | Value |
|-------|--------|
| **Name** | AsFix PR Security Review |
| **Trigger** | GitHub — Pull request opened |
| **Tools** | Comment on PRs (optional) |
| **Prompt** | |

```
Review this PR for AsFix & Gear security:

- Auth middleware on new/changed backend routes
- No .env, tokens, or password hashes committed
- Input validation on public POST endpoints (repairs, contact, orders)
- Staff-only UI still gated by isStaff
- Run npm run check:secrets mentally against the diff

Post a concise PR comment: Critical / Warning / OK with bullet fixes.
Reference .cursor/rules/security.mdc standards.
```

### Recipe 3 — Pre-deploy checklist (manual)

| Field | Value |
|-------|--------|
| **Name** | AsFix Pre-Deploy Checklist |
| **Trigger** | Manual |
| **Prompt** | |

```
Pre-deploy checklist for AsFix & Gear — follow DEPLOY.md:

1. npm run install:all && npm run seed && npm run build — all pass?
2. shop.js address/phone correct?
3. Admin default password changed after last seed?
4. Render build/start commands match DEPLOY.md?
5. Custom domain DNS steps listed if user asked for domain

Output a checkbox list the owner can follow before clicking Deploy on Render.
Roman Urdu + English.
```

### Recipe 4 — i18n sync check

| Field | Value |
|-------|--------|
| **Name** | AsFix i18n Sync |
| **Trigger** | GitHub — Pull request opened (or manual after translation edits) |
| **Prompt** | |

```
Verify frontend/src/locales/translations.js:

- LANGS must stay exactly: en, roman, ur
- Run npm run check:i18n
- If keys missing, list exact key paths and suggest Roman Urdu + Urdu strings for each missing key
- Do not add a 4th language

Comment on PR or reply with the diff summary.
```

---

## 5. Quick activation checklist

| Automation | Aap kya karein |
|------------|----------------|
| **CI** | GitHub push → Actions |
| **Hooks** | Project open in Cursor |
| **Rules / Skills** | Agent chat mein mention karein |
| **Weekly health** | Automations UI → Recipe 1 save |
| **PR security** | Automations UI → Recipe 2 + GitHub connect |
| **Pre-deploy** | Deploy se pehle Recipe 3 manual run |
| **i18n** | Translation PR par Recipe 4 |

---

## 6. Render + custom domain — next steps

1. **GitHub:** `git push` karein taake CI chale
2. **Render:** New Web Service → repo connect → build/start commands `DEPLOY.md` se
3. **Test:** Render URL → shop, repair, admin login
4. **Password:** `npm run reset-admin` locally ya admin UI se change
5. **Domain:** Namecheap/GoDaddy → Render Custom Domain → DNS CNAME
6. **Optional:** GitHub secret `RENDER_DEPLOY_HOOK` → manual deploy workflow

---

## Files created by this setup

```
.github/workflows/ci.yml
.github/workflows/deploy-hint.yml
.cursor/rules/security.mdc
.cursor/rules/mobile-i18n.mdc
.cursor/rules/deploy.mdc
.cursor/rules/website-qa.mdc
.cursor/hooks.json
.cursor/hooks/warn-env-commit.cjs
.cursor/hooks/critical-file-hint.cjs
.cursor/skills/deploy-asfix/SKILL.md
.cursor/skills/mobile-qa/SKILL.md
.cursor/skills/add-product/SKILL.md
.cursor/skills/security-audit/SKILL.md
scripts/check-i18n.js
scripts/check-secrets.js
AUTOMATIONS.md
```

Help chahiye ho to agent ko bolein: *"AUTOMATIONS.md ke hisaab se weekly health automation open karo"*.

---

## 7. GitHub Cursor App — "Danger zone" (normal)

GitHub → **Settings → Applications → Cursor** par **Danger zone** (Suspend / Uninstall) dikhna **expected** hai — yeh website error **nahi**.

- **Repository access:** *All repositories* **ya** sirf `asfix-gear` select karein → **Save**
- Automations / cloud agent ke liye repo access chahiye
- Website admin login is screen se alag hai

Detail: [STAFF-ACCESS.md](./STAFF-ACCESS.md) (GitHub section).
