import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { SHOP } from '../config/shop';
import { startVisibilityPoll } from '../utils/visibilityPoll';

const POLL_MS = 45_000;

function customerWhatsAppUrl(phone, message) {
  const raw = String(phone || '').replace(/\D/g, '');
  const intl = raw
    ? (raw.startsWith('92') ? raw : `92${raw.replace(/^0/, '')}`)
    : SHOP.phoneIntl;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

function AuthorCell({ msg }) {
  return (
    <div className="wp-comment-author">
      <strong>{msg.name}</strong>
      {msg.email ? <div className="wp-comment-meta">{msg.email}</div> : null}
      {msg.phone ? <div className="wp-comment-meta">{msg.phone}</div> : null}
    </div>
  );
}

export default function AdminChatInbox({ compact = false, onUnreadChange }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [savingId, setSavingId] = useState(null);
  const onUnreadChangeRef = useRef(onUnreadChange);
  const mountedRef = useRef(true);

  onUnreadChangeRef.current = onUnreadChange;

  const applyMessages = useCallback((data) => {
    const list = Array.isArray(data) ? data : [];
    setMessages(list);
    onUnreadChangeRef.current?.(list.filter((m) => !m.staff_reply).length);
    return list;
  }, []);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await api.getContactMessages();
      if (!mountedRef.current) return;
      applyMessages(data);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message || 'Something went wrong');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [applyMessages]);

  useEffect(() => {
    mountedRef.current = true;
    loadMessages();
    const stop = startVisibilityPoll(() => loadMessages({ silent: true }), POLL_MS);
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [loadMessages]);

  const updateLocal = (updated) => {
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === updated.id ? updated : m));
      onUnreadChangeRef.current?.(next.filter((m) => !m.staff_reply).length);
      return next;
    });
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditText(msg.message);
    setReplyingId(null);
  };

  const startReply = (msg) => {
    setReplyingId(msg.id);
    setReplyText(msg.staff_reply || '');
    setEditingId(null);
  };

  const saveEdit = async (id) => {
    const message = editText.trim();
    if (!message) return;
    setSavingId(id);
    try {
      const updated = await api.updateContactMessage(id, { message });
      updateLocal(updated);
      setEditingId(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const saveReply = async (id) => {
    const reply = replyText.trim();
    if (!reply) return;
    setSavingId(id);
    try {
      const updated = await api.updateContactMessage(id, { reply });
      updateLocal(updated);
      setReplyingId(null);
      setReplyText('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteMessage = async (msg) => {
    if (!confirm(`Delete message from ${msg.name}?`)) return;
    setSavingId(msg.id);
    try {
      await api.deleteContactMessage(msg.id);
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== msg.id);
        onUnreadChangeRef.current?.(next.filter((m) => !m.staff_reply).length);
        return next;
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const openWhatsApp = (msg) => {
    const text = `Assalam o Alaikum ${msg.name},\n\nAap ka message:\n"${msg.message}"\n\n— ${SHOP.name} Team`;
    window.open(customerWhatsAppUrl(msg.phone, text), '_blank', 'noopener,noreferrer');
  };

  if (loading && messages.length === 0 && !error) {
    return <div className="wp-loading">{t('common.loading')}</div>;
  }

  if (error && messages.length === 0) {
    return (
      <div className="wp-notice wp-notice--error">
        <p>{error}</p>
        <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={() => loadMessages()}>
          {t('common.refresh')}
        </button>
      </div>
    );
  }

  if (messages.length === 0) {
    return <div className="wp-empty"><p>{t('admin.messagesEmpty')}</p></div>;
  }

  if (compact) {
    return (
      <div className="admin-chat-inbox admin-chat-inbox--compact">
        {messages.slice(0, 5).map((m) => (
          <article key={m.id} className={`admin-float-card ${!m.staff_reply ? 'is-unread' : ''}`}>
            <strong>{m.name}</strong>
            <p className="admin-float-issue">{m.message}</p>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="wp-comments-table-wrap">
      <div className="wp-toolbar">
        <div className="wp-toolbar-right">
          <span style={{ fontSize: '0.84rem', color: '#50575e' }}>{messages.length} messages</span>
        </div>
      </div>
      <div className="wp-table-wrap">
        <table className="wp-table wp-table--comments">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Author</th>
              <th>Comment</th>
              <th style={{ width: '14%' }}>In response to</th>
              <th style={{ width: '14%' }}>Submitted on</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} className={!m.staff_reply ? 'is-unread' : ''}>
                <td><AuthorCell msg={m} /></td>
                <td>
                  {editingId === m.id ? (
                    <div className="wp-comment-edit">
                      <textarea rows={4} value={editText} onChange={(e) => setEditText(e.target.value)} />
                      <div className="wp-comment-edit-actions">
                        <button type="button" className="wp-button wp-button--small" disabled={savingId === m.id} onClick={() => saveEdit(m.id)}>
                          Update
                        </button>
                        <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="wp-comment-text">{m.message}</div>
                      {m.staff_reply ? (
                        <div className="wp-comment-reply">
                          <strong>Reply:</strong> {m.staff_reply}
                        </div>
                      ) : null}
                      {replyingId === m.id ? (
                        <div className="wp-comment-edit" style={{ marginTop: '0.5rem' }}>
                          <textarea rows={3} placeholder={t('admin.replyPlaceholder')} value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                          <div className="wp-comment-edit-actions">
                            <button type="button" className="wp-button wp-button--small" disabled={savingId === m.id} onClick={() => saveReply(m.id)}>
                              {t('admin.saveReply')}
                            </button>
                            <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={() => setReplyingId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="wp-row-actions">
                        <button type="button" onClick={() => startReply(m)}>Reply</button>
                        <span>|</span>
                        <button type="button" onClick={() => startEdit(m)}>Edit</button>
                        <span>|</span>
                        <button type="button" onClick={() => openWhatsApp(m)}>WhatsApp</button>
                        <span>|</span>
                        <button type="button" className="is-danger" onClick={() => deleteMessage(m)}>Trash</button>
                      </div>
                    </>
                  )}
                </td>
                <td>
                  <span className="wp-comment-response">Contact form</span>
                </td>
                <td>{m.created_at ? new Date(m.created_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
