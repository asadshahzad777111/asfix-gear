import { useCallback, useEffect, useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';

import { useCart } from '../../context/CartContext';

import { ProductPrice } from '../DiscountPicker';

import { api, formatPrice } from '../../api/client';

import { getSalePrice } from '../../utils/pricing';
import { maxCartQty } from '../../utils/stock';

import { useTranslation } from '../../context/LanguageContext';

import { useAuth } from '../../context/AuthContext';

import OrderSuccessPanel from '../OrderSuccessPanel';
import PaymentInstructions from '../PaymentInstructions';
import MapAddressPicker from '../MapAddressPicker';
import { enabledPaymentMethods, mergePaymentSettings, isCodPayment } from '../../config/payments';
import { SHOP } from '../../config/shop';
import { getEstimatedDeliveryFee, isLahoreCity, isPostExDelivery, mergeDeliverySettings } from '../../config/delivery';
import { mergeAddressSettings } from '../../config/addressSettings';
import { displayAddressLine } from '../../utils/address';

import ShopLoginPrompt from '../ShopLoginPrompt';
import CustomerLoginModal from '../CustomerLoginModal';
import { useShopGate } from '../../hooks/useShopGate';



const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan'];

const CHECKOUT_STEPS = ['cart', 'delivery', 'payment', 'confirm'];

const PAYMENT_METHODS = [
  { id: 'jazzcash', icon: '📱', brandClass: 'checkout-payment-card--jazzcash' },
  { id: 'easypaisa', icon: '💳', brandClass: 'checkout-payment-card--easypaisa' },
  { id: 'bank', icon: '🏦', brandClass: '' },
  { id: 'cod', icon: '💵', brandClass: 'checkout-payment-card--cod' },
  { id: 'payfast', icon: '🔒', brandClass: 'checkout-payment-card--payfast' },
];

const PAYMENT_INSTRUCTION_MODES = new Set(['jazzcash', 'easypaisa', 'bank']);

export default function FloatingCart() {

  const { t } = useTranslation();

  const { user, isCustomer } = useAuth();

  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();

  const { items, count, open, setOpen, removeItem, updateQty, clearCart, checkoutIntent, clearCheckoutIntent } =
    useCart();

  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [checkoutStep, setCheckoutStep] = useState(0);

  const [submitting, setSubmitting] = useState(false);

  const [orderMsg, setOrderMsg] = useState('');

  const [orderSuccess, setOrderSuccess] = useState(null);

  const [successPhone, setSuccessPhone] = useState('');
  const [paymentSettings, setPaymentSettings] = useState(() => mergePaymentSettings());
  const [deliverySettings, setDeliverySettings] = useState(() => mergeDeliverySettings());
  const [addressSettings, setAddressSettings] = useState(() => mergeAddressSettings());
  const [fulfillment, setFulfillment] = useState('delivery');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressMode, setAddressMode] = useState('saved');
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [newAddress, setNewAddress] = useState({
    name: '',
    phone: '',
    country: 'Pakistan',
    region: '',
    city: '',
    postalCode: '',
    streetAddress: '',
    houseNumber: '',
    landmark: '',
    notes: '',
    text: '',
    lat: SHOP.lat,
    lng: SHOP.lng,
  });

  const [form, setForm] = useState({

    customer_name: '',

    phone: '',

    city: 'Lahore',

    payment_mode: 'jazzcash',

    notes: '',

  });



  const total = items.reduce((sum, i) => sum + getSalePrice(i) * i.qty, 0);

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const activePaymentIds = enabledPaymentMethods(paymentSettings);
  const isPickup = fulfillment === 'pickup';
  const effectiveCity = isPickup ? 'Lahore' : form.city;
  const lahore = isLahoreCity(effectiveCity);
  const estimatedDeliveryFee = isPickup ? 0 : getEstimatedDeliveryFee(form.city, deliverySettings);
  const checkoutPaymentMethods = PAYMENT_METHODS.filter(({ id }) => {
    if (!activePaymentIds.includes(id)) return false;
    if (id === 'cod' && !lahore) return false;
    return true;
  });
  const showPaymentInstructions = PAYMENT_INSTRUCTION_MODES.has(form.payment_mode);
  const isCod = isCodPayment(form.payment_mode);

  // Defaults already cover first paint — only hit Render when cart/checkout actually opens
  useEffect(() => {
    if (!open && !checkoutOpen) return undefined;
    let cancelled = false;
    api.getPaymentSettings()
      .then((data) => { if (!cancelled) setPaymentSettings(mergePaymentSettings(data)); })
      .catch(() => { if (!cancelled) setPaymentSettings(mergePaymentSettings()); });
    api.getDeliverySettings()
      .then((data) => { if (!cancelled) setDeliverySettings(mergeDeliverySettings(data)); })
      .catch(() => { if (!cancelled) setDeliverySettings(mergeDeliverySettings()); });
    api.getAddressSettings()
      .then((data) => { if (!cancelled) setAddressSettings(mergeAddressSettings(data)); })
      .catch(() => { if (!cancelled) setAddressSettings(mergeAddressSettings()); });
    return () => { cancelled = true; };
  }, [open, checkoutOpen]);

  useEffect(() => {
    document.body.classList.toggle('cart-open', open);
    return () => document.body.classList.remove('cart-open');
  }, [open]);

  useEffect(() => {
    const ids = checkoutPaymentMethods.map((m) => m.id);
    if (!ids.includes(form.payment_mode) && ids[0]) {
      setForm((prev) => ({ ...prev, payment_mode: ids[0] }));
    }
  }, [form.city, form.payment_mode, fulfillment, activePaymentIds.join(',')]);

  const showWalletInstructions = showPaymentInstructions && !isCod;



  useEffect(() => {

    if (!isCustomer || !user) return;

    setForm((prev) => ({

      ...prev,

      customer_name: user.name || prev.customer_name,

      phone: user.phone || prev.phone,

    }));

    setNewAddress((prev) => ({

      ...prev,

      name: user.name || prev.name,

      phone: user.phone || prev.phone,

    }));

  }, [isCustomer, user]);



  const loadSavedAddresses = useCallback(async () => {

    if (!isCustomer) return;

    try {

      const data = await api.getMyAddresses();

      setSavedAddresses(data);

      const defaultAddr = data.find((a) => a.is_default) || data[0];

      if (defaultAddr) {

        setSelectedAddressId(defaultAddr.id);

        setAddressMode('saved');

      } else {

        setAddressMode('new');

      }

    } catch {

      setSavedAddresses([]);

      setAddressMode('new');

    }

  }, [isCustomer]);



  const resetCheckout = () => {

    setCheckoutOpen(false);

    setCheckoutStep(0);

    setOrderMsg('');

  };



  const startCheckout = () => {

    requireCustomer(() => {

      setCheckoutOpen(true);

      setCheckoutStep(1);

      setOrderMsg('');

      loadSavedAddresses();

    });

  };

  // Order Now from product page → open website checkout (not WhatsApp)
  useEffect(() => {
    if (!checkoutIntent || !open || items.length === 0 || checkoutOpen || orderSuccess) return;
    clearCheckoutIntent?.();
    startCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot intent from buyNow
  }, [checkoutIntent, open, items.length, checkoutOpen, orderSuccess]);



  const validateDeliveryAddress = () => {
    if (fulfillment === 'pickup') return true;

    if (addressMode === 'saved') {
      if (!selectedAddressId) {
        setOrderMsg(t('cart.selectAddress'));
        return false;
      }
      return true;
    }

    const hasAddressLine = newAddress.streetAddress.trim() || newAddress.text.trim();
    if (!newAddress.name.trim() || !newAddress.phone.trim() || !hasAddressLine) {
      setOrderMsg(t('cart.addressRequired'));
      return false;
    }

    if (!Number.isFinite(Number(newAddress.lat)) || !Number.isFinite(Number(newAddress.lng))) {
      setOrderMsg(t('cart.mapPinRequired'));
      return false;
    }

    return true;
  };



  const selectedSavedAddress = savedAddresses.find((a) => a.id === selectedAddressId);



  const handleCartToggle = () => {

    if (open) {

      setOpen(false);

      return;

    }

    requireCustomer(() => setOpen(true));

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

      if (!validateDeliveryAddress()) return;

    }

    if (checkoutStep === 2) {

      if (!form.payment_mode) {

        setOrderMsg(t('cart.selectPayment'));

        return;

      }

      if (isCodPayment(form.payment_mode) && !isLahoreCity(effectiveCity)) {

        setOrderMsg(t('cart.codOutsideLahore'));

        return;

      }

    }

    setCheckoutStep((s) => Math.min(s + 1, 3));

  };



  const submitOrder = async (e) => {

    e.preventDefault();

    if (!isCustomer) {

      requireCustomer();

      return;

    }

    if (!form.customer_name.trim() || !form.phone.trim()) {

      setOrderMsg(t('cart.namePhoneRequired'));

      return;

    }

    if (!validateDeliveryAddress()) return;

    if (isCodPayment(form.payment_mode) && !isLahoreCity(effectiveCity)) {
      setOrderMsg(t('cart.codOutsideLahore'));
      return;
    }

    setSubmitting(true);

    setOrderMsg('');

    try {

      const payload = {

        ...form,

        city: isPickup ? 'Lahore' : form.city,

        fulfillment_method: fulfillment,

        items: items.map((i) => ({

          product_id: i.id,

          name: i.name,

          qty: i.qty,

          price: getSalePrice(i),

        })),

      };

      if (fulfillment === 'delivery') {
        if (addressMode === 'saved') {
          payload.address_id = selectedAddressId;
        } else {
          payload.shipping_address = newAddress;
        }
      }

      const { order } = await api.placeOrder(payload);

      setSuccessPhone(form.phone.trim());

      setOrderSuccess(order);

      clearCart();

      resetCheckout();

      setFulfillment('delivery');

      setForm({ customer_name: '', phone: '', city: 'Lahore', payment_mode: 'jazzcash', notes: '' });

    } catch (err) {

      setOrderMsg(err.status === 409 ? (err.message || t('cart.insufficientStock')) : err.message);

    } finally {

      setSubmitting(false);

    }

  };



  const dismissSuccess = () => {

    setOrderSuccess(null);

    setSuccessPhone('');

    setOpen(false);

  };



  const paymentLabel = (id) => t(`cart.${id}`);



  const paymentDesc = (id) => {

    const key = `cart.${id}Desc`;

    const label = t(key);

    return label === key ? '' : label;

  };



  return (

    <>

      <motion.button

        type="button"

        className="floating-cart-trigger"

        data-cart-target

        data-magnetic

        onClick={handleCartToggle}

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

              transition={{ duration: 0.18, ease: 'easeOut' }}

              onClick={() => {
                if (orderSuccess) return;
                setOpen(false);
              }}

            />

            <motion.aside

              className={`floating-cart-panel${orderSuccess ? ' floating-cart-panel--order-success' : ''}`}

              initial={{ x: '100%' }}

              animate={{ x: 0 }}

              exit={{ x: '100%' }}

              transition={{ type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] }}

            >

              <div className="floating-cart-head">

                <h2>{orderSuccess ? t('orderSuccess.title') : checkoutOpen ? t('cart.checkoutTitle') : t('cart.yourCart')}</h2>

                <button
                  type="button"
                  className="floating-cart-close"
                  onClick={() => {
                    if (orderSuccess) {
                      dismissSuccess();
                      return;
                    }
                    setOpen(false);
                  }}
                  aria-label={t('cart.closeCart')}
                >
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

                        <div className="checkout-fulfillment-mode" role="radiogroup" aria-label={t('cart.fulfillmentLabel')}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={!isPickup}
                            className={`btn btn-outline btn-sm${fulfillment === 'delivery' ? ' active' : ''}`}
                            onClick={() => setFulfillment('delivery')}
                          >
                            {t('cart.fulfillmentDelivery')}
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={isPickup}
                            className={`btn btn-outline btn-sm${fulfillment === 'pickup' ? ' active' : ''}`}
                            onClick={() => {
                              setFulfillment('pickup');
                              setForm((f) => ({ ...f, city: 'Lahore' }));
                            }}
                          >
                            {t('cart.fulfillmentPickup')}
                          </button>
                        </div>
                        {isPickup ? (
                          <p className="checkout-delivery-fee-note">{t('cart.pickupHint')}</p>
                        ) : null}

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

                        {!isPickup ? (
                          <>
                        <label className="checkout-field-label">{t('cart.cityLabel')}</label>

                        <select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>

                          {CITIES.map((c) => (

                            <option key={c} value={c}>{c}</option>

                          ))}

                          <option value="Other">{t('cart.cityOther')}</option>

                        </select>
                          </>
                        ) : (
                          <p className="checkout-field-label">{t('cart.cityLabel')}: Lahore</p>
                        )}

                        <div className="checkout-city-banner checkout-city-banner--advance">

                          <span className="checkout-city-banner-icon">💳</span>

                          <p className="checkout-city-banner-text">{t('cart.advancePaymentHint')}</p>

                        </div>

                        {!isPickup && isPostExDelivery(deliverySettings) && (
                          <p className="checkout-delivery-fee-note">
                            {t('cart.postexDeliveryNote')}
                          </p>
                        )}
                        {!isPickup && !isPostExDelivery(deliverySettings) && lahore && estimatedDeliveryFee != null && (
                          <p className="checkout-delivery-fee-note">
                            {t('cart.estimatedDeliveryFee')}: <strong>{formatPrice(estimatedDeliveryFee)}</strong>
                            {' — '}
                            {t('cart.deliveryFeeConfirmNote')}
                          </p>
                        )}
                        {!isPickup && !isPostExDelivery(deliverySettings) && !lahore && (
                          <p className="checkout-delivery-fee-note">
                            {deliverySettings.outside_note || t('cart.deliveryFeeOtherCity')}
                          </p>
                        )}
                        {isPickup && (
                          <p className="checkout-delivery-fee-note">{t('cart.pickupFeeNote')}</p>
                        )}

                        <textarea

                          className="checkout-notes"

                          placeholder={t('cart.orderNotes')}

                          value={form.notes}

                          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}

                          rows={2}

                        />

                        {!isPickup ? (
                        <div className="checkout-address-section">

                          <h4 className="checkout-section-subtitle">{t('cart.deliveryAddress')}</h4>

                          {savedAddresses.length > 0 && (

                            <div className="checkout-address-mode">

                              <button

                                type="button"

                                className={`btn btn-outline btn-sm${addressMode === 'saved' ? ' active' : ''}`}

                                onClick={() => setAddressMode('saved')}

                              >

                                {t('cart.useSavedAddress')}

                              </button>

                              <button

                                type="button"

                                className={`btn btn-outline btn-sm${addressMode === 'new' ? ' active' : ''}`}

                                onClick={() => setAddressMode('new')}

                              >

                                {t('cart.newAddress')}

                              </button>

                            </div>

                          )}

                          {addressMode === 'saved' && savedAddresses.length > 0 ? (

                            <div className="checkout-saved-addresses">

                              {savedAddresses.map((addr) => (

                                <label key={addr.id} className={`checkout-address-card${selectedAddressId === addr.id ? ' selected' : ''}`}>

                                  <input

                                    type="radio"

                                    name="checkout-address"

                                    checked={selectedAddressId === addr.id}

                                    onChange={() => setSelectedAddressId(addr.id)}

                                  />

                                  <span>

                                    <strong>{addr.name}</strong> · {addr.phone}

                                    <small>{displayAddressLine(addr)}</small>

                                  </span>

                                </label>

                              ))}

                            </div>

                          ) : (

                            <>

                              <input

                                placeholder={t('address.namePh')}

                                value={newAddress.name}

                                onChange={(e) => setNewAddress((a) => ({ ...a, name: e.target.value }))}

                              />

                              <input

                                placeholder={t('address.phonePh')}

                                value={newAddress.phone}

                                onChange={(e) => setNewAddress((a) => ({ ...a, phone: e.target.value }))}

                              />

                              {addressSettings.addressStructuredFormEnabled ? (
                                <div className="checkout-address-grid">
                                  <input
                                    placeholder={t('address.countryLabel')}
                                    value={newAddress.country}
                                    onChange={(e) => setNewAddress((a) => ({ ...a, country: e.target.value }))}
                                  />
                                  <input
                                    placeholder={t('address.regionPh')}
                                    value={newAddress.region}
                                    onChange={(e) => setNewAddress((a) => ({ ...a, region: e.target.value }))}
                                  />
                                  <input
                                    placeholder={t('address.cityPh')}
                                    value={newAddress.city}
                                    onChange={(e) => setNewAddress((a) => ({ ...a, city: e.target.value }))}
                                  />
                                  <input
                                    placeholder={t('address.postalCodePh')}
                                    value={newAddress.postalCode}
                                    onChange={(e) => setNewAddress((a) => ({ ...a, postalCode: e.target.value }))}
                                  />
                                  <input
                                    className="checkout-address-wide"
                                    placeholder={t('address.streetPh')}
                                    value={newAddress.streetAddress}
                                    onChange={(e) => setNewAddress((a) => ({ ...a, streetAddress: e.target.value }))}
                                  />
                                  <input
                                    placeholder={t('address.housePh')}
                                    value={newAddress.houseNumber}
                                    onChange={(e) => setNewAddress((a) => ({ ...a, houseNumber: e.target.value }))}
                                  />
                                  <input
                                    placeholder={t('address.landmarkPh')}
                                    value={newAddress.landmark}
                                    onChange={(e) => setNewAddress((a) => ({ ...a, landmark: e.target.value }))}
                                  />
                                  <textarea
                                    className="checkout-address-wide"
                                    placeholder={t('address.notesPh')}
                                    value={newAddress.notes}
                                    onChange={(e) => setNewAddress((a) => ({ ...a, notes: e.target.value }))}
                                    rows={2}
                                  />
                                </div>
                              ) : (
                                <textarea
                                  placeholder={t('address.textPh')}
                                  value={newAddress.text}
                                  onChange={(e) => setNewAddress((a) => ({ ...a, text: e.target.value }))}
                                  rows={2}
                                />
                              )}


                              {addressSettings.addressMapPickerEnabled && (
                                <MapAddressPicker
                                  lat={newAddress.lat}
                                  lng={newAddress.lng}
                                  onChange={({ lat, lng }) => setNewAddress((a) => ({ ...a, lat, lng }))}
                                  previewHeight={140}
                                />
                              )}

                            </>

                          )}

                        </div>
                        ) : null}

                      </section>

                    )}



                    {checkoutStep === 2 && (

                      <section className="checkout-section">

                        <h3 className="checkout-section-title">{t('cart.paymentTitle')}</h3>

                        <p className="checkout-payment-note">
                          {isCod ? t('cart.codPaymentHint') : t('cart.advancePaymentHint')}
                        </p>

                        {!lahore && activePaymentIds.includes('cod') && (
                          <p className="checkout-payment-note checkout-payment-note--muted">{t('cart.codOutsideLahore')}</p>
                        )}

                        <div className="checkout-payment-grid" role="radiogroup" aria-label={t('cart.paymentTitle')}>

                          {checkoutPaymentMethods.map(({ id, icon, brandClass }) => {

                            const selected = form.payment_mode === id;

                            const desc = paymentDesc(id);

                            return (

                              <button

                                key={id}

                                type="button"

                                role="radio"

                                aria-checked={selected}

                                className={`checkout-payment-card${brandClass ? ` ${brandClass}` : ''}${selected ? ' checkout-payment-card--selected' : ''}`}

                                onClick={() => setForm((f) => ({ ...f, payment_mode: id }))}

                              >

                                <span className="checkout-payment-icon">{icon}</span>

                                <span className="checkout-payment-name">{paymentLabel(id)}</span>

                                {desc && <span className="checkout-payment-desc">{desc}</span>}

                              </button>

                            );

                          })}

                        </div>

                        {showWalletInstructions && (

                          <PaymentInstructions t={t} amount={formatPrice(total)} paymentMode={form.payment_mode} settings={paymentSettings} />

                        )}

                        {isCod && (
                          <div className="checkout-payment-instructions glass-card">
                            <h4 className="checkout-payment-instructions-title">{t('cart.cod')}</h4>
                            <p className="checkout-payment-note" style={{ marginBottom: 0 }}>{t('cart.codPaymentHint')}</p>
                          </div>
                        )}

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

                          <div className="checkout-summary-row">

                            <span>{t('cart.subtotal')}</span>

                            <strong>{formatPrice(total)}</strong>

                          </div>

                          {isPostExDelivery(deliverySettings) && !isPickup ? (
                            <p className="checkout-delivery-fee-note">{t('cart.postexDeliveryNote')}</p>
                          ) : estimatedDeliveryFee != null && !isPickup ? (
                            <div className="checkout-summary-row">
                              <span>{t('cart.estimatedDeliveryFee')}</span>
                              <strong>{formatPrice(estimatedDeliveryFee)}</strong>
                            </div>
                          ) : isPickup ? (
                            <div className="checkout-summary-row">
                              <span>{t('cart.fulfillmentPickup')}</span>
                              <strong>{t('cart.pickupFeeNote')}</strong>
                            </div>
                          ) : (
                            <p className="checkout-delivery-fee-note">
                              {deliverySettings.outside_note || t('cart.deliveryFeeOtherCity')}
                            </p>
                          )}

                          <div className="checkout-summary-row checkout-summary-total">

                            <span>{t('cart.total')}</span>

                            <strong>
                              {formatPrice(
                                total +
                                  (isPickup || isPostExDelivery(deliverySettings)
                                    ? 0
                                    : estimatedDeliveryFee || 0),
                              )}
                              {!isPickup && !isPostExDelivery(deliverySettings) && estimatedDeliveryFee != null ? '*' : ''}
                            </strong>

                          </div>

                          {!isPickup && !isPostExDelivery(deliverySettings) && estimatedDeliveryFee != null && (
                            <p className="checkout-delivery-fee-note">{t('cart.deliveryFeeConfirmNote')}</p>
                          )}

                        </div>

                        <div className="checkout-summary-meta">

                          <p>
                            <span>{isPickup ? t('cart.pickupFor') : t('cart.deliverTo')}</span>{' '}
                            <strong>{form.customer_name}</strong>, {effectiveCity}
                          </p>

                          <p><span>{t('cart.phone')}</span> <strong>{form.phone}</strong></p>

                          {isPickup ? (
                            <p><span>{t('cart.fulfillmentPickup')}</span> {SHOP.addressLine1}, {SHOP.addressLine2}</p>
                          ) : addressMode === 'saved' && selectedSavedAddress ? (

                            <p><span>{t('cart.deliveryAddress')}</span> {selectedSavedAddress.text}</p>

                          ) : (

                            <p><span>{t('cart.deliveryAddress')}</span> {newAddress.text}</p>

                          )}

                          <p><span>{t('cart.payVia')}</span> <strong>{paymentLabel(form.payment_mode)}</strong></p>

                          {form.notes && <p><span>{t('cart.orderNotes')}</span> {form.notes}</p>}

                        </div>

                        {showWalletInstructions && (

                          <>

                            <p className="checkout-payment-reminder">{t('cart.paymentAfterPlace')}</p>

                            <PaymentInstructions t={t} amount={formatPrice(total)} paymentMode={form.payment_mode} settings={paymentSettings} />

                          </>

                        )}

                        {isCod && (
                          <p className="checkout-payment-reminder">{t('cart.codPaymentHint')}</p>
                        )}

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

                        initial={{ opacity: 0 }}

                        animate={{ opacity: 1 }}

                        transition={{ duration: 0.16, ease: 'easeOut' }}

                      >

                        <img src={item.image} alt={item.name} loading="lazy" />

                        <div className="floating-cart-item-body">

                          <strong>{item.name}</strong>

                          <ProductPrice product={item} size="sm" />

                          <div className="floating-cart-qty">

                            <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} disabled={item.qty <= 1}>−</button>

                            <span>{item.qty}</span>

                            <button type="button" onClick={() => updateQty(item.id, item.qty + 1)} disabled={item.qty >= maxCartQty(item)}>+</button>

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

      <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />

      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />

    </>

  );

}


