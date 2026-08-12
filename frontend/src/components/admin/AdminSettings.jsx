import { useEffect, useState } from 'react';
import ShopStatusControl from '../ShopStatusControl';
import AdminPayments from './AdminPayments';
import AdminStorefrontImages from './AdminStorefrontImages';
import NotificationSettingsPanel from '../NotificationSettingsPanel';
import { api } from '../../api/client';

function EmailTestPanel() {
  const [status, setStatus] = useState(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = async () => {
    const s = await api.getEmailStatus();
    setStatus(s);
    setNotifyEmail(s.notify_email || s.notify_email_resolved || '');
    return s;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await refresh();
        if (cancelled) return;
        setStatus(s);
      } catch (err) {
        if (!cancelled) setStatus({ configured: false, error: err.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveNotify = async () => {
    setSaving(true);
    setMsg('');
    try {
      const saved = await api.setEmailSettings({ notify_email: notifyEmail.trim() });
      setNotifyEmail(saved.notify_email || saved.notify_email_resolved || '');
      setStatus((prev) => ({
        ...(prev || {}),
        notify_email: saved.notify_email || '',
        notify_email_resolved: saved.notify_email_resolved,
        notify_source: saved.notify_email ? 'admin' : prev?.notify_source,
      }));
      setMsg(`Saved — alerts go to ${saved.notify_email_resolved || saved.notify_email}`);
    } catch (err) {
      setMsg(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await api.sendTestEmail(notifyEmail.trim() || undefined);
      setMsg(r.sent ? `Test email sent to ${r.to}` : 'Send failed');
    } catch (err) {
      setMsg(err.message || 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head">Gmail / order alert inbox</div>
      <div className="wp-postbox-body">
        <p style={{ fontSize: '0.84rem', color: '#50575e', marginTop: 0 }}>
          Customer jab order book kare — yeh Gmail pe alert aayega. Yeh setting <strong>server pe
          save</strong> hoti hai (Admin Settings), APK install/update se <strong>reset nahi</strong>{' '}
          hoti. SMTP password Render pe rehta hai (security).
        </p>

        <label className="wp-payments-field" style={{ display: 'block', marginBottom: '0.75rem' }}>
          <span>Alert Gmail (inbox)</span>
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            placeholder="asadshahzad777111@gmail.com"
            autoComplete="email"
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <div className="wp-payments-actions" style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="wp-button" onClick={saveNotify} disabled={saving}>
            {saving ? 'Saving…' : 'Save Gmail'}
          </button>
          <button
            type="button"
            className="wp-button wp-button--secondary"
            onClick={sendTest}
            disabled={busy || status?.configured === false}
          >
            {busy ? 'Sending…' : 'Send test email'}
          </button>
        </div>

        {status ? (
          <p style={{ fontSize: '0.84rem', marginTop: 0 }}>
            Delivery:{' '}
            <strong>
              {status.configured
                ? `${status.provider || 'email'} · verify ${status.verify_ok ? 'OK' : 'fail'}`
                : 'not configured on Render'}
            </strong>
            <br />
            Alerts to: <strong>{status.notify_email_resolved || notifyEmail || '—'}</strong>
            {status.notify_source ? ` (${status.notify_source})` : ''}
            <br />
            <span style={{ color: '#646970' }}>
              {status.smtp_password_on_server
                ? 'Server mail key OK (Render env).'
                : 'Render pe RESEND_API_KEY ya GMAIL_USER + GMAIL_APP_PASSWORD set karein — warna email nahi jayegi.'}
            </span>
          </p>
        ) : (
          <p style={{ fontSize: '0.84rem' }}>Checking…</p>
        )}
        {msg ? (
          <p
            style={{
              fontSize: '0.84rem',
              marginBottom: 0,
              color: /fail|error|Could/i.test(msg) ? '#b32d2e' : '#057a55',
            }}
          >
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminSettings({ onDownloadBackup, backupLoading, showBackup, section = 'general' }) {
  if (section === 'payments') {
    return <AdminPayments />;
  }

  return (
    <div className="wp-settings">
      <div className="wp-postbox">
        <div className="wp-postbox-head">Notifications</div>
        <div className="wp-postbox-body">
          <NotificationSettingsPanel mode="staff" />
        </div>
      </div>
      <div className="wp-postbox">
        <div className="wp-postbox-head">Shop status</div>
        <div className="wp-postbox-body">
          <ShopStatusControl />
        </div>
      </div>
      <AdminStorefrontImages />
      <EmailTestPanel />
      {showBackup && (
        <div className="wp-postbox">
          <div className="wp-postbox-head">Backup</div>
          <div className="wp-postbox-body">
            <p style={{ fontSize: '0.84rem', color: '#50575e', marginTop: 0 }}>
              Full store JSON backup — products, orders, bookings, messages.
            </p>
            <button
              type="button"
              className="wp-button wp-button--secondary"
              onClick={onDownloadBackup}
              disabled={backupLoading}
            >
              {backupLoading ? 'Downloading…' : 'Download backup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
