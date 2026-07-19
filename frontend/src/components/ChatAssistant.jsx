import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { SHOP, isShopOpen, generalContactPath } from '../config/shop';
import { generalRepairQuoteContactPath } from '../config/repairModels';
import { getDefaultImage } from '../config/products';
import { hasDiscount, getSalePrice } from '../utils/pricing';
import { detectIntent, parseOrderTrackInfo } from '../utils/chatEngine';
import { filterPublishedProducts } from '../utils/productStatus';
import { useTranslation } from '../context/LanguageContext';
import { useChatAssistant } from '../context/ChatAssistantContext';

let nextId = 1;
const newId = () => `m${Date.now()}-${nextId++}`;

const BOARD_TOP_MIN = 18;
const BOARD_TOP_MAX = 62;

export default function ChatAssistant() {
  const { t, lang } = useTranslation();
  const { open, setOpen, toggle } = useChatAssistant();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null); // null | 'track' | 'product'
  const [thinking, setThinking] = useState(false);
  /** Vertical position of the side board (vh) — draggable for convenience */
  const [boardTop, setBoardTop] = useState(38);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const dragRef = useRef(null);

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
    const hours = lang === 'en' ? SHOP.hoursEn : SHOP.hours;
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
      const all = filterPublishedProducts(await api.getProducts({ search: term }));
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

  const onTabPointerDown = (e) => {
    if (open) return;
    const pointerId = e.pointerId;
    const startY = e.clientY;
    const startTop = boardTop;
    dragRef.current = { pointerId, startY, startTop, dragged: false };

    const onMove = (ev) => {
      if (!dragRef.current || ev.pointerId !== pointerId) return;
      const dy = ev.clientY - startY;
      if (Math.abs(dy) > 6) dragRef.current.dragged = true;
      if (!dragRef.current.dragged) return;
      const deltaVh = (dy / window.innerHeight) * 100;
      const next = Math.min(BOARD_TOP_MAX, Math.max(BOARD_TOP_MIN, startTop + deltaVh));
      setBoardTop(next);
    };

    const onUp = (ev) => {
      if (!dragRef.current || ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      /* Keep dragged flag until click so we can ignore accidental click-after-drag */
      window.setTimeout(() => {
        dragRef.current = null;
      }, 0);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onTabClick = () => {
    if (dragRef.current?.dragged) return;
    toggle();
  };

  return (
    <aside
      className={`chat-sideboard${open ? ' is-open' : ''}`}
      style={{ '--chat-board-top': `${boardTop}vh` }}
      aria-label={t('chatbot.title')}
    >
      {/* Peeking side tab — half on screen; drag vertically when closed */}
      <button
        type="button"
        className="chat-sideboard__tab"
        aria-label={t('chatbot.fabAria')}
        aria-expanded={open}
        onPointerDown={onTabPointerDown}
        onClick={onTabClick}
      >
        <span className="chat-sideboard__tab-ember" aria-hidden="true" />
        <span className="chat-sideboard__tab-label">{t('chatbot.helpTab')}</span>
        <span className="chat-sideboard__tab-grip" aria-hidden="true" />
      </button>

      <div
        className="chat-sideboard__panel glass-card"
        role="dialog"
        aria-label={t('chatbot.title')}
        aria-hidden={!open}
      >
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
    </aside>
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
