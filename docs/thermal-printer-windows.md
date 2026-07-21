# Thermal printer on Windows (BT800S / similar)



## Honest status (this PC scan)



On **DESKTOP-E8VMU4A**, with the printer powered and paired:



| Check | Result |

|--------|--------|

| Device Manager | **BlueTooth Printer** under Bluetooth — OK (no error icon) |

| Instance | `BTHLE\DEV_…` → **Bluetooth Low Energy**, not classic SPP |

| **Standard Serial over Bluetooth link (COMx)** | **Not present** |

| Ports (COM & LPT) | Only Intel **USB Serial COM5 / COM6** (not the printer) |

| Windows printers | No thermal printer queue |



**Conclusion:** Powering the printer did **not** create a Bluetooth COM port. Laptop cannot use `send-thermal-com.mjs` against this device until SPP/USB serial appears. Phone **Thermer** still works (Android SPP/BLE stack).



**Thermer APK** does **not** install a Windows kernel print driver.



---



## One-click from website (laptop) — what works



POS **Print** tries, in order:



1. **Local COM bridge** — if you run the bridge with `THERMAL_COM=COMx` (only when Device Manager shows a real serial port for the printer).

2. **Web Bluetooth** (Chrome) — BLE GATT write of ESC/POS text. First click shows a device picker; choose **BlueTooth Printer**.

3. **iframe / system print** — only useful if a Windows printer driver exists.

4. **Phone Thermer** — still the most reliable path for PNG receipts.



### A) Web Bluetooth (this machine — preferred laptop path)



1. Use **Chrome** on `https://…` or `http://localhost:…` (secure context).

2. Printer on + paired in Windows Bluetooth settings.

3. POS → **Print**.

4. In the Chrome picker, select **BlueTooth Printer** (allow).



If the picker lists the device but nothing prints, the GATT write characteristic may differ — keep using phone Thermer, or try a USB cable / printer mode that enables **SPP**.



### B) Localhost bridge (when a COM port exists)



```powershell

cd C:\Users\asads\asfix-gear

# Only if Device Manager shows e.g. "Standard Serial over Bluetooth link (COM7)"

$env:THERMAL_COM = "COM7"

node scripts/thermal-print-bridge.mjs

```



- Listens on **127.0.0.1:9100** only (not LAN).

- `GET /health` — status  

- `POST /print` — `{ "text": "…" }` → ESC/POS to that COM  

- CORS: localhost origins only; no secrets.



Without `THERMAL_COM`, the bridge stays up but `/print` returns **503** (honest: no serial path). POS then uses Web Bluetooth / iframe.



One-shot COM test (same requirement):



```powershell

node scripts/send-thermal-com.mjs COM7 --demo

```



### C) Phone Thermer (works today)



1. Install [Thermer / Bluetooth Print](https://play.google.com/store/apps/details?id=mate.bluetoothprint).

2. Pair the thermal printer on Android; open Thermer and select it.

3. Phone Chrome → POS **Print** / **Share → Thermer** (PNG or Mate markup).

4. Prefer **58mm** paper width for BT800S-class devices.



---



## If laptop print is still blocked



**Why:** Windows paired the device as **BLE only**. No **SPP / RFCOMM COM** → no raw serial from Node, no Generic/Text printer port, no Web Serial COM.



**Next hardware steps (pick one):**



1. Printer manual / seller: enable **SPP / Classic Bluetooth** or “Android/PC mode” (not BLE-only).

2. Use a **USB cable** if the printer has USB — Windows should add a real COM or USB printer.

3. Keep printing from **phone + Thermer**.



Do **not** expect a fake kernel driver from Thermer.apk or from this repo.



---



## What the website does



| Device | Print |

|--------|--------|

| **AsFix POS Android app** | Native Bluetooth SPP ESC/POS (no Thermer) — see [`mobile/asfix-pos/README.md`](../mobile/asfix-pos/README.md) |

| Android browser | PNG Web Share → Thermer; else Mate Intent |

| Laptop Chrome | Bridge (COM) → Web Bluetooth (BLE) → iframe HTML print |

| Any | Share / Download PDF or PNG |



Related scripts: `scripts/thermal-print-bridge.mjs`, `scripts/send-thermal-com.mjs`, `frontend/src/utils/thermalLaptopPrint.js`, `frontend/src/utils/nativePosPrint.js`.


