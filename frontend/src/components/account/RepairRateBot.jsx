import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, formatPrice } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';
import { whatsappLink } from '../../config/shop';

const MAZDORI_OPTION = 'mazdori';

export default function RepairRateBot() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState([]);
  const [model, setModel] = useState('');
  const [partType, setPartType] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setError('');
    try {
      const data = await api.getRepairRateCatalog();
      setCatalog(data.catalog || []);
    } catch (err) {
      setError(err.message || t('account.rateLoadFailed'));
    } finally {
      setLoadingCatalog(false);
    }
  }, [t]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const partsForModel = useMemo(() => {
    const entry = catalog.find((c) => c.model === model);
    return entry?.parts || [];
  }, [catalog, model]);

  const pushMessage = (msg) => {
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${prev.length}` }]);
  };

  const handleCheckRate = async (e) => {
    e.preventDefault();
    setError('');
    setQuerying(true);

    const isMazdori = partType === MAZDORI_OPTION;

    try {
      const data = await api.repairRateQuery({
        model: model || undefined,
        part_type: isMazdori ? MAZDORI_OPTION : partType,
        inquiry_type: isMazdori ? MAZDORI_OPTION : undefined,
      });

      if (data.type === 'mazdori_redirect') {
        pushMessage({
          role: 'system',
          kind: 'mazdori',
          text: data.message,
          whatsapp_url: data.whatsapp_url,
        });
      } else {
        pushMessage({
          role: 'system',
          kind: 'rate',
          text: data.message,
          min_price: data.min_price,
          max_price: data.max_price,
          part_label: data.part_label,
          model: data.model,
          disclaimer: data.disclaimer,
        });
      }
    } catch (err) {
      setError(err.message || t('account.rateQueryFailed'));
    } finally {
      setQuerying(false);
    }
  };

  if (loadingCatalog) {
    return <p className="account-muted">{t('common.loading')}</p>;
  }

  if (!catalog.length) {
    return (
      <div className="rate-bot-empty">
        <p>{t('account.rateCatalogEmpty')}</p>
        <button type="button" className="btn btn-ghost" onClick={loadCatalog}>
          {t('common.refresh')}
        </button>
      </div>
    );
  }

  return (
    <div className="rate-bot">
      <p className="rate-bot-intro">{t('account.rateBotIntro')}</p>

      <form className="rate-bot-form" onSubmit={handleCheckRate}>
        <label className="rate-bot-field">
          <span>{t('account.rateModel')}</span>
          <select value={model} onChange={(e) => { setModel(e.target.value); setPartType(''); }} required>
            <option value="">{t('account.rateSelectModel')}</option>
            {catalog.map((entry) => (
              <option key={entry.model} value={entry.model}>{entry.model}</option>
            ))}
          </select>
        </label>

        <label className="rate-bot-field">
          <span>{t('account.ratePart')}</span>
          <select
            value={partType}
            onChange={(e) => setPartType(e.target.value)}
            required
            disabled={!model}
          >
            <option value="">{t('account.rateSelectPart')}</option>
            {partsForModel.map((part) => (
              <option key={part.part_type} value={part.part_type}>{part.part_label}</option>
            ))}
            <option value={MAZDORI_OPTION}>{t('account.rateMazdoriOption')}</option>
          </select>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-primary rate-bot-submit" disabled={querying || !model || !partType}>
          {querying ? t('account.rateChecking') : t('account.rateCheckBtn')}
        </button>
      </form>

      <div className="rate-bot-thread" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              className={`rate-bot-msg rate-bot-msg--${msg.role}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="rate-bot-msg-badge">{t('account.rateSystemLabel')}</span>
              <p>{msg.text}</p>
              {msg.kind === 'rate' && (
                <p className="rate-bot-price-range">
                  {formatPrice(msg.min_price)} – {formatPrice(msg.max_price)}
                </p>
              )}
              {msg.disclaimer && <p className="rate-bot-disclaimer">{msg.disclaimer}</p>}
              {msg.kind === 'mazdori' && msg.whatsapp_url && (
                <a
                  href={msg.whatsapp_url}
                  className="btn btn-primary rate-bot-wa"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('account.rateWhatsAppSupport')}
                </a>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <p className="rate-bot-footnote">
        {t('account.rateFootnote')}{' '}
        <a href={whatsappLink(t('account.rateWaPrefill'))} target="_blank" rel="noopener noreferrer">
          {t('account.rateWhatsAppSupport')}
        </a>
      </p>
    </div>
  );
}
