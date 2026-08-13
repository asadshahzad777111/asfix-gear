import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isNativePosApp } from '../utils/nativePosPrint';
import {
  dismissUpdateForCode,
  fetchPosAppVersionManifest,
  getDismissedUpdateCode,
  getInstalledPosAppInfo,
  isUpdateAvailable,
  openPosApkDownload,
  resolvePosDownloadUrl,
} from '../utils/posAppUpdate';
import './pos-app-update.css';

/**
 * Shows a blocking-ish update modal when AsFix POS APK is older than
 * frontend/public/pos-app-version.json (versionCode).
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
      if (getDismissedUpdateCode() === remoteCode) return;
      setUpdate({ local, remote });
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
    return () => {
      ac.abort();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [check]);

  if (!update) return null;

  const { local, remote } = update;
  const downloadUrl = resolvePosDownloadUrl(remote);

  const onUpdate = async () => {
    setBusy(true);
    try {
      await openPosApkDownload(remote);
    } finally {
      setBusy(false);
    }
  };

  const onLater = () => {
    dismissUpdateForCode(remote.versionCode);
    setUpdate(null);
  };

  const modal = (
    <div className="pos-upd" role="dialog" aria-modal="true" aria-labelledby="pos-upd-title">
      <div className="pos-upd__card">
        <p className="pos-upd__kicker">AsFix POS</p>
        <h2 id="pos-upd-title">New update available</h2>
        <p className="pos-upd__body">
          Nayi APK ready hai. Update tap karein → download → Install.
        </p>
        <dl className="pos-upd__meta">
          <div>
            <dt>Installed</dt>
            <dd>
              {local.versionName || '—'} ({local.versionCode || '?'})
            </dd>
          </div>
          <div>
            <dt>Latest</dt>
            <dd>
              {remote.versionName || '—'} ({remote.versionCode || '?'})
            </dd>
          </div>
        </dl>
        {remote.notes ? <p className="pos-upd__notes">{String(remote.notes)}</p> : null}
        <div className="pos-upd__actions">
          <button type="button" className="pos-upd__primary" onClick={onUpdate} disabled={busy}>
            {busy ? 'Opening…' : 'Update'}
          </button>
          <button type="button" className="pos-upd__secondary" onClick={onLater} disabled={busy}>
            Later
          </button>
        </div>
        <a className="pos-upd__link" href={downloadUrl} target="_blank" rel="noopener noreferrer">
          Direct APK link
        </a>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
