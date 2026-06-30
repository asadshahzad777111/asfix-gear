import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { ProductPrice } from '../DiscountPicker';
import { api, formatPrice } from '../../api/client';
import { getSalePrice } from '../../utils/pricing';
import { useTranslation } from '../../context/LanguageContext';
import { SHOP } from '../../config/shop';
import OrderSuccessPanel from '../OrderSuccessPanel';

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan'];

const CHECKOUT_STEPS = ['cart', 'delivery', 'payment', 'confirm'];

const PAYMENT_METHODS = [
  { id: 'cod', icon: '💵', lahoreOnly: true },
  { id: 'jazzcash', icon: '📱', lahoreOnly: false },
  { id: 'easypaisa', icon: '💳', lahoreOnly: false },
  { id: 'bank', icon: '🏦', lahoreOnly: false },
];

function isLahoreCity(city) {
  return String(city || '').trim().toLowerCase() === 'lahore';
}

export default function FloatingCart() {
  const { t } = useTranslation();
  const { items, count, open, setOpen, removeItem, updateQty, clearCart } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [successPhone, setSuccessPhone] = useState('');
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    city: 'Lahore',
    payment_mode: 'cod',
    notes: '',
  });

  const total = items.reduce((sum, i) => sum + getSalePrice(i) * i.qty, 0);
  const lahore = isLahoreCity(form.city);
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  const waHref =
    items.length > 0
      ? `https://wa.me/${SHOP.phoneIntl}?text=${encodeURIComponent(
          `AsFix & Gear Order:\n\n${items.map((i) => `• ${i.name} x${i.qty}`).join('\n')}\n\nTotal: ${formatPrice(total)}`
        )}`
      : '#';

  useEffect(() => {
    if (!lahore && form.payment_mode === 'cod') {
      setForm((f) => ({ ...f, payment_mode: 'jazzcash' }));
    }
  }, [lahore, form.payment_mode]);

  const resetCheckout = () => {
    setCheckoutOpen(false);
    setCheckoutStep(0);
    setOrderMsg('');
  };

  const startCheckout = () => {
    setCheckoutOpen(true);
    setCheckoutStep(1);
    setOrderMsg('');
  };

  const goBack = () => {
    setOrderMsg('');
    if (checkoutStep <= 1) {
      resetCheckout();
      return;
    }
    setCheckoutStep((s) => s - 1);
  };

  const goNext = () => {
    setOrderMsg('');
    if (checkoutStep === 1) {
      if (!form.customer_name.trim() || !form.phone.trim()) {
        setOrderMsg(t('cart.namePhoneRequired'));
        return;
      }
    }
    if (checkoutStep === 2) {
      if (!form.payment_mode) {
        setOrderMsg(t('cart.selectPayment'));
        return;
      }
      if (!lahore && form.payment_mode === 'cod') {
        setOrderMsg(t('cart.codUnavailable'));
        return;
      }
    }
    setCheckoutStep((s) => Math.min(s + 1, 3));
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.phone.trim()) {
      setOrderMsg(t('cart.namePhoneRequired'));
      return;
    }
    if (!lahore && form.payment_mode === 'cod') {
      setOrderMsg(t('cart.codUnavailable'));
      return;
    }
    setSubmitting(true);
    setOrderMsg('');
    try {
      const { order } = await api.placeOrder({
        ...form,
        items: items.map((i) => ({
          product_id: i.id,
          name: i.name,
          qty: i.qty,
          price: getSalePrice(i),
        })),
      });
      setSuccessPhone(form.phone.trim());
      setOrderSuccess(order);
      clearCart();
      resetCheckout();
      setForm({ customer_name: '', phone: '', city: 'Lahore', payment_mode: 'cod', notes: '' });
    } catch (err) {
      setOrderMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const dismissSuccess = () => {
    setOrderSuccess(null);
    setSuccessPhone('');
    setOpen(false);
  };

  const paymentLabel = (id) => {
    if (id === 'cod') return t('cart.codLahore');
    return t(`cart.${id}`);
  };

  return (
    <>
      <motion.button
        type="button"
        className="floating-cart-trigger"
        data-cart-target
        data-magnetic
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.92 }}
        animate={count > 0 ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={{ duration: 0.45 }}
        aria-label={t('cart.openCart', { count })}
      >
        <span className="floating-cart-icon">🛒</span>
        {count > 0 && (
          <motion.span
            className="floating-cart-badge"
            key={count}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 16 }}
          >
            {count}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="floating-cart-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="floating-cart-panel"
              initial={{ x: '105%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '105%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="floating-cart-head">
                <h2>{orderSuccess ? t('orderSuccess.title') : checkoutOpen ? t('cart.checkoutTitle') : t('cart.yourCart')}</h2>
                <button type="button" className="floating-cart-close" onClick={() => setOpen(false)} aria-label={t('cart.closeCart')}>
                  ✕
                </button>
              </div>

              {orderSuccess ? (
                <OrderSuccessPanel order={orderSuccess} phone={successPhone} onDone={dismissSuccess} />
              ) : checkoutOpen ? (
                <div className="checkout-wizard">
                  <nav className="checkout-stepper" aria-label={t('cart.checkoutTitle')}>
                    {CHECKOUT_STEPS.map((step, i) => (
                      <div
                        key={step}
                        className={`checkout-stepper-item${i <= checkoutStep ? ' checkout-stepper-item--active' : ''}${i === checkoutStep ? ' checkout-stepper-item--current' : ''}`}
                      >
                        <span className="checkout-stepper-dot">{i + 1}</span>
                        <span className="checkout-stepper-label">{t(`cart.step${step.charAt(0).toUpperCase() + step.slice(1)}`)}</span>
                      </div>
                    ))}
                  </nav>

                  {orderMsg && <div className="alert alert-error checkout-alert">{orderMsg}</div>}

                  <div className="checkout-body">
                    {checkoutStep === 1 && (
                      <section className="checkout-section">
                        <h3 className="checkout-section-title">{t('cart.deliveryTitle')}</h3>
                        <input
                          placeholder={t('cart.fullName')}
                          value={form.customer_name}
                          onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                          required
                        />
                        <input
                          placeholder={t('cart.phone')}
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          required
                        />
                        <label className="checkout-field-label">{t('cart.cityLabel')}</label>
                        <select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
                          {CITIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          <option value="Other">{t('cart.cityOther')}</option>
                        </select>
                        <div className={`checkout-city-banner${lahore ? ' checkout-city-banner--lahore' : ' checkout-city-banner--advance'}`}>
                          <span className="checkout-city-banner-icon">{lahore ? '🛵' : '💳'}</span>
                          <p>{lahore ? t('cart.codLahoreHint') : t('cart.advancePaymentHint')}</p>
                        </div>
                        <textarea
                          className="checkout-notes"
                          placeholder={t('cart.addressNotes')}
                          value={form.notes}
                          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                          rows={2}
                        />
                      </section>
                    )}

                    {checkoutStep === 2 && (
                      <section className="checkout-section">
                        <h3 className="checkout-section-title">{t('cart.paymentTitle')}</h3>
                        {!lahore && (
                          <p className="checkout-payment-note">{t('cart.advancePaymentHint')}</p>
                        )}
                        <div className="checkout-payment-grid" role="radiogroup" aria-label={t('cart.paymentTitle')}>
                          {PAYMENT_METHODS.map(({ id, icon, lahoreOnly }) => {
                            const disabled = lahoreOnly && !lahore;
                            const selected = form.payment_mode === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={disabled}
                                className={`checkout-payment-card${selected ? ' checkout-payment-card--selected' : ''}${disabled ? ' checkout-payment-card--disabled' : ''}`}
                                onClick={() => !disabled && setForm((f) => ({ ...f, payment_mode: id }))}
                              >
                                <span className="checkout-payment-icon">{icon}</span>
                                <span className="checkout-payment-name">{paymentLabel(id)}</span>
                                {id === 'cod' && lahore && (
                                  <span className="checkout-payment-badge">{t('cart.codBadge')}</span>
                                )}
                                {disabled && (
                                  <span className="checkout-payment-muted">{t('cart.codUnavailableShort')}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {checkoutStep === 3 && (
                      <section className="checkout-section checkout-confirm">
                        <h3 className="checkout-section-title">{t('cart.confirmTitle')}</h3>
                        <div className="checkout-summary-card glass-card">
                          <div className="checkout-summary-row">
                            <span>{t('cart.orderSummary')}</span>
                            <strong>{t('cart.itemsCount', { count: itemCount })}</strong>
                          </div>
                          <ul className="checkout-summary-items">
                            {items.map((item) => (
                              <li key={item.id}>
                                <span>{item.name} × {item.qty}</span>
                                <span>{formatPrice(getSalePrice(item) * item.qty)}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="checkout-summary-row checkout-summary-total">
                            <span>{t('cart.total')}</span>
                            <strong>{formatPrice(total)}</strong>
                          </div>
                        </div>
                        <div className="checkout-summary-meta">
                          <p><span>{t('cart.deliverTo')}</span> <strong>{form.customer_name}</strong>, {form.city}</p>
                          <p><span>{t('cart.phone')}</span> <strong>{form.phone}</strong></p>
                          <p><span>{t('cart.payVia')}</span> <strong>{paymentLabel(form.payment_mode)}</strong></p>
                          {form.notes && <p><span>{t('cart.addressNotes')}</span> {form.notes}</p>}
                        </div>
                      </section>
                    )}
                  </div>

                  <div className="checkout-nav">
                    <button type="button" className="btn btn-outline" onClick={goBack}>
                      {checkoutStep <= 1 ? t('cart.cancelCheckout') : t('cart.back')}
                    </button>
                    {checkoutStep < 3 ? (
                      <button type="button" className="btn btn-primary" onClick={goNext}>
                        {t('cart.continue')}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary" disabled={submitting} onClick={submitOrder}>
                        {submitting ? t('cart.placing') : t('cart.placeOrder')}
                      </button>
                    )}
                  </div>
                </div>
              ) : items.length === 0 ? (
                <p className="floating-cart-empty">{t('cart.empty')}</p>
              ) : (
                <>
                  <ul className="floating-cart-list">
                    {items.map((item) => (
                      <motion.li
                        key={item.id}
                        className="floating-cart-item"
                        layout
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                      >
                        <img src={item.image} alt={item.name} />
                        <div className="floating-cart-item-body">
                          <strong>{item.name}</strong>
                          <ProductPrice product={item} size="sm" />
                          <div className="floating-cart-qty">
                            <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} disabled={item.qty <= 1}>−</button>
                            <span>{item.qty}</span>
                            <button type="button" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                          </div>
                        </div>
                        <button type="button" className="floating-cart-remove" onClick={() => removeItem(item.id)} aria-label={t('cart.remove')}>
                          ✕
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                  <p className="floating-cart-total">{t('cart.total')} <strong>{formatPrice(total)}</strong></p>
                </>
              )}

              {!orderSuccess && !checkoutOpen && (
                <div className="floating-cart-foot">
                  {items.length > 0 && (
                    <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={startCheckout}>
                      {t('cart.proceedCheckout')}
                    </button>
                  )}
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-whatsapp premium-btn premium-btn--liquid"
                    style={{ width: '100%', marginTop: '0.5rem', opacity: items.length ? 1 : 0.5, pointerEvents: items.length ? 'auto' : 'none' }}
                  >
                    {t('cart.whatsappCheckout')}
                  </a>
                  {items.length > 0 && (
                    <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '0.5rem' }} onClick={clearCart}>
                      {t('cart.clearCart')}
                    </button>
                  )}
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
