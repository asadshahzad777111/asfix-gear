import { useCallback, useEffect, useState } from 'react';
import {
  checkStaffNotifyPermissions,
  ensureStaffNotifyPermissions,
  isCapacitorNative,
} from '../utils/staffOrderNotify';
import { setStaffNotifPrefs } from '../utils/notificationPrefs';
import './pos-notify-permission.css';

const DISMISS_KEY = 'asfix_pos_notif_banner_dismissed';

/**
 * Android 13+ only shows the system notification dialog after a user tap.
 * Silent mount requests often do nothing — this banner is the real gate.
 */
export default function PosNotifyPermissionBanner() {
  const [status, setStatus] = useState(null); // null | { native, browser, display }
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const refresh = useCallback(async () => {
    if (!isCapacitorNative()) {
      setStatus({ native: false, browser: false, display: 'web' });
      return;
    }
    const next = await checkStaffNotifyPermissions();
    setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  if (!isCapacitorNative()) return null;
  if (!status || status.native) return null;
  if (dismissed && status.display === 'denied') {
    /* still show a compact strip when permanently denied */
  } else if (dismissed) {
    return null;
  }

  const denied = status.display === 'denied';

  const onAllow = async () => {
    setBusy(true);
    setHint('');
    try {
      const result = await ensureStaffNotifyPermissions({ forceAsk: true });
      setStatus(result);
      if (result.native) {
        setStaffNotifPrefs({ orderShow: true, orderPhone: true, orderSound: true, orderToast: true });
        setHint('Notifications allowed — naye online orders pe alert aayega.');
        try {
          localStorage.removeItem(DISMISS_KEY);
        } catch {
          /* ignore */
        }
      } else if (result.display === 'denied') {
        setHint(
          'Permission block ho gayi. Phone Settings → Apps → AsFix POS → Notifications → Allow.',
        );
      } else {
        setHint('Permission dialog band ho gaya — dubara Allow dabao, ya phone Settings se on karo.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onLater = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      className={`pos-notify-perm${denied ? ' pos-notify-perm--denied' : ''}`}
      role="region"
      aria-label="Notification permission"
    >
      <div className="pos-notify-perm__copy">
        <strong>{denied ? 'Notifications blocked' : 'Allow order notifications'}</strong>
        <small>
          {denied
            ? 'Android ne notification band ki hui hai. Settings se Allow karo, warna phone pe order alert nahi aayega.'
            : 'Android 13+ pe notification ke liye Allow tap zaroori hai — bina iske lock-screen / status-bar alert nahi aate. In-app toast phir bhi chal sakta hai.'}
        </small>
        {hint ? <small className="pos-notify-perm__hint">{hint}</small> : null}
      </div>
      <div className="pos-notify-perm__actions">
        <button type="button" className="pos-notify-perm__primary" onClick={() => void onAllow()} disabled={busy}>
          {busy ? 'Asking…' : denied ? 'Try again / check Settings' : 'Allow notifications'}
        </button>
        {!denied ? (
          <button type="button" className="pos-notify-perm__ghost" onClick={onLater} disabled={busy}>
            Later
          </button>
        ) : null}
      </div>
    </div>
  );
}
