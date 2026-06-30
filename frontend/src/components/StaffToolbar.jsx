import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { api } from '../api/client';
import { startVisibilityPoll } from '../utils/visibilityPoll';
import AddProductModal from './AddProductModal';
import AdminChatInbox from './AdminChatInbox';

export default function StaffToolbar() {
  const { isStaff, user } = useAuth();
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isStaff || chatOpen) return undefined;

    const refreshUnread = () => {
      api.getContactMessages()
        .then((msgs) => {
          if (!Array.isArray(msgs)) return;
          setUnread(msgs.filter((m) => !m.staff_reply).length);
        })
        .catch(() => {});
    };

    refreshUnread();
    return startVisibilityPoll(refreshUnread, 60_000);
  }, [isStaff, chatOpen]);

  if (!isStaff || !user) return null;

  return (
    <>
      <div className="staff-toolbar" aria-label="Staff quick actions">
        <button
          type="button"
          className="staff-toolbar-btn staff-toolbar-btn--add"
          onClick={() => setAddOpen(true)}
          title={t('nav.addProduct')}
        >
          <span className="staff-toolbar-btn-icon">+</span>
          <span className="staff-toolbar-btn-text">{t('nav.addProduct')}</span>
        </button>

        <button
          type="button"
          className={`staff-toolbar-btn staff-toolbar-btn--chat ${chatOpen ? 'is-active' : ''} ${unread > 0 ? 'has-unread' : ''}`}
          onClick={() => setChatOpen((v) => !v)}
          title={t('admin.messages')}
        >
          <span className="staff-toolbar-btn-icon">💬</span>
          <span className="staff-toolbar-btn-text">{t('admin.messages')}</span>
          {unread > 0 && <span className="staff-toolbar-badge">{unread}</span>}
        </button>
      </div>

      {chatOpen && (
        <aside className="staff-chat-panel glass-card" aria-label={t('admin.messages')}>
          <div className="staff-chat-panel-head">
            <div>
              <span className="staff-chat-panel-badge">{t('admin.messages')}</span>
              <h3>{user.username}</h3>
              {unread > 0 && (
                <p className="staff-chat-panel-unread">{unread} {t('admin.unread')}</p>
              )}
            </div>
            <button
              type="button"
              className="staff-chat-panel-close"
              onClick={() => setChatOpen(false)}
              aria-label="Close chats"
            >
              ✕
            </button>
          </div>
          <div className="staff-chat-panel-body">
            <AdminChatInbox compact onUnreadChange={setUnread} />
          </div>
        </aside>
      )}

      <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
