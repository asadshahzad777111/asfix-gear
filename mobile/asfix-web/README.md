# AsFix & Gear (public Android app)

Light **Capacitor 6** shell that opens the live storefront (`https://asfixgear.com`) — shopping, repairs, order tracking.

App id: `com.asfixgear.app` · Name: **AsFix & Gear**

This is **not** the cashier POS app. Staff Bluetooth billing lives in [`mobile/asfix-pos/`](../asfix-pos/) and is offered only on `/pos` (`/downloads/AsFix-POS.apk`).

| App | Path | Loads | Public download |
|-----|------|-------|-----------------|
| **AsFix & Gear** (this folder) | `mobile/asfix-web/` | `https://asfixgear.com` | `/downloads/asfix-gear.apk` on `/download` |
| **AsFix POS** | `mobile/asfix-pos/` | `https://asfixgear.com/pos` | Staff only on Counter / POS |

## Prerequisites

1. Node 20+
2. [Android Studio](https://developer.android.com/studio) with SDK 34 + JDK
3. Optional: `ANDROID_HOME` / `ANDROID_SDK_ROOT` set

## One-time setup

```bash
cd mobile/asfix-web
npm install
npx cap add android
npx cap sync android
```

### Icons (website logo)

Copy the storefront logo into Android mipmaps (or use Android Studio Image Asset Studio):

- Source: `frontend/public/logo-512.png` or `design-assets/asfix-gear/asfix-logo-square.png`
- Target: `android/app/src/main/res/mipmap-*/ic_launcher*.png`

After changing icons: `npx cap sync android`.

## Build debug APK

```bash
cd mobile/asfix-web
npm install
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

APK output:

`android/app/build/outputs/apk/debug/app-debug.apk`

Copy to the public site (do **not** overwrite the POS APK):

```bash
copy android\app\build\outputs\apk\debug\app-debug.apk ..\..\frontend\public\downloads\asfix-gear.apk
```

Live URL after deploy: https://asfixgear.com/downloads/asfix-gear.apk

## Local WebView against Vite (optional)

```bash
# LAN IP of your PC; Vite must listen on 0.0.0.0
# Edit capacitor.config.json server.url temporarily, then:
npx cap sync android
```

Default `server.url` is production: `https://asfixgear.com` (home / storefront — **not** `/pos`).

## Related

- Public download page: `frontend/src/pages/DownloadApp.jsx`
- POS cashier app: [`mobile/asfix-pos/README.md`](../asfix-pos/README.md)
