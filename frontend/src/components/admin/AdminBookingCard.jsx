import AdminBookingPhotos from './AdminBookingPhotos';
import { RepairChatButton } from '../RepairChatPanel';

export default function AdminBookingCard({
  booking,
  chatUnread = 0,
  onOpenChat,
  onStatusChange,
  costValue,
  onCostChange,
  onSaveCost,
  costSaving = false,
  noteValue = '',
  onNoteChange,
  onSaveNote,
  noteSaving = false,
  onUpdated,
  t,
  className = '',
}) {
  const b = booking;
  if (!b) return null;

  return (
    <article className={`admin-booking-card glass-card ${className}`.trim()}>
      <div className="admin-booking-head">
        <div>
          <h3>{b.customer_name}</h3>
          <p className="admin-booking-meta">
            {b.phone}
            {b.alternative_contact ? ` · Alt: ${b.alternative_contact}` : ''}
            {b.booking_ref ? (
              <>
                <br />
                <span className="admin-booking-ref">{b.booking_ref}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="admin-booking-head-actions">
          <RepairChatButton
            booking={b}
            unread={chatUnread}
            onClick={onOpenChat}
          />
          <select
            className="status-select"
            value={b.status}
            onChange={(e) => onStatusChange(b.id, e.target.value)}
            aria-label={`Status for ${b.customer_name}`}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="admin-booking-grid">
        <div>
          <span className="admin-booking-label">Device</span>
          <p>{b.device_brand} {b.device_model}</p>
        </div>
        <div>
          <span className="admin-booking-label">Estimated Time</span>
          <p>{b.estimated_repair_time || b.service_name || '—'}</p>
        </div>
        <div>
          <span className="admin-booking-label">Estimated Cost (PKR)</span>
          <div className="admin-booking-cost-row">
            <input
              type="number"
              min="0"
              step="1"
              className="admin-booking-cost-input"
              placeholder="—"
              value={costValue ?? (b.estimated_cost ?? '')}
              onChange={(e) => onCostChange(b.id, e.target.value)}
              aria-label={`Estimated cost for ${b.customer_name}`}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={costSaving}
              onClick={() => onSaveCost(b.id)}
            >
              {costSaving ? '…' : 'Save'}
            </button>
          </div>
        </div>
        <div className="admin-booking-span-2">
          <span className="admin-booking-label">Issues</span>
          <p>{b.issue || '—'}</p>
          {b.issue_other ? <p className="admin-booking-sub">Other: {b.issue_other}</p> : null}
          {b.screen_quality ? <p className="admin-booking-sub">Screen: {b.screen_quality}</p> : null}
          {b.dead_mobile_acknowledged ? (
            <p className="admin-booking-sub">Dead mobile policy: ✓ Accepted (no warranty)</p>
          ) : null}
        </div>
        <div>
          <span className="admin-booking-label">Submitted</span>
          <p>{b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</p>
        </div>
        <div>
          <span className="admin-booking-label">Terms</span>
          <p>{b.terms_accepted ? '✓ Confirmed' : '—'}</p>
        </div>
        <div className="admin-booking-span-2">
          <span className="admin-booking-label">Customer note sent</span>
          <p className="admin-booking-sub">{t('admin.standardCustomerNote')}</p>
        </div>
        {(b.staff_notes || []).length > 0 && (
          <div className="admin-booking-span-2 admin-booking-notes">
            <span className="admin-booking-label">{t('admin.staffNotes')}</span>
            <ul className="admin-booking-notes-list">
              {(b.staff_notes || []).map((n) => (
                <li key={n.id || n.at}>
                  <small>
                    {n.at ? new Date(n.at).toLocaleString() : ''}
                    {n.by_name ? ` · ${n.by_name}` : ''}
                  </small>
                  <p>{n.text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="admin-booking-span-2 admin-booking-note-form">
          <AdminBookingPhotos booking={b} onUpdated={onUpdated} />
        </div>
        <div className="admin-booking-span-2 admin-booking-note-form">
          <label className="admin-booking-label" htmlFor={`booking-note-${b.id}`}>
            {t('admin.staffNotes')}
          </label>
          <textarea
            id={`booking-note-${b.id}`}
            className="admin-booking-note-input"
            rows={3}
            value={noteValue}
            onChange={(e) => onNoteChange(b.id, e.target.value)}
            placeholder={t('admin.bookingNotePlaceholder')}
            maxLength={2000}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={noteSaving || !noteValue.trim()}
            onClick={() => onSaveNote(b.id)}
          >
            {noteSaving ? '…' : t('admin.saveBookingNote')}
          </button>
        </div>
      </div>
    </article>
  );
}
