import { formatPrice } from '../api/client';
import { isCodPayment } from '../config/payments';

const METHOD_META = {
  safepay: {
    icon: '🔐',
    logos: ['Visa', 'MC'],
    recommended: true,
  },
  cod: {
    icon: '💵',
    recommended: false,
  },
  jazzcash: {
    icon: '📱',
    recommended: false,
  },
  easypaisa: {
    icon: '💚',
    recommended: false,
  },
  bank: {
    icon: '🏦',
    recommended: false,
  },
  payfast: {
    icon: '🔒',
    recommended: false,
  },
};

/**
 * Daraz-style full-screen "Select Payment Method" sheet.
 */
export default function PaymentMethodSheet({
  open,
  onClose,
  methods,
  selectedId,
  onSelect,
  total,
  submitting,
  onConfirm,
  t,
  lahore,
}) {
  if (!open) return null;

  const recommended = methods.filter((m) => METHOD_META[m.id]?.recommended);
  const others = methods.filter((m) => !METHOD_META[m.id]?.recommended);
  const isCod = isCodPayment(selectedId);
  const confirmLabel = submitting
    ? t('cart.placing')
    : isCod
      ? t('cart.placeOrder')
      : t('checkout.confirmPay');

  return (
    <div className="pay-sheet" role="dialog" aria-modal="true" aria-labelledby="pay-sheet-title">
      <header className="pay-sheet__head">
        <h2 id="pay-sheet-title">{t('checkout.selectPayment')}</h2>
        <button type="button" className="pay-sheet__close" onClick={onClose} aria-label={t('common.close')}>
          ✕
        </button>
      </header>

      <div className="pay-sheet__body">
        <div className="pay-sheet__banner" role="note">
          <span aria-hidden>ℹ️</span>
          <p>{t('checkout.paymentBanner')}</p>
        </div>

        {recommended.length > 0 ? (
          <section className="pay-sheet__section">
            <h3>{t('checkout.recommendedMethods')}</h3>
            <ul className="pay-sheet__list">
              {recommended.map((m) => {
                const meta = METHOD_META[m.id] || { icon: '💳' };
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`pay-sheet__row${selectedId === m.id ? ' is-selected' : ''}`}
                      onClick={() => onSelect(m.id)}
                    >
                      <span className="pay-sheet__icon" aria-hidden>
                        {meta.icon}
                      </span>
                      <span className="pay-sheet__text">
                        <strong>{t(`cart.${m.id}`)}</strong>
                        <small>{t(`cart.${m.id}Desc`)}</small>
                        {meta.logos?.length ? (
                          <span className="pay-sheet__logos">{meta.logos.join(' · ')}</span>
                        ) : null}
                      </span>
                      <span className={`pay-sheet__radio${selectedId === m.id ? ' is-on' : ''}`} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {others.length > 0 ? (
          <section className="pay-sheet__section">
            <h3>{t('checkout.otherMethods')}</h3>
            <ul className="pay-sheet__list">
              {others.map((m) => {
                const meta = METHOD_META[m.id] || { icon: '💳' };
                const disabled = m.id === 'cod' && !lahore;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`pay-sheet__row${selectedId === m.id ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                      onClick={() => {
                        if (!disabled) onSelect(m.id);
                      }}
                      disabled={disabled}
                    >
                      <span className="pay-sheet__icon" aria-hidden>
                        {meta.icon}
                      </span>
                      <span className="pay-sheet__text">
                        <strong>{t(`cart.${m.id}`)}</strong>
                        <small>
                          {disabled ? t('cart.codOutsideLahore') : t(`cart.${m.id}Desc`)}
                        </small>
                      </span>
                      <span className={`pay-sheet__radio${selectedId === m.id ? ' is-on' : ''}`} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="pay-sheet__trust" aria-label={t('checkout.secureCheckout')}>
          <span>🔒 Norton</span>
          <span>PCI</span>
          <span>Visa</span>
          <span>Mastercard</span>
        </div>
      </div>

      <footer className="pay-sheet__foot">
        <div className="pay-sheet__totals">
          <div>
            <span>{t('cart.subtotal')}</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <div className="pay-sheet__grand">
            <span>{t('checkout.totalAmount')}</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </div>
        <button
          type="button"
          className="pay-sheet__cta"
          disabled={submitting || !selectedId}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </footer>
    </div>
  );
}
