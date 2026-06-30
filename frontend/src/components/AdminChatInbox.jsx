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

export default function AdminChatInbox({ compact = false, onUnreadChange }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replies, setReplies] = useState({});
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
      console.error(err);
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

  const sendReply = async (id) => {
    const reply = replies[id]?.trim();
    if (!reply) return;
    try {
      const updated = await api.replyContactMessage(id, reply);
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === updated.id ? updated : m));
        onUnreadChangeRef.current?.(next.filter((m) => !m.staff_reply).length);
        return next;
      });
      setReplies((prev) => ({ ...prev, [id]: '' }));
    } catch (err) {
      alert(err.message);
    }
  };

  const openWhatsApp = (msg) => {
    const text = `Assalam o Alaikum ${msg.name},\n\nAap ka message:\n"${msg.message}"\n\n— ${SHOP.name} Team`;
    window.open(customerWhatsAppUrl(msg.phone, text), '_blank', 'noopener,noreferrer');
  };

  if (loading && messages.length === 0 && !error) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  if (error && messages.length === 0) {
    return (
      <div className="admin-chat-error">
        <p>{error}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => loadMessages()}>
          {t('common.refresh')}
        </button>
      </div>
    );
  }

  if (messages.length === 0) {
    return <p className="admin-float-empty">{t('admin.messagesEmpty')}</p>;
  }

  return (
    <div className={`admin-chat-inbox ${compact ? 'admin-chat-inbox--compact' : ''}`}>
      {messages.map((m) => (
        <article key={m.id} className={`admin-float-card ${!m.staff_reply ? 'is-unread' : ''}`}>
          <div className="admin-float-card-head">
            <strong>{m.name}</strong>
            <span>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
          </div>
          <p className="admin-float-meta">
            {m.phone ? `📞 ${m.phone}` : ''}
            {m.email ? `${m.phone ? ' · ' : ''}✉️ ${m.email}` : ''}
            {!m.phone && !m.email ? '—' : ''}
          </p>
          <p className="admin-float-issue">{m.message}</p>
          {m.staff_reply && (
            <p className="admin-float-reply">↩ {m.staff_reply}</p>
          )}
          <textarea
            rows={compact ? 2 : 3}
            placeholder={t('admin.replyPlaceholder')}
            value={replies[m.id] || ''}
            onChange={(e) => setReplies((prev) => ({ ...prev, [m.id]: e.target.value }))}
          />
          <div className="admin-chat-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => sendReply(m.id)}>
              {t('admin.saveReply')}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openWhatsApp(m)}>
              WhatsApp
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
