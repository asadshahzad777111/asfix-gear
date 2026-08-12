import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTranslation } from '../context/LanguageContext';
import { ADVANCE_PAYMENT_MODES, enabledPaymentMethods, isCodPayment, mergePaymentSettings } from '../config/payments';
import { SHOP } from '../config/shop';
import {
  getEstimatedDeliveryFee,
  isLahoreCity,
  isPostExDelivery,
  mergeDeliverySettings,
} from '../config/delivery';
import { mergeAddressSettings } from '../config/addressSettings';
import { displayAddressLine } from '../utils/address';
import { getSalePrice } from '../utils/pricing';
import { maxCartQty } from '../utils/stock';
import OrderSuccessPanel from '../components/OrderSuccessPanel';
import PaymentInstructions from '../components/PaymentInstructions';
import MapAddressPicker from '../components/MapAddressPicker';
import ShopLoginPrompt from '../components/ShopLoginPrompt';
import CustomerLoginModal from '../components/CustomerLoginModal';
import { useShopGate } from '../hooks/useShopGate';
import './checkout-page.css';

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan'];

const PAYMENT_METHODS = [
  { id: 'jazzcash', icon: '📱' },
  { id: 'easypaisa', icon: '💳' },
  { id: 'bank', icon: '🏦' },
  { id: 'cod', icon: '💵' },
  { id: 'safepay', icon: '🔐' },
  { id: 'payfast', icon: '🔒' },
];

const WALLET_MODES = new Set(['jazzcash', 'easypaisa', 'bank']);

function deliveryWindowLabel() {
  const start = new Date();
  start.setDate(start.getDate() + 2);
  const end = new Date();
  end.setDate(end.getDate() + 4);
  const fmt = (d) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(start)}–${fmt(end)}`;
}

export default function Checkout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isCustomer } = useAuth();
  const { items, updateQty, removeItem, clearCart, count } = useCart();
  const {
    requireCustomer,
    promptOpen,
    closePrompt,
    openLoginFromPrompt,
    loginOpen,
    setLoginOpen,
  } = useShopGate();

  const [paymentSettings, setPaymentSettings] = useState(() => mergePaymentSettings());
  const [deliverySettings, setDeliverySettings] = useState(() => mergeDeliverySettings());
  const [addressSettings, setAddressSettings] = useState(() => mergeAddressSettings());
  const [fulfillment, setFulfillment] = useState('delivery');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressMode, setAddressMode] = useState('saved');
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [successPhone, setSuccessPhone] = useState('');
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
    payment_mode: 'cod',
    notes: '',
  });

  const listSubtotal = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.price) || 0) * i.qty, 0),
    [items]
  );
  const merchandiseSubtotal = useMemo(
    () => items.reduce((sum, i) => sum + getSalePrice(i) * i.qty, 0),
    [items]
  );
  const discountAmount = Math.max(0, listSubtotal - merchandiseSubtotal);
  const isPickup = fulfillment === 'pickup';
  const effectiveCity = isPickup ? 'Lahore' : form.city;
  const lahore = isLahoreCity(effectiveCity);
  const estimatedDeliveryFee = isPickup ? 0 : getEstimatedDeliveryFee(form.city, deliverySettings);
  const shippingFee = estimatedDeliveryFee == null ? 0 : estimatedDeliveryFee;
  const shippingPending = !isPickup && estimatedDeliveryFee == null;
  const otherFees = 0;
  const grandTotal = merchandiseSubtotal + shippingFee + otherFees;

  const activePaymentIds = enabledPaymentMethods(paymentSettings);
  const checkoutPaymentMethods = PAYMENT_METHODS.filter(({ id }) => {
    if (!activePaymentIds.includes(id)) return false;
    if (id === 'cod' && !lahore) return false;
    return true;
  });
  const isCod = isCodPayment(form.payment_mode);
  const isAdvance = ADVANCE_PAYMENT_MODES.has(form.payment_mode);
  const showWalletInstructions = WALLET_MODES.has(form.payment_mode);
  const selectedSavedAddress = savedAddresses.find((a) => a.id === selectedAddressId);

  useEffect(() => {
    document.body.classList.add('checkout-page-open');
    return () => document.body.classList.remove('checkout-page-open');
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getPaymentSettings().catch(() => null),
      api.getDeliverySettings().catch(() => null),
      api.getAddressSettings().catch(() => null),
    ]).then(([pay, del, addr]) => {
      if (cancelled) return;
      if (pay) setPaymentSettings(mergePaymentSettings(pay));
      if (del) setDeliverySettings(mergeDeliverySettings(del));
      if (addr) setAddressSettings(mergeAddressSettings(addr));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (defaultAddr.city) {
          setForm((prev) => ({ ...prev, city: defaultAddr.city }));
        }
      } else {
        setAddressMode('new');
        setEditingAddress(true);
      }
    } catch {
      setSavedAddresses([]);
      setAddressMode('new');
      setEditingAddress(true);
    }
  }, [isCustomer]);

  useEffect(() => {
    if (isCustomer) void loadSavedAddresses();
  }, [isCustomer, loadSavedAddresses]);

  useEffect(() => {
    const ids = checkoutPaymentMethods.map((m) => m.id);
    if (!ids.includes(form.payment_mode) && ids[0]) {
      setForm((prev) => ({ ...prev, payment_mode: ids[0] }));
    }
  }, [form.city, form.payment_mode, fulfillment, activePaymentIds.join(',')]);

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

  const submitOrder = async () => {
    if (!isCustomer) {
      requireCustomer();
      return;
    }
    if (!items.length) {
      setOrderMsg(t('cart.empty'));
      return;
    }
    if (!form.customer_name.trim() || !form.phone.trim()) {
      setOrderMsg(t('cart.namePhoneRequired'));
      setEditingAddress(true);
      return;
    }
    if (!validateDeliveryAddress()) {
      setEditingAddress(true);
      return;
    }
    if (isCodPayment(form.payment_mode) && !isLahoreCity(effectiveCity)) {
      setOrderMsg(t('cart.codOutsideLahore'));
      return;
    }
    if (!form.payment_mode) {
      setOrderMsg(t('cart.selectPayment'));
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
    } catch (err) {
      setOrderMsg(err.message || t('cart.namePhoneRequired'));
    } finally {
      setSubmitting(false);
    }
  };

  const displayName =
    addressMode === 'saved' && selectedSavedAddress
      ? selectedSavedAddress.name || form.customer_name
      : newAddress.name || form.customer_name;
  const displayPhone =
    addressMode === 'saved' && selectedSavedAddress
      ? selectedSavedAddress.phone || form.phone
      : newAddress.phone || form.phone;
  const displayLine =
    fulfillment === 'pickup'
      ? `${SHOP.addressLine1}, ${SHOP.addressLine2}`
      : addressMode === 'saved' && selectedSavedAddress
        ? displayAddressLine(selectedSavedAddress)
        : displayAddressLine(newAddress) || form.city;

  const ctaLabel = submitting
    ? t('cart.placing')
    : isCod
      ? t('cart.placeOrder')
      : t('checkout.proceedToPay');

  if (orderSuccess) {
    return (
      <div className="checkout-page">
        <div className="checkout-page__inner checkout-page__inner--success">
          <OrderSuccessPanel
            order={orderSuccess}
            phone={successPhone}
            onDone={() => navigate('/account')}
          />
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="checkout-page">
        <div className="checkout-page__inner checkout-page__empty">
          <button type="button" className="checkout-back" onClick={() => navigate(-1)} aria-label={t('nav.back')}>
            ←
          </button>
          <p>{t('cart.empty')}</p>
          <Link to="/shop" className="btn btn-primary">
            {t('nav.shop')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-page__inner">
        <header className="checkout-topbar">
          <button type="button" className="checkout-back" onClick={() => navigate(-1)} aria-label={t('nav.back')}>
            ←
          </button>
          <div className="checkout-trust">
            <span className="checkout-trust__icon" aria-hidden>
              👍
            </span>
            <span>{t('checkout.trustBadge')}</span>
          </div>
        </header>

        {/* Address */}
        <section className="checkout-block checkout-address">
          <div className="checkout-address__head">
            <span className="checkout-pin" aria-hidden>
              📍
            </span>
            <div className="checkout-address__meta">
              <strong>
                {displayName || t('cart.fullName')}
                {displayPhone ? `, ${displayPhone}` : ''}
              </strong>
              <button
                type="button"
                className="checkout-edit"
                onClick={() => {
                  setEditingAddress((v) => !v);
                  requireCustomer(() => {});
                }}
              >
                {t('checkout.edit')}
              </button>
            </div>
          </div>
          <div className="checkout-address__line">
            {fulfillment === 'pickup' ? (
              <span className="checkout-badge">{t('cart.fulfillmentPickup')}</span>
            ) : (
              <span className="checkout-badge">{t('checkout.homeBadge')}</span>
            )}
            <span>{displayLine || t('cart.deliveryAddress')}</span>
          </div>

          {editingAddress ? (
            <div className="checkout-address__editor">
              <div className="checkout-fulfillment" role="radiogroup" aria-label={t('cart.fulfillmentLabel')}>
                <button
                  type="button"
                  className={fulfillment === 'delivery' ? 'is-active' : ''}
                  onClick={() => setFulfillment('delivery')}
                >
                  {t('cart.fulfillmentDelivery')}
                </button>
                <button
                  type="button"
                  className={fulfillment === 'pickup' ? 'is-active' : ''}
                  onClick={() => {
                    setFulfillment('pickup');
                    setForm((p) => ({ ...p, city: 'Lahore' }));
                  }}
                >
                  {t('cart.fulfillmentPickup')}
                </button>
              </div>

              <div className="checkout-fields">
                <label>
                  {t('cart.fullName')}
                  <input
                    value={form.customer_name}
                    onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
                    maxLength={120}
                  />
                </label>
                <label>
                  {t('cart.phone')}
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    maxLength={20}
                  />
                </label>
              </div>

              {!isPickup ? (
                <>
                  <label className="checkout-city">
                    {t('cart.cityLabel')}
                    <select
                      value={CITIES.includes(form.city) ? form.city : 'Other'}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((p) => ({ ...p, city: v === 'Other' ? '' : v }));
                      }}
                    >
                      {CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="Other">{t('cart.cityOther')}</option>
                    </select>
                  </label>
                  {!CITIES.includes(form.city) ? (
                    <input
                      className="checkout-city-other"
                      placeholder={t('cart.cityOther')}
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    />
                  ) : null}

                  {savedAddresses.length > 0 ? (
                    <div className="checkout-addr-mode">
                      <button
                        type="button"
                        className={addressMode === 'saved' ? 'is-active' : ''}
                        onClick={() => setAddressMode('saved')}
                      >
                        {t('cart.useSavedAddress')}
                      </button>
                      <button
                        type="button"
                        className={addressMode === 'new' ? 'is-active' : ''}
                        onClick={() => setAddressMode('new')}
                      >
                        {t('cart.newAddress')}
                      </button>
                    </div>
                  ) : null}

                  {addressMode === 'saved' && savedAddresses.length > 0 ? (
                    <div className="checkout-saved-list">
                      {savedAddresses.map((addr) => (
                        <label key={addr.id} className={`checkout-saved-card${selectedAddressId === addr.id ? ' is-selected' : ''}`}>
                          <input
                            type="radio"
                            name="checkout-addr"
                            checked={selectedAddressId === addr.id}
                            onChange={() => {
                              setSelectedAddressId(addr.id);
                              if (addr.city) setForm((p) => ({ ...p, city: addr.city }));
                            }}
                          />
                          <span>
                            <strong>{addr.name}</strong>
                            <small>{displayAddressLine(addr)}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="checkout-new-addr">
                      <input
                        placeholder={t('addresses.streetLabel')}
                        value={newAddress.streetAddress}
                        onChange={(e) => setNewAddress((p) => ({ ...p, streetAddress: e.target.value }))}
                      />
                      <input
                        placeholder={t('addresses.houseLabel')}
                        value={newAddress.houseNumber}
                        onChange={(e) => setNewAddress((p) => ({ ...p, houseNumber: e.target.value }))}
                      />
                      {addressSettings?.addressMapPickerEnabled !== false ? (
                        <MapAddressPicker
                          lat={newAddress.lat}
                          lng={newAddress.lng}
                          onChange={({ lat, lng }) => setNewAddress((p) => ({ ...p, lat, lng }))}
                          previewHeight={140}
                        />
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <p className="checkout-pickup-hint">{t('cart.pickupHint')}</p>
              )}

              <label className="checkout-notes">
                {t('cart.orderNotes')}
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  maxLength={500}
                />
              </label>
            </div>
          ) : null}
        </section>

        {/* Products */}
        <section className="checkout-block checkout-products">
          <div className="checkout-shop-row">
            <span aria-hidden>🏪</span>
            <strong>{SHOP.name}</strong>
          </div>
          <ul className="checkout-item-list">
            {items.map((item) => {
              const sale = getSalePrice(item);
              const limit = maxCartQty(item);
              return (
                <li key={item.id} className="checkout-item">
                  <img src={item.image} alt="" loading="lazy" />
                  <div className="checkout-item__body">
                    <strong>{item.name}</strong>
                    <span className="checkout-item__meta">
                      {[item.brand, item.category].filter(Boolean).join(' · ') || 'AsFix & Gear'}
                    </span>
                    <div className="checkout-item__row">
                      <span className="checkout-item__price">{formatPrice(sale)}</span>
                      <div className="checkout-qty">
                        <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} aria-label="-">
                          −
                        </button>
                        <span>{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          disabled={item.qty >= limit}
                          aria-label="+"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button type="button" className="checkout-item__remove" onClick={() => removeItem(item.id)}>
                      {t('cart.remove')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {!isPickup ? (
            <div className="checkout-ship-row">
              <div>
                <strong>
                  {shippingPending
                    ? t('checkout.deliveryConfirmSoon')
                    : t('checkout.guaranteedBy', { window: deliveryWindowLabel() })}
                </strong>
                {isPostExDelivery(deliverySettings) ? (
                  <small>{t('cart.postexDeliveryNote')}</small>
                ) : null}
              </div>
              <span>
                {shippingPending ? t('checkout.feeTbd') : formatPrice(shippingFee)}
              </span>
            </div>
          ) : (
            <div className="checkout-ship-row">
              <strong>{t('cart.pickupFeeNote')}</strong>
              <span>{formatPrice(0)}</span>
            </div>
          )}
        </section>

        {/* Payment */}
        <section className="checkout-block checkout-payment">
          <h2>{t('cart.paymentTitle')}</h2>
          <div className="checkout-pay-grid">
            {checkoutPaymentMethods.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`checkout-pay-card${form.payment_mode === m.id ? ' is-selected' : ''}${m.id === 'cod' ? ' checkout-pay-card--cod' : ''}${m.id === 'safepay' ? ' checkout-pay-card--safepay' : ''}`}
                onClick={() => setForm((p) => ({ ...p, payment_mode: m.id }))}
              >
                <span className="checkout-pay-card__icon">{m.icon}</span>
                <span className="checkout-pay-card__label">{t(`cart.${m.id}`)}</span>
                {m.id === 'cod' ? <small>{t('cart.codDesc')}</small> : null}
                {m.id === 'safepay' ? <small>{t('cart.safepayDesc')}</small> : null}
              </button>
            ))}
          </div>
          {isCod ? (
            <p className="checkout-pay-hint">
              {isPickup ? t('cart.codPickupHint') : t('cart.codPaymentHint')}
            </p>
          ) : null}
          {isAdvance ? <p className="checkout-pay-hint">{t('cart.advancePaymentHint')}</p> : null}
          {form.payment_mode === 'safepay' ? (
            <p className="checkout-pay-hint checkout-pay-hint--safepay">{t('cart.safepayCheckoutHint')}</p>
          ) : null}
          {showWalletInstructions ? (
            <PaymentInstructions mode={form.payment_mode} settings={paymentSettings} amount={grandTotal} />
          ) : null}
        </section>

        {/* Order summary */}
        <section className="checkout-block checkout-summary">
          <h2>{t('cart.orderSummary')}</h2>
          <div className="checkout-summary__row">
            <span>{t('checkout.merchandiseSubtotal')}</span>
            <span>{formatPrice(merchandiseSubtotal)}</span>
          </div>
          <div className="checkout-summary__row checkout-summary__row--discount">
            <span>{t('checkout.discount')}</span>
            <span>{formatPrice(discountAmount)}</span>
          </div>
          <div className="checkout-summary__row checkout-summary__row--voucher">
            <span>
              <span aria-hidden>🎟️</span> {t('checkout.voucher')}
            </span>
            <span className="checkout-voucher-soon">{t('checkout.voucherSoon')}</span>
          </div>
          <div className="checkout-summary__row">
            <span>{t('checkout.shippingFeeTotal')}</span>
            <span>{shippingPending ? t('checkout.feeTbd') : formatPrice(shippingFee)}</span>
          </div>
          <div className="checkout-summary__row">
            <span>{t('checkout.otherFees')}</span>
            <span>{formatPrice(otherFees)}</span>
          </div>
          <div className="checkout-summary__row checkout-summary__row--total">
            <span>{t('cart.total')}</span>
            <span>{formatPrice(grandTotal)}</span>
          </div>
          {count > 0 ? (
            <p className="checkout-summary__count">{t('cart.itemsCount', { count })}</p>
          ) : null}
        </section>

        {orderMsg ? <p className="checkout-error">{orderMsg}</p> : null}

        <div className="checkout-sticky-space" aria-hidden />
      </div>

      <div className="checkout-sticky">
        {summaryOpen ? (
          <div className="checkout-sticky__expand">
            <div className="checkout-summary__row">
              <span>{t('checkout.merchandiseSubtotal')}</span>
              <span>{formatPrice(merchandiseSubtotal)}</span>
            </div>
            <div className="checkout-summary__row checkout-summary__row--discount">
              <span>{t('checkout.discount')}</span>
              <span>{formatPrice(discountAmount)}</span>
            </div>
            <div className="checkout-summary__row">
              <span>{t('checkout.shippingFeeTotal')}</span>
              <span>{shippingPending ? t('checkout.feeTbd') : formatPrice(shippingFee)}</span>
            </div>
            <div className="checkout-summary__row">
              <span>{t('checkout.otherFees')}</span>
              <span>{formatPrice(otherFees)}</span>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="checkout-sticky__toggle"
          onClick={() => setSummaryOpen((v) => !v)}
          aria-expanded={summaryOpen}
        >
          {summaryOpen ? '▾' : '▴'} {t('cart.orderSummary')}
        </button>
        <button
          type="button"
          className="checkout-sticky__cta"
          disabled={submitting}
          onClick={() => requireCustomer(() => void submitOrder())}
        >
          <span>{ctaLabel}</span>
          <span>{formatPrice(grandTotal)}</span>
        </button>
      </div>

      <ShopLoginPrompt open={promptOpen} onClose={closePrompt} onSignIn={openLoginFromPrompt} />
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
