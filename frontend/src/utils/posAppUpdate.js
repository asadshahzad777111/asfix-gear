/**
 * AsFix POS native app update check.
 * Compares installed Capacitor app versionCode vs public/pos-app-version.json.
 */
import { Capacitor } from '@capacitor/core';
import { isNativePosApp } from './nativePosPrint.js';

export const POS_APP_VERSION_URL = '/pos-app-version.json';
export const POS_APK_DOWNLOAD_URL = 'https://asfixgear.com/downloads/AsFix-POS.apk';

const DISMISS_KEY = 'asfix_pos_update_dismissed_vcode';

function toInt(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function fetchPosAppVersionManifest(signal) {
  const res = await fetch(`${POS_APP_VERSION_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`version manifest ${res.status}`);
  return res.json();
}

/** Local installed build (versionCode) + versionName from Capacitor App plugin. */
export async function getInstalledPosAppInfo() {
  if (!isNativePosApp()) return null;
  try {
    const mod = await import('@capacitor/app');
    const info = await mod.App.getInfo();
    return {
      versionName: String(info?.version || ''),
      versionCode: toInt(info?.build, 0),
      id: String(info?.id || ''),
      name: String(info?.name || ''),
    };
  } catch {
    return null;
  }
}

export function isUpdateAvailable(local, remote) {
  if (!local || !remote) return false;
  const localCode = toInt(local.versionCode, 0);
  const remoteCode = toInt(remote.versionCode, 0);
  return remoteCode > 0 && localCode > 0 && remoteCode > localCode;
}

export function getDismissedUpdateCode() {
  try {
    return toInt(localStorage.getItem(DISMISS_KEY), 0);
  } catch {
    return 0;
  }
}

export function dismissUpdateForCode(versionCode) {
  try {
    localStorage.setItem(DISMISS_KEY, String(toInt(versionCode, 0)));
  } catch {
    /* ignore */
  }
}

export function resolvePosDownloadUrl(remote) {
  const url = String(remote?.downloadUrl || POS_APK_DOWNLOAD_URL).trim();
  return url || POS_APK_DOWNLOAD_URL;
}

export async function openPosApkDownload(remote) {
  const url = resolvePosDownloadUrl(remote);
  // Capacitor WebView: navigating to the APK URL triggers Android's download/installer flow.
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('download', 'AsFix-POS.apk');
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true, url };
  } catch {
    if (Capacitor.isNativePlatform?.()) {
      window.location.href = url;
      return { ok: true, url };
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return { ok: true, url };
  }
}
