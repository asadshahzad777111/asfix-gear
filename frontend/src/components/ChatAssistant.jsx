import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { SHOP, isShopOpen, generalContactPath } from '../config/shop';
import { generalRepairQuoteContactPath } from '../config/repairModels';
import { getDefaultImage } from '../config/products';
import { hasDiscount, getSalePrice } from '../utils/pricing';
import { detectIntent, parseOrderTrackInfo } from '../utils/chatEngine';
import { useTranslation } from '../context/LanguageContext';

let nextId = 1;
const newId = () => `m${Date.now()}-${nextId++}`;

export default function ChatAssistant() {
  const { t, lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null); // null | 'track' | 'product'
  const [thinking, setThinking] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      pushBot(t('chatbot.replies.greeting'), quickReplyActions());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  useEffect(() => {
    if (open) {
      const onKey = (e) => {
        if (e.key === 'Escape') setOpen(false);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    return undefined;
  }, [open]);

  function quickReplyActions() {
    return [
      { label: t('chatbot.quickHours'), run: () => { pushUser(t('chatbot.quickHours')); replyHours(); } },
      { label: t('chatbot.quickTrack'), run: () => { pushUser(t('chatbot.quickTrack')); replyAskTrack(); } },
      { label: t('chatbot.quickRepair'), run: () => { pushUser(t('chatbot.quickRepair')); replyRepair(''); } },
      { label: t('chatbot.quickProduct'), run: () => { pushUser(t('chatbot.quickProduct')); replyAskProduct(); } },
      { label: t('chatbot.quickHuman'), run: () => { pushUser(t('chatbot.quickHuman')); replyHuman(); } },
    ];
  }

  function replyHours() {
    const hours = lang === 'roman' ? SHOP.hours : SHOP.hoursEn;
    pushBot(
      isShopOpen()
        ? t('chatbot.replies.hoursOpen', { hours })
        : t('chatbot.replies.hoursClosed', { hours })
    );
  }

  function replyAskTrack() {
    setPending('track');
    pushBot(t('chatbot.replies.trackAsk'));
  }

  function replyAskProduct() {
    setPending('product');
    pushBot(t('chatbot.replies.productAsk'));
  }

  function replyRepair(modelHint) {
    pushBot(t('chatbot.replies.repairInfo'), null, [
      { label: t('chatbot.openRepair'), to: '/repair' },
      { label: t('chatbot.openContact'), to: generalRepairQuoteContactPath(modelHint) },
    ]);
  }

  function replyHuman() {
    pushBot(t('chatbot.replies.human'), null, [
      { label: t('chatbot.openContact'), to: generalContactPath() },
    ]);
  }

  function pushUser(text) {
    setMessages((prev) => [...prev, { id: newId(), from: 'user', text }]);
  }

  function pushBot(text, quickReplies, links, products) {
    setMessages((prev) => [
      ...prev,
      { id: newId(), from: 'bot', text, quickReplies, links, products },
    ]);
  }

  async function resolveTrack(orderId, phone) {
    setThinking(true);
    try {
      const order = await api.trackOrder(orderId, phone);
      pushBot(
        t('chatbot.replies.trackFound', {
          orderId: order.order_id,
          status: order.shipping_status,
          total: Number(order.total_amount || 0).toLocaleString('en-PK'),
        }),
        null,
        [{ label: t('chatbot.openTrackPage'), to: `/track` }]
      );
    } catch {
      pushBot(t('chatbot.replies.trackNotFound'), null, [
        { label: t('chatbot.openContact'), to: generalContactPath() },
        { label: t('chatbot.openTrackPage'), to: '/track' },
      ]);
    } finally {
      setThinking(false);
      setPending(null);
    }
  }

  async function resolveProductSearch(term) {
    setThinking(true);
    try {
      const all = await api.getProducts({ search: term });
      const results = all.filter((p) => p.category !== 'Gaming').slice(0, 3);
      if (results.length === 0) {
        pushBot(t('chatbot.replies.productNotFound'), null, [
          { label: t('chatbot.openShop'), to: '/shop' },
          { label: t('chatbot.openContact'), to: generalContactPath() },
        ]);
      } else {
        pushBot(t('chatbot.replies.productFoundIntro'), null, null, results);
      }
    } catch {
      pushBot(t('chatbot.replies.productNotFound'), null, [{ label: t('chatbot.openShop'), to: '/shop' }]);
    } finally {
      setThinking(false);
      setPending(null);
    }
  }

  function handleQuickAction(action) {
    action.run();
  }

  function handleUserText(rawText) {
    const text = rawText.trim();
    if (!text) return;
    pushUser(text);
    setInput('');

    if (pending === 'track') {
      const info = parseOrderTrackInfo(text);
      if (info) {
        resolveTrack(info.orderId, info.phone);
      } else {
        pushBot(t('chatbot.replies.trackAsk'));
      }
      return;
    }

    if (pending === 'product') {
      resolveProductSearch(text);
      return;
    }

    const intent = detectIntent(text);

    switch (intent) {
      case 'track': {
        const info = parseOrderTrackInfo(text);
        if (info) {
          resolveTrack(info.orderId, info.phone);
        } else {
          setPending('track');
          pushBot(t('chatbot.replies.trackAsk'));
        }
        break;
      }
      case 'product': {
        resolveProductSearch(text);
        break;
      }
      case 'repair': {
        replyRepair(text);
        break;
      }
      case 'hours': {
        replyHours();
        break;
      }
      case 'location': {
        pushBot(t('chatbot.replies.location', { address: SHOP.fullAddress }), null, [
          { label: SHOP.city, href: SHOP.mapsUrl },
        ]);
        break;
      }
      case 'human': {
        replyHuman();
        break;
      }
      case 'greeting': {
        pushBot(t('chatbot.replies.greeting'), quickReplyActions());
        break;
      }
      case 'thanks': {
        pushBot(t('chatbot.replies.thanks'));
        break;
      }
      default: {
        pushBot(t('chatbot.replies.fallback'), quickReplyActions());
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    handleUserText(input);
  };

  return (
    <>
      <button
        type="button"
        className={`whatsapp-float chat-fab-trigger ${open ? 'is-open' : ''}`}
        aria-label={t('chatbot.fabAria')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <span className="chat-fab-close" aria-hidden="true">✕</span>
        ) : (
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.62 1.31 4.96 3.39 6.57-.09.86-.37 2.32-1.19 3.63a.5.5 0 0 0 .57.74c1.9-.5 3.36-1.36 4.15-1.92.99.26 2.04.4 3.08.4 5.52 0 10-3.94 10-8.8S17.52 2 12 2Z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="chat-assistant-panel glass-card" role="dialog" aria-label={t('chatbot.title')}>
          <div className="chat-assistant-head">
            <div>
              <strong>{t('chatbot.title')}</strong>
              <span>{t('chatbot.subtitle')}</span>
            </div>
            <button
              type="button"
              className="chat-assistant-close"
              onClick={() => setOpen(false)}
              aria-label={t('chatbot.close')}
            >
              ✕
            </button>
          </div>

          <div className="chat-assistant-body" ref={bodyRef}>
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} onQuickAction={handleQuickAction} t={t} />
            ))}
            {thinking && (
              <div className="chat-bubble chat-bubble--bot chat-bubble--typing">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            )}
          </div>

          <form className="chat-assistant-input" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chatbot.inputPlaceholder')}
              maxLength={300}
            />
            <button type="submit" aria-label={t('chatbot.send')} disabled={!input.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function ChatBubble({ message, onQuickAction, t }) {
  const isBot = message.from === 'bot';
  return (
    <div className={`chat-bubble chat-bubble--${message.from}`}>
      {message.text && <p className="chat-bubble-text">{message.text}</p>}

      {isBot && Array.isArray(message.products) && message.products.length > 0 && (
        <div className="chat-product-list">
          {message.products.map((p) => (
            <Link key={p.id} to={`/shop/${p.id}`} className="chat-product-card">
              <img
                src={p.image || getDefaultImage(p.category)}
                alt={p.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = getDefaultImage(p.category);
                }}
              />
              <div>
                <strong>{p.name}</strong>
                <span>
                  {hasDiscount(p) ? formatPrice(getSalePrice(p)) : formatPrice(p.price)}
                </span>
              </div>
              <span className="chat-product-view">{t('chatbot.viewProduct')}</span>
            </Link>
          ))}
        </div>
      )}

      {isBot && Array.isArray(message.links) && message.links.length > 0 && (
        <div className="chat-bubble-actions">
          {message.links.map((link) =>
            link.href ? (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="chat-action-btn">
                {link.label}
              </a>
            ) : (
              <Link key={link.label} to={link.to} className="chat-action-btn">
                {link.label}
              </Link>
            )
          )}
        </div>
      )}

      {isBot && Array.isArray(message.quickReplies) && message.quickReplies.length > 0 && (
        <div className="chat-bubble-actions chat-quick-replies">
          {message.quickReplies.map((action) => (
            <button
              key={action.label}
              type="button"
              className="chat-action-btn chat-action-btn--quick"
              onClick={() => onQuickAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
