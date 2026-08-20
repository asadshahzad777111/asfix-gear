# Thermal printer (58mm) — Windows + Android + iPhone

Honest guide for AsFix & Gear POS. **Do not commit** vendor ZIPs, APKs, or driver EXEs into git — keep them in Downloads or `_ci_local/` (gitignored).

## What the vendor ZIP contains

Typical pack: `58MM Thermal Printer Driver & Tools -50.zip` (Zijiang / BT-POS class):

| Path | What it is | Use for AsFix? |
|------|------------|----------------|
| `Android APP/BT-POSPrinter.apk` | Vendor Bluetooth test/print app | Optional hardware check only — **not** our POS |
| `Printer Driver/Windows Driver/PrinterDriver.exe` | Windows USB/COM printer installer | Laptop **system Print** / COM when USB or SPP exists |
| `Printer Driver/OPOS Driver/…` | OPOS (legacy POS) | No — we do not use OPOS |
| `Printer Driver/Mac Driver/macOSDriver.dmg` | macOS | **Skip** (not in scope) |
| `Printer Driver/Linux Driver/…` | CUPS helpers | Skip unless you run Linux |
| `Printer Manual/*.pdf` | User + programmer manuals | Reference |
| `Printer SDK/Android SDK/…` | Java demos (`ESC Z` QR, 384-dot 58mm) | We mirrored QR/width in website ESC/POS |

Vendor Android SDK facts we coded against:

- **58mm printable width** = **384 dots**; Font A ≈ **32 characters**
- **QR** = proprietary **`ESC Z`** (`0x1B 0x5A …`), mag **7** on 58mm / **9** on 80mm (phone-tuned) — not Epson `GS (k`
- Cut = `GS V B` + feed (`ESC J`)

## Three Android apps (do not confuse)

| App | Role |
|-----|------|
| **AsFix POS** (`com.asfixgear.pos`) | Our Capacitor app → live `/pos` → native Bluetooth **SPP ESC/POS** (preferred shop phone) |
| **Thermer** (`mate.bluetoothprint`) | Play Store fallback when printing from **Chrome** (PNG share / Mate markup Intent) |
| **BT-POSPrinter.apk** (vendor) | Seller demo only — pair/print test; **not** integrated into asfixgear.com |

Website JS cannot install Windows drivers or sideload APKs. Those are **local installs**.

## Print paths (what the live site does)

| Device | Path |
|--------|------|
| **AsFix POS Android** | Native SPP + full ESC/POS (32-col + `ESC Z` QR at bottom) |
| **Android Chrome** | Share PNG → Thermer, else Mate Intent markup + QR |
| **Laptop Chrome** | **Direct Print** = iframe HTML `@page { size: 58mm auto }` (preferred with Windows driver) → else COM bridge → Web Bluetooth BLE |
| **iPhone** | No Bluetooth SPP to thermal — use **Print chooser → Android / Laptop** remote queue |

Remote print: iPhone enqueues a job; Android POS or laptop agent (with printer selected / bridge running) polls and prints.

---

## Windows: install vendor driver (optional)

Only needed if you want a **Windows printer queue** or a real **COMx** serial path.

1. Unzip the vendor pack locally (e.g. Downloads or `_ci_local/thermal-58mm-tools/` — never commit).
2. Run `Printer Driver\Windows Driver\PrinterDriver.exe` **as Administrator**.
3. Prefer **USB cable** if the printer has USB — Windows usually adds COM or a USB printer.
4. For Bluetooth: pair the printer, then check Device Manager for **Standard Serial over Bluetooth link (COMx)**.  
   If you only see **BlueTooth Printer (BLE / BTHLE)** and **no COMx**, Node/COM bridge cannot talk to it — use **Chrome Web Bluetooth** or phone apps instead.
5. Paper size: choose **58mm** in the driver / test page if asked — **never leave the default `58 × 3276 mm`** (that feeds ~3 meters of blank paper).

### Critical: POS-58 / POS-58 usb paper size (58 × 3276 mm)

Vendor drivers often ship with a continuous “Printer Paper” of **58 × 3276 mm**. Chrome’s print dialog then shows that size and the printer feeds a huge blank roll even when the receipt content is short.

**Fix the Windows defaults (do this once for USB and once for Bluetooth if both exist):**

1. **Settings → Bluetooth & devices → Printers & scanners** (or Control Panel → Devices and Printers).
2. Open **POS-58** (and **POS-58 usb** if listed).
3. **Printing preferences** / **Printer properties → Preferences**.
4. **Advanced** / **Paper / Quality** → **Paper size**.
5. Change from **Printer Paper (58 × 3276 mm)** to the **shortest** option available:
   - Prefer **58 × 210 mm**, **58 × 297 mm**, or a **Custom** height near receipt length (~80–150 mm).
6. Set as default → **Apply → OK**.
7. Repeat for the other queue (USB vs Bluetooth).

**Chrome Direct Print checklist (after AsFix deploy):**

1. Hard-refresh POS → **Print → Direct Print** (opens short HTML receipt — **not** a PDF).
2. Destination: **POS-58** or **POS-58 usb**.
3. More settings → **Paper size**: shortest (not 3276) → **Scale 100%** → **Margins None**.
4. Do **not** download `*-invoice.pdf` and print that to thermal — PDF + 3276 paper = meters of blank. Use Direct Print or AsFix POS ESC/POS instead.

**Thermer.apk / BT-POSPrinter.apk do not install a Windows kernel driver.**

### Laptop Print Station (AsFix POS Laptop)

Double-click `scripts/asfix-pos-laptop.bat` (or `npm run pos:laptop`) — opens POS in the browser and starts the COM bridge when a port is available. See [`ASFIX-POS-LAPTOP.md`](./ASFIX-POS-LAPTOP.md).

1. **Local COM bridge** (when COMx exists):

```powershell
cd C:\Users\asads\asfix-gear
$env:THERMAL_COM = "COM7"   # your port
npm run thermal:bridge
```

- Listens on **127.0.0.1:9100** only  
- `POST /print` accepts `{ "data_base64": "…" }` (preferred, includes QR) or `{ "text": "…" }`

2. **Web Bluetooth** (Chrome, secure context): POS → Print → pick **BlueTooth Printer**.

3. Fallback: browser iframe print (needs a Windows queue from `PrinterDriver.exe` to be useful on paper).

Help text: `npm run thermal:help`

One-shot COM smoke (includes sample `ESC Z` QR when using `--demo`):

```powershell
node scripts/send-thermal-com.mjs COM7 --demo
```

---

## Android: which APK to install

### A) Shop counter — AsFix POS (recommended)

Build/install our Capacitor app — see [`mobile/asfix-pos/README.md`](../mobile/asfix-pos/README.md).

1. Pair the thermal printer in **Android Settings → Bluetooth**.
2. Open **AsFix POS** → login → Counter → **Select printer**.
3. Sale auto-prints once; **Print** reprints full 58mm + Scan QR at bottom.

After a website deploy, hard-refresh / reopen the app (it loads `https://asfixgear.com/pos`).

### B) Browser fallback — Thermer

1. Install [Thermer / Bluetooth Print](https://play.google.com/store/apps/details?id=mate.bluetoothprint).
2. Pair printer; open Thermer and select it.
3. Phone Chrome → POS **Print** → share image to Thermer (or Mate Intent).

### C) Vendor `BT-POSPrinter.apk` (optional test)

Sideload from the ZIP’s `Android APP\` folder. Use only to confirm the printer prints Chinese/English demo tickets. **Do not** expect AsFix receipts from this APK.

---

## iPhone → remote print

1. On Android POS (or laptop with bridge): keep AsFix POS / Chrome POS open so the print agent polls.
2. On iPhone: POS → Print → choose **Android** or **Laptop** station.
3. Receipt prints on that station with the same ESC/POS + QR.

---

## Reprint checklist (expect QR)

1. Confirm paper width **58mm** in Counter (thermal width toggle).
2. Print again (or complete a new sale on AsFix POS).
3. Bottom of ticket should show **Scan** + scannable **asfixgear.com** QR, sized like body text (not a full-bleed square).
4. If QR is missing on raw ESC/POS: you are likely on an Epson-only path; this kit needs **`ESC Z`** (already in live builders after deploy).
5. If laptop COM fails: check COMx vs BLE-only (table above).

---

## Related code

- `frontend/src/components/admin/AdminCounterBill.jsx` — receipt lines, ESC/POS, PNG, Thermer markup  
- `frontend/src/utils/thermalLaptopPrint.js` — bridge + Web Bluetooth  
- `frontend/src/utils/nativePosPrint.js` — Capacitor SPP  
- `frontend/src/hooks/useSmartThermalPrint.jsx` — local vs remote chooser  
- `scripts/thermal-print-bridge.mjs`, `scripts/send-thermal-com.mjs`, `scripts/thermal-print-help.mjs`
