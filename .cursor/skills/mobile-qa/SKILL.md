---
name: mobile-qa
description: Mobile QA pass for AsFix & Gear — nav drawer, cart, repair form, 3 languages. Use before merge or when user reports mobile bugs.
---
# Mobile QA — AsFix & Gear

## Viewport

Test at **375×812** (iPhone) and **390×844** in browser DevTools.

## Checklist

### Navigation
- Open/close mobile menu; focus bar follows finger
- Language switch: en → roman → ur — no overflow or broken RTL
- Gaming + Shop mode buttons work; transitions complete in < 1.5s

### Shop
- Products load; add/remove cart items
- Checkout submits; price formatting correct
- Open/closed badge matches API

### Repair
- Full booking flow on mobile; validation messages translated
- Screen quality cards tappable

### Performance
- Tab hidden → polling pauses (Network tab quiet after visibility hidden)
- No horizontal scroll on main pages

## Commands

```powershell
npm run build
npm run dev
```

Rule reference: `.cursor/rules/website-qa.mdc`
