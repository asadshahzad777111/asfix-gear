import ShopStatusControl from '../ShopStatusControl';
import AdminPayments from './AdminPayments';

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
