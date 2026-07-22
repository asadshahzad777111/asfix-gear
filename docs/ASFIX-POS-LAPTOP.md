# AsFix POS Laptop (Print Station)

Laptop equivalent of the **AsFix POS** Android app for Direct Print / COM bridge — no Electron/Capacitor install required.

## Quick start (Windows)

1. Double-click:

   `C:\Users\asads\asfix-gear\scripts\asfix-pos-laptop.bat`

2. Chrome opens **https://asfixgear.com/pos**
3. If a single **COMx** port exists (or `THERMAL_COM` is set), the thermal bridge starts on `127.0.0.1:9100`
4. Staff login → Counter → **Print → Direct Print**

### Direct Print → POS-58

1. Destination: **POS-58** or **POS-58 usb**
2. Paper size: **shortest** (not 58×3276 mm)
3. Scale **100%**, Margins **None**

Full driver notes: [thermal-printer-windows.md](./thermal-printer-windows.md)

### Optional COM bridge

```powershell
cd C:\Users\asads\asfix-gear
$env:THERMAL_COM = "COM7"
.\scripts\asfix-pos-laptop.bat
```

Or: `npm run thermal:bridge` with `THERMAL_COM` set.

## Phone APK (separate)

Android debug APK is built from `mobile/asfix-pos` and copied to Downloads (never committed):

- Typical: `C:\Users\asads\Downloads\AsFix-POS.apk`
- Or: `mobile/asfix-pos/android/app/build/outputs/apk/debug/app-debug.apk`

Install on phone → open **AsFix POS** → Select printer → print. Website receipt tweaks apply after deploy (app loads asfixgear.com/pos).
