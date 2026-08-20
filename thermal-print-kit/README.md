# Thermal Print Kit (POS Bluetooth + ESC/POS)

Yeh kit AsFix & Gear website ke **thermal printer / POS bill print system** ka portable copy hai. Ise apni **doosri website ki POS app (Capacitor Android APK)** me daal kar wahi Bluetooth thermal printing chala sakte hain — bill print, ESC/POS, QR, aur cross-device (iPhone → Android/laptop) remote print queue.

> This is a self-contained, reusable copy of the AsFix thermal printing system. Drop it into another Capacitor-based POS website + Express backend to get Bluetooth (SPP) ESC/POS receipt printing, plus an optional cross-device print queue.

---

## Kit me kya hai / What's inside

```
thermal-print-kit/
├── capacitor-plugin/asfix-thermal-print/   # Android Bluetooth SPP ESC/POS plugin (CORE)
│   ├── android/…/AsfixThermalPrintPlugin.java   # native RFCOMM print (listPrinters/connect/printText/printEscPos)
│   ├── src/ (definitions.ts, index.ts, web.ts)  # TS API + web stub
│   └── package.json, tsconfig.json, rollup.config.mjs
├── web/                                     # Website JS (works inside the APK WebView + browser)
│   ├── nativePosPrint.js         # Capacitor bridge → the plugin (saved printer, print text/ESC-POS)
│   ├── receiptEscPos.js          # Generic receipt builder → text + ESC/POS base64 (SHOP-configurable)
│   ├── localPrint.js             # "Print on this device" (native SPP → laptop bridge/BLE → browser)
│   ├── remoteThermalPrint.js     # Cross-device queue client (enqueue, station status)
│   ├── printJobAgent.js          # Station agent: polls queue + prints (Android/laptop)
│   ├── thermalLaptopPrint.js     # Desktop: localhost COM bridge + Web Bluetooth (BLE)
│   ├── visibilityPoll.js         # Poll only while tab is visible
│   ├── printApi.js               # Standalone /api/print-jobs client (configure baseUrl + token)
│   ├── useSmartThermalPrint.jsx  # React hook: one Print button → local or chooser → remote
│   ├── PrintTargetChooser.jsx    # Modal: local / Android / laptop / any (plain-English labels)
│   └── print-target-chooser.css
├── backend/                                 # Express print queue (optional, for cross-device)
│   ├── printJobsStore.js         # In-memory (or JSON-file) print-job store
│   └── printJobsRoute.js         # Express router (inject your auth)
├── scripts/
│   ├── thermal-print-bridge.mjs  # Laptop: localhost:9100 → writes ESC/POS to a COM port
│   └── send-thermal-com.mjs      # One-shot COM test
└── docs/thermal-printer-windows.md
```

## Print kaise chalta hai / How a print flows

1. POS UI par **Print** dabao → `useSmartThermalPrint().printSmart(order)`.
2. Agar app **Android APK** me chal rahi hai aur ek printer saved hai → seedha **Bluetooth SPP** par print (`nativePosPrint` → plugin).
3. Warna ek **chooser** khulta hai: *This device / Android station / Laptop station / Any*.
4. Remote choose karne par receipt **`POST /api/print-jobs`** me chali jati hai; jis device par printer laga hai (Android POS ya laptop bridge) wahan **agent** us job ko poll karke print kar deta hai.
5. Receipt raw **ESC/POS** hai (alignment, bold, double-size, QR, auto-cut) — 58mm (32 col) ya 80mm (48 col).

Bluetooth SPP UUID: `00001101-0000-1000-8000-00805F9B34FB` · Bridge: `http://127.0.0.1:9100`

---

## 1) Android APK — Capacitor plugin (yeh sabse zaroori hai)

Yeh native plugin hi asli Bluetooth printing karta hai. Baaki sab optional hai.

1. Plugin folder apni POS app me copy karo, e.g. `mobile/<your-pos>/plugins/asfix-thermal-print/`.
2. App ke `package.json` me local dependency add karo:
   ```jsonc
   // mobile/<your-pos>/package.json
   "dependencies": {
     "@asfixgear/asfix-thermal-print": "file:./plugins/asfix-thermal-print",
     "@capacitor/core": "^6.0.0",
     "@capacitor/preferences": "^6.0.0"
   }
   ```
   (Plugin ka naam waisa hi rehne dein — website JS `registerPlugin('AsfixThermalPrint')` isi naam se dhoondta hai. Chahein to rename kar sakte hain, par dono jagah badalna hoga.)
3. Plugin build karo, phir Capacitor sync:
   ```bash
   cd mobile/<your-pos>/plugins/asfix-thermal-print && npm install && npm run build
   cd ../.. && npm install && npx cap sync android
   ```
4. `capacitor.config.json` me apni live POS URL do (ya local webDir):
   ```jsonc
   { "server": { "url": "https://your-pos-site.com/pos", "cleartext": false } }
   ```
5. Android Studio me open karke APK banao: `npx cap open android`.

**Bluetooth permissions** plugin ke `AndroidManifest.xml` me already hain (Android 12+ `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN`, legacy BT). Printer ko pehle Android **Settings → Bluetooth** me pair karo, phir POS me select karo.

Plugin API (`definitions.ts`):
`listPrinters()`, `connect({address})`, `printText({text,address})`, `printEscPos({dataBase64,address})`, `getStatus()`, `requestPermissions()`.

---

## 2) Website JS (React) integration

`web/` files apne frontend me copy karo (e.g. `src/print/`). Sirf `@capacitor/core` + `@capacitor/preferences` chahiye (jo POS site me pehle se hote hain).

**a) Startup par API + shop config set karo:**
```js
import { configurePrintApi } from './print/printApi';
import { configureReceipt } from './print/receiptEscPos';

configurePrintApi({
  baseUrl: '/api',                                  // ya 'https://api.myshop.com/api'
  getToken: () => localStorage.getItem('my_auth_token'),
});

configureReceipt({
  shopName: 'MY SHOP',
  subtitle: 'Mobile & Accessories',
  addressLines: ['Main Bazaar, Lahore'],
  phone: '0300-1234567',
  qrUrl: 'https://myshop.com',                       // optional bottom QR
});
```

**b) POS page me Print button:**
```jsx
import { useSmartThermalPrint } from './print/useSmartThermalPrint';

function CounterBill({ order }) {
  const { printSmart, chooser } = useSmartThermalPrint({ thermalWidth: '58mm' });
  return (
    <>
      <button onClick={() => printSmart(order)}>Print bill</button>
      {chooser}
    </>
  );
}
```

`order` shape (`receiptEscPos.js` isi ko samajhta hai):
```js
{
  order_id: 'INV-1024', created_at: '2026-08-20T14:30:00Z',
  items: [{ name: 'Screen Protector', price: 500, qty: 2 }],
  subtotal: 1000, discount_amount: 100, grand_total: 900,
  payment_mode: 'cash', customer_name: 'Ali', phone: '03001234567',
  created_by_staff_name: 'Counter',
}
```

Sirf "is device par print" chahiye (no chooser)? Direct use karo:
```js
import { printLocalReceipt } from './print/localPrint';
await printLocalReceipt({ order, thermalWidth: '58mm' });
```

Chooser ke labels apni language me chahiye? `useSmartThermalPrint({ labels: { title: 'Kahan print karein?', confirm: 'Print karo', … } })`.

---

## 3) Backend — cross-device print queue (optional)

Sirf tab chahiye jab iPhone/doosre device se print karke kisi Android/laptop station par nikalna ho. Agar sirf usi Android APK par print karna hai (jispar printer laga hai), tab yeh skip kar sakte hain.

```js
import express from 'express';
import { createPrintJobsStore } from './backend/printJobsStore.js';
import { createPrintJobsRouter } from './backend/printJobsRoute.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

const printStore = createPrintJobsStore(); // ya { filePath: './data/print-jobs.json' }

app.use('/api/print-jobs', createPrintJobsRouter({
  store: printStore,
  // Apna staff/counter auth do. Ye req.auth = { user: { id, name, role } } set kare
  // aur non-staff ko 401 de. (AsFix me: requireAuth + requireRole('counter', …))
  requireAuth: myStaffAuthMiddleware,
}));
```

Dev/testing ke liye jaldi chalana ho to shared token bhi de sakte hain:
```js
app.use('/api/print-jobs', createPrintJobsRouter({ store: printStore, sharedToken: 'dev-secret' }));
// client: configurePrintApi({ getToken: () => 'dev-secret' })
```

Endpoints: `POST /`, `GET /pending?station=android|laptop`, `GET /stations`, `POST /heartbeat`, `GET /:id`, `POST /:id/claim`, `POST /:id/complete`. Jobs 10 min me expire hote hain.

---

## 4) Laptop station (optional)

Agar bill kisi laptop se attached serial/USB thermal printer par nikalna ho:
```bash
set THERMAL_COM=COM7        # Windows: Device Manager me printer ka COM port
node scripts/thermal-print-bridge.mjs
```
Yeh `http://127.0.0.1:9100` par bridge chalata hai; POS page (desktop Chrome) khud detect karke usi par print bhej deta hai. BLE-only printers ke liye POS Web Bluetooth use hota hai. Details: `docs/thermal-printer-windows.md`.

---

## Kya customize karna hoga / What you must change

- **Shop header/QR** → `configureReceipt({...})` (default "MY SHOP").
- **API base + auth token** → `configurePrintApi({...})`.
- **Backend auth** → apna `requireAuth` do (staff/counter only).
- **Storage keys** generic hain (`pos_print_target_v1`, `asfix_pos_bt_printer_*`) — chahein to rename kar lo.
- **Plugin package name** `@asfixgear/asfix-thermal-print` rakh sakte ho ya rename — rename kiya to `registerPlugin('AsfixThermalPrint')` (nativePosPrint.js) aur Java `@CapacitorPlugin(name="AsfixThermalPrint")` dono match karein.

## Requirements

- Capacitor 6 (`@capacitor/core`, `@capacitor/android`, `@capacitor/preferences`)
- Android minSdk 22, compileSdk 34
- Backend: Node 18+ + Express 4
- React 18/19 (hook + chooser ke liye)

## Note

- **Bluetooth print sirf real Android device par test hota hai** (emulator/CI me printer nahi hota). Web/backend logic laptop/browser par test ho jata hai.
- Ye kit AsFix ke working code se nikala gaya hai; internal AsFix imports hata kar standalone bana diya gaya hai.
