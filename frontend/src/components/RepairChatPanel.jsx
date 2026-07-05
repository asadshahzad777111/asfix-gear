import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  CUSTOMER_REPAIR_TEMPLATES,
  STAFF_REPAIR_TEMPLATES,
  fillRepairTemplate,
} from '../config/repairChatTemplates';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import useLiveUpdates from '../hooks/useLiveUpdates';
import { startVisibilityPoll } from '../utils/visibilityPoll';
import './repair-chat.css';

const POLL_MS = 30_000;

export default function RepairChatPanel({
  bookingId,
  booking,
  mode = 'customer',
  onClose,
  onUnreadChange,
}) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [error, setError] = useState('');
  const threadRef = useRef(null);
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!bookingId) return;
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const data = await api.getRepairMessages(bookingId);
      if (!mountedRef.current) return;
      setMessages(data.messages || []);
      onUnreadChange?.(data.unread || 0);
    } catch (err) {
      if (!mountedRef.current || silent) return;
      setError(err.message || t('repairChat.loadError'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [bookingId, onUnreadChange, t]);

  useEffect(() => {
    mountedRef.current = true;
    loadMessages();
    const stop = startVisibilityPoll(() => loadMessages({ silent: true }), POLL_MS);
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useLiveUpdates({
    enabled: Boolean(user && bookingId),
    onEvent: (event, data) => {
      if (event !== 'repair_message') return;
      if (Number(data.repair_booking_id) !== Number(bookingId)) return;
      loadMessages({ silent: true });
    },
  });

  const sendMessage = async (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    await sendText(text);
  };

  const sendText = async (text) => {
    const body = String(text || '').trim();
    if (!body || sending || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      const msg = await api.sendRepairMessage(bookingId, body);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      setError('');
      onUnreadChange?.(0);
      scrollToBottom();
    } catch (err) {
      setError(err.message || t('repairChat.sendError'));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const sendTemplate = async (template) => {
    if (sending || sendingRef.current) return;
    setActiveTemplateId(template.id);
    try {
      const name = mode === 'staff' ? booking?.customer_name : (user?.name || user?.username);
      const text = fillRepairTemplate(template, { name, lang });
      await sendText(text);
    } finally {
      setActiveTemplateId(null);
    }
  };

  const templates = mode === 'staff' ? STAFF_REPAIR_TEMPLATES : CUSTOMER_REPAIR_TEMPLATES;

  const refLabel = booking?.booking_ref || (bookingId ? `#${bookingId}` : '');
  const deviceLabel = booking
    ? `${booking.device_brand || ''} ${booking.device_model || ''}`.trim()
    : '';

  return (
    <div className={`repair-chat-panel repair-chat-panel--${mode}`} role="dialog" aria-label={t('repairChat.title')}>
      <div className="repair-chat-head">
        <div>
          <span className="repair-chat-badge">{t('repairChat.title')}</span>
          <h3>{mode === 'staff' ? booking?.customer_name : t('repairChat.shopTitle')}</h3>
          {refLabel ? (
            <p className="repair-chat-meta">
              {t('repairChat.bookingRef')}: <strong>{refLabel}</strong>
              {deviceLabel ? <> · {deviceLabel}</> : null}
            </p>
          ) : null}
          {booking?.issue ? (
            <p className="repair-chat-issue">{booking.issue}</p>
          ) : null}
        </div>
        {onClose ? (
          <button type="button" className="repair-chat-close" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        ) : null}
      </div>

      <div className="repair-chat-thread" ref={threadRef}>
        {loading && messages.length === 0 ? (
          <p className="repair-chat-loading">{t('common.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="repair-chat-empty">{t('repairChat.empty')}</p>
        ) : (
          messages.map((msg) => {
            const isMine = mode === 'staff' ? msg.sender === 'staff' : msg.sender === 'customer';
            return (
              <article
                key={msg.id}
                className={`repair-chat-bubble ${isMine ? 'is-mine' : 'is-theirs'}`}
              >
                <header>
                  <strong>{msg.sender_name || (msg.sender === 'staff' ? t('repairChat.shopTitle') : t('repairChat.you'))}</strong>
                  <time>{msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}</time>
                </header>
                <p>{msg.text}</p>
              </article>
            );
          })
        )}
      </div>

      {error ? <p className="repair-chat-error">{error}</p> : null}

      <div className="repair-chat-templates" aria-label={t('repairChat.templatesLabel')}>
        <span className="repair-chat-templates-label">{t('repairChat.templatesLabel')}</span>
        <div className="repair-chat-template-list">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="repair-chat-template-btn"
              disabled={sending || activeTemplateId === tpl.id}
              title={fillRepairTemplate(tpl, {
                name: mode === 'staff' ? booking?.customer_name : (user?.name || 'Customer'),
                lang,
              })}
              onClick={() => sendTemplate(tpl)}
            >
              {t(tpl.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <form className="repair-chat-compose" onSubmit={sendMessage}>
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('repairChat.placeholder')}
          maxLength={2000}
          disabled={sending}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !draft.trim()}>
          {sending ? t('repairChat.sending') : t('repairChat.send')}
        </button>
      </form>
    </div>
  );
}

export function RepairChatButton({ booking, unread = 0, onClick, className = '' }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`repair-chat-open-btn ${unread > 0 ? 'has-unread' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      💬 {t('repairChat.open')}
      {unread > 0 ? <span className="repair-chat-unread-badge">{unread}</span> : null}
    </button>
  );
}

export function RepairChatModal({ booking, mode = 'customer', onClose, onUnreadChange }) {
  if (!booking?.id) return null;
  return (
    <div className="repair-chat-overlay" onClick={onClose} role="presentation">
      <div className="repair-chat-modal" onClick={(e) => e.stopPropagation()}>
        <RepairChatPanel
          bookingId={booking.id}
          booking={booking}
          mode={mode}
          onClose={onClose}
          onUnreadChange={onUnreadChange}
        />
      </div>
    </div>
  );
}

export function RepairChatLoginPrompt({ className = '' }) {
  const { t } = useTranslation();
  return (
    <p className={`repair-chat-login-prompt ${className}`.trim()}>
      {t('repairChat.loginPrompt')}{' '}
      <Link to="/login">{t('nav.login')}</Link>
    </p>
  );
}
