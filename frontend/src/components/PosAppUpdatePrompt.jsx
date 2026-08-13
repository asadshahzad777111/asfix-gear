import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isNativePosApp } from '../utils/nativePosPrint';
import {
  dismissUpdateForCode,
  fetchPosAppVersionManifest,
  getDismissedUpdateCode,
  getInstalledPosAppInfo,
  isUpdateAvailable,
  openPosUpdateOnWebsite,
  resolvePosDownloadPageUrl,
  resolvePosDownloadUrl,
  shouldForceUpdate,
} from '../utils/posAppUpdate';
import './pos-app-update.css';

/**
 * Professional update modal for AsFix POS APK (including old shells).
 * Update → opens website POS page + starts APK download.
 */
export default function PosAppUpdatePrompt() {
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async (signal) => {
    if (!isNativePosApp()) return;
    try {
      const [local, remote] = await Promise.all([
        getInstalledPosAppInfo(),
        fetchPosAppVersionManifest(signal),
      ]);
      if (!isUpdateAvailable(local, remote)) {
        setUpdate(null);
        return;
      }
      const remoteCode = Number(remote.versionCode) || 0;
      const forced = shouldForceUpdate(remote);
      if (!forced && getDismissedUpdateCode() === remoteCode) return;
      setUpdate({ local, remote, forced });
    } catch {
      /* offline / missing manifest — ignore */
    }
  }, []);

  useEffect(() => {
    if (!isNativePosApp()) return undefined;
    const ac = new AbortController();
    void check(ac.signal);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    // Re-check every 6h while POS stays open
    const interval = window.setInterval(() => void check(), 6 * 60 * 60 * 1000);
    return () => {
      ac.abort();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(interval);
    };
  }, [check]);

  if (!update) return null;

  const { local, remote, forced } = update;
  const downloadUrl = resolvePosDownloadUrl(remote);
  const pageUrl = resolvePosDownloadPageUrl(remote);

  const onUpdate = async () => {
    setBusy(true);
    try {
      await openPosUpdateOnWebsite(remote);
    } finally {
      setBusy(false);
    }
  };

  const onLater = () => {
    if (forced) return;
    dismissUpdateForCode(remote.versionCode);
    setUpdate(null);
  };

  const modal = (
    <div className="pos-upd" role="dialog" aria-modal="true" aria-labelledby="pos-upd-title">
      <div className="pos-upd__card">
        <div className="pos-upd__badge" aria-hidden>
          ↑
        </div>
        <p className="pos-upd__kicker">AsFix POS</p>
        <h2 id="pos-upd-title">Update available</h2>
        <p className="pos-upd__body">
          Nayi APK <strong>{remote.versionName || 'latest'}</strong> ready hai. Purani Downloads
          wali <strong>1.0</strong> file mat kholo — naya file{' '}
          <strong>AsFix-POS-{remote.versionName || 'latest'}.apk</strong> download hoga.
        </p>
        <dl className="pos-upd__meta">
          <div>
            <dt>Installed (purani)</dt>
            <dd>
              {local.versionName || 'old'}
              {local.versionCode > 0 ? ` (${local.versionCode})` : ' (legacy)'}
            </dd>
          </div>
          <div>
            <dt>Download / install this</dt>
            <dd>
              {remote.versionName || '—'} ({remote.versionCode || '?'})
            </dd>
          </div>
        </dl>
        {remote.notes ? <p className="pos-upd__notes">{String(remote.notes)}</p> : null}
        <div className="pos-upd__actions">
          <button type="button" className="pos-upd__primary" onClick={onUpdate} disabled={busy}>
            {busy ? 'Opening…' : `Download ${remote.versionName || 'update'}`}
          </button>
          {!forced ? (
            <button type="button" className="pos-upd__secondary" onClick={onLater} disabled={busy}>
              Later
            </button>
          ) : null}
        </div>
        <p className="pos-upd__hint">
          Update → {pageUrl.replace(/^https?:\/\//, '')} pe jaake download. Gmail / login settings
          website pe rehte hain — APK change se reset nahi hote.
        </p>
        <a className="pos-upd__link" href={downloadUrl} target="_blank" rel="noopener noreferrer">
          Direct APK download
        </a>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
