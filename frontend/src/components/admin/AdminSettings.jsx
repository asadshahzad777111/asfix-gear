import { useEffect, useState } from 'react';
import ShopStatusControl from '../ShopStatusControl';
import AdminPayments from './AdminPayments';
import AdminStorefrontImages from './AdminStorefrontImages';
import { api } from '../../api/client';

function EmailTestPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.getEmailStatus();
        if (!cancelled) setStatus(s);
      } catch (err) {
        if (!cancelled) setStatus({ configured: false, error: err.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sendTest = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await api.sendTestEmail();
      setMsg(r.sent ? `Test email sent to ${r.to}` : 'Send failed');
    } catch (err) {
      setMsg(err.message || 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head">Email (SMTP / Resend)</div>
      <div className="wp-postbox-body">
        <p style={{ fontSize: '0.84rem', color: '#50575e', marginTop: 0 }}>
          Order + OTP emails. Render free tier: use <code>RESEND_API_KEY</code>. Paid/local: Gmail SMTP.
        </p>
        {status ? (
          <p style={{ fontSize: '0.84rem', marginTop: 0 }}>
            Status:{' '}
            <strong>
              {status.configured
                ? `${status.provider || 'email'} · verify ${status.verify_ok ? 'OK' : 'fail'}`
                : 'not configured'}
            </strong>
          </p>
        ) : (
          <p style={{ fontSize: '0.84rem' }}>Checking…</p>
        )}
        <button
          type="button"
          className="wp-button wp-button--secondary"
          onClick={sendTest}
          disabled={busy || status?.configured === false}
        >
          {busy ? 'Sending…' : 'Send test email'}
        </button>
        {msg ? (
          <p style={{ fontSize: '0.84rem', marginBottom: 0, color: msg.includes('sent') ? '#057a55' : '#b32d2e' }}>
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
