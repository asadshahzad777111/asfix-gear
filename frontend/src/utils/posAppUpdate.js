/**
 * AsFix POS native app update check.
 * Compares installed Capacitor app versionCode vs public/pos-app-version.json.
 * Old APKs without App.getInfo still get an update prompt (treated as outdated).
 */
import { Capacitor } from '@capacitor/core';
import { isNativePosApp } from './nativePosPrint.js';

export const POS_APP_VERSION_URL = '/pos-app-version.json';
export const POS_APK_DOWNLOAD_URL = 'https://asfixgear.com/downloads/AsFix-POS-1.1.1.apk';
export const POS_DOWNLOAD_PAGE_URL = 'https://asfixgear.com/pos';

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

/**
 * Local installed build. Old shells without @capacitor/app → versionCode 0
 * so any published remote versionCode >= 1 triggers the update UI.
 */
export async function getInstalledPosAppInfo() {
  if (!isNativePosApp()) return null;
  try {
    const mod = await import('@capacitor/app');
    const info = await mod.App.getInfo();
    const versionCode = toInt(info?.build, 0);
    return {
      versionName: String(info?.version || '') || 'old',
      versionCode,
      id: String(info?.id || ''),
      name: String(info?.name || ''),
      detection: versionCode > 0 ? 'native' : 'native_unknown',
    };
  } catch {
    // Very old WebView shell — still Capacitor, but no App plugin
    return {
      versionName: 'old',
      versionCode: 0,
      id: '',
      name: 'AsFix POS',
      detection: 'legacy_shell',
    };
  }
}

export function isUpdateAvailable(local, remote) {
  if (!remote) return false;
  const remoteCode = toInt(remote.versionCode, 0);
  if (remoteCode <= 0) return false;
  // Not in native app — no APK update UI
  if (!local) return false;
  const localCode = toInt(local.versionCode, 0);
  // Unknown/old shell (0) always offered an update when remote exists
  if (localCode <= 0) return true;
  return remoteCode > localCode;
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

/** Cache-bust so phones do not reuse an old AsFix-POS.apk from Downloads / CDN. */
export function resolvePosDownloadUrl(remote) {
  const base = String(remote?.downloadUrl || POS_APK_DOWNLOAD_URL).trim() || POS_APK_DOWNLOAD_URL;
  const code = toInt(remote?.versionCode, 0);
  const name = String(remote?.versionName || '').trim();
  const sep = base.includes('?') ? '&' : '?';
  const qs = [`v=${code || Date.now()}`];
  if (name) qs.push(`n=${encodeURIComponent(name)}`);
  return `${base}${sep}${qs.join('&')}`;
}

export function resolvePosApkFileName(remote) {
  const name = String(remote?.versionName || '').trim();
  if (name) return `AsFix-POS-${name}.apk`;
  return 'AsFix-POS.apk';
}

export function resolvePosDownloadPageUrl(remote) {
  const url = String(remote?.downloadPageUrl || POS_DOWNLOAD_PAGE_URL).trim();
  return url || POS_DOWNLOAD_PAGE_URL;
}

/** Open website download page (professional flow) — then APK. */
export async function openPosUpdateOnWebsite(remote) {
  const page = resolvePosDownloadPageUrl(remote);
  const apk = resolvePosDownloadUrl(remote);
  try {
    // Prefer in-app browser / system browser to the POS page
    window.open(page, '_blank', 'noopener,noreferrer');
  } catch {
    window.location.href = page;
  }
  // Also kick APK download so Install sheet appears on Android
  try {
    const a = document.createElement('a');
    a.href = apk;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('download', resolvePosApkFileName(remote));
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    /* page still open */
  }
  return { page, apk };
}

export async function openPosApkDownload(remote) {
  return openPosUpdateOnWebsite(remote);
}

export function shouldForceUpdate(remote) {
  return Boolean(remote?.forceUpdate);
}

export { isNativePosApp, Capacitor };
