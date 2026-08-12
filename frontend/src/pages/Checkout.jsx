import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTranslation } from '../context/LanguageContext';
import { enabledPaymentMethods, isCodPayment, mergePaymentSettings } from '../config/payments';
import { SHOP } from '../config/shop';
import {
  getEstimatedDeliveryFee,
  isLahoreCity,
  isPostExDelivery,
  mergeDeliverySettings,
} from '../config/delivery';
import { displayAddressLine } from '../utils/address';
import { getSalePrice } from '../utils/pricing';
import { maxCartQty } from '../utils/stock';
import OrderSuccessPanel from '../components/OrderSuccessPanel';
import ShopLoginPrompt from '../components/ShopLoginPrompt';
import CustomerLoginModal from '../components/CustomerLoginModal';
import { useShopGate } from '../hooks/useShopGate';
import './checkout-page.css';

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan'];

const PRIMARY_PAY = [
  { id: 'cod', icon: '💵' },
  { id: 'safepay', icon: '🔐', logos: 'Visa · Mastercard' },
];

const OTHER_PAY = [
  { id: 'jazzcash', icon: '📱' },
  { id: 'easypaisa', icon: '💚' },
  { id: 'bank', icon: '🏦' },
];

function splitName(full = '') {
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`ck-field ${className}`.trim()}>
      <span className="ck-field__label">{label}</span>
      {children}
    </label>
  );
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
  const [fulfillment, setFulfillment] = useState('delivery');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressMode, setAddressMode] = useState('new');
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [billingSame, setBillingSame] = useState(true);
  const [showOtherPay, setShowOtherPay] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [successPhone, setSuccessPhone] = useState('');
  const [newsOptIn, setNewsOptIn] = useState(false);

  const [ship, setShip] = useState({
    firstName: '',
    lastName: '',
    country: 'Pakistan',
    streetAddress: '',
    houseNumber: '',
    city: 'Lahore',
    postalCode: '',
    phone: '',
    notes: '',
  });
  const [billing, setBilling] = useState({
    firstName: '',
    lastName: '',
    country: 'Pakistan',
    streetAddress: '',
    houseNumber: '',
    city: 'Lahore',
    postalCode: '',
    phone: '',
  });
  const [paymentMode, setPaymentMode] = useState('cod');

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
  const effectiveCity = isPickup ? 'Lahore' : ship.city;
  const lahore = isLahoreCity(effectiveCity);
  const estimatedDeliveryFee = isPickup ? 0 : getEstimatedDeliveryFee(ship.city, deliverySettings);
  const shippingFee = estimatedDeliveryFee == null ? 0 : estimatedDeliveryFee;
  const shippingPending = !isPickup && estimatedDeliveryFee == null;
  const otherFees = 0;
  const grandTotal = merchandiseSubtotal + shippingFee + otherFees;

  const activePaymentIds = enabledPaymentMethods(paymentSettings);
  const primaryMethods = PRIMARY_PAY.filter(({ id }) => {
    if (!activePaymentIds.includes(id)) return false;
    if (id === 'cod' && !lahore && !isPickup) return false;
    return true;
  });
  const otherMethods = OTHER_PAY.filter(({ id }) => activePaymentIds.includes(id));
  const isCod = isCodPayment(paymentMode);

  useEffect(() => {
    document.body.classList.add('checkout-page-open');
    return () => document.body.classList.remove('checkout-page-open');
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getPaymentSettings().catch(() => null),
      api.getDeliverySettings().catch(() => null),
    ]).then(([pay, del]) => {
      if (cancelled) return;
      if (pay) setPaymentSettings(mergePaymentSettings(pay));
      if (del) setDeliverySettings(mergeDeliverySettings(del));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isCustomer || !user) return;
    const { first, last } = splitName(user.name || '');
    setShip((prev) => ({
      ...prev,
      firstName: prev.firstName || first,
      lastName: prev.lastName || last,
      phone: prev.phone || user.phone || '',
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
        const { first, last } = splitName(defaultAddr.name || '');
        setShip((prev) => ({
          ...prev,
          firstName: first || prev.firstName,
          lastName: last || prev.lastName,
          phone: defaultAddr.phone || prev.phone,
          city: defaultAddr.city || prev.city,
          streetAddress: defaultAddr.streetAddress || prev.streetAddress,
          houseNumber: defaultAddr.houseNumber || prev.houseNumber,
          postalCode: defaultAddr.postalCode || prev.postalCode,
          country: defaultAddr.country || 'Pakistan',
        }));
      } else {
        setAddressMode('new');
      }
    } catch {
      setSavedAddresses([]);
      setAddressMode('new');
    }
  }, [isCustomer]);

  useEffect(() => {
    if (isCustomer) void loadSavedAddresses();
  }, [isCustomer, loadSavedAddresses]);

  useEffect(() => {
    const ids = [...primaryMethods, ...otherMethods].map((m) => m.id);
    if (!ids.includes(paymentMode) && ids[0]) setPaymentMode(ids[0]);
  }, [ship.city, fulfillment, paymentMode, activePaymentIds.join(',')]);

  const fullName = `${ship.firstName} ${ship.lastName}`.trim();

  const validateDeliveryAddress = () => {
    if (fulfillment === 'pickup') return true;
    if (addressMode === 'saved' && selectedAddressId) return true;
    const hasAddressLine = ship.streetAddress.trim() || ship.houseNumber.trim();
    if (!ship.firstName.trim() || !ship.lastName.trim() || !ship.phone.trim() || !hasAddressLine || !ship.city.trim()) {
      setOrderMsg(t('cart.addressRequired'));
      return false;
    }
    if (!billingSame) {
      const billLine = billing.streetAddress.trim() || billing.houseNumber.trim();
      if (!billing.firstName.trim() || !billing.lastName.trim() || !billing.phone.trim() || !billLine) {
        setOrderMsg(t('checkout.billingRequired'));
        return false;
      }
    }
    return true;
  };

  const buildShippingPayload = () => {
    const name = fullName || ship.firstName.trim();
    return {
      name,
      fullName: name,
      phone: ship.phone.trim(),
      country: ship.country || 'Pakistan',
      city: ship.city.trim(),
      postalCode: ship.postalCode.trim(),
      streetAddress: ship.streetAddress.trim(),
      houseNumber: ship.houseNumber.trim(),
      text: [ship.houseNumber, ship.streetAddress, ship.city, ship.postalCode, ship.country]
        .map((p) => String(p || '').trim())
        .filter(Boolean)
        .join(', '),
      lat: SHOP.lat,
      lng: SHOP.lng,
    };
  };

  const submitOrder = async () => {
    if (!isCustomer) {
      requireCustomer(() => void submitOrder());
      return;
    }
    if (!items.length) {
      setOrderMsg(t('cart.empty'));
      return;
    }
    if (!ship.phone.trim() || !fullName) {
      setOrderMsg(t('cart.namePhoneRequired'));
      return;
    }
    if (!validateDeliveryAddress()) return;
    if (isCodPayment(paymentMode) && !isLahoreCity(effectiveCity) && !isPickup) {
      setOrderMsg(t('cart.codOutsideLahore'));
      return;
    }
    if (!paymentMode) {
      setOrderMsg(t('cart.selectPayment'));
      return;
    }

    setSubmitting(true);
    setOrderMsg('');
    try {
      let notes = ship.notes.trim();
      if (!billingSame) {
        const billLine = [
          `${billing.firstName} ${billing.lastName}`.trim(),
          billing.phone,
          billing.houseNumber,
          billing.streetAddress,
          billing.city,
          billing.postalCode,
        ]
          .filter(Boolean)
          .join(', ');
        notes = [notes, `Billing: ${billLine}`].filter(Boolean).join('\n');
      }
      if (newsOptIn) {
        notes = [notes, 'Opt-in: news & offers SMS'].filter(Boolean).join('\n');
      }

      const payload = {
        customer_name: fullName,
        phone: ship.phone.trim(),
        city: isPickup ? 'Lahore' : ship.city.trim(),
        payment_mode: paymentMode,
        notes,
        fulfillment_method: fulfillment,
        items: items.map((i) => ({
          product_id: i.id,
          name: i.name,
          qty: i.qty,
          price: getSalePrice(i),
        })),
      };
      if (fulfillment === 'delivery') {
        if (addressMode === 'saved' && selectedAddressId) {
          payload.address_id = selectedAddressId;
        } else {
          payload.shipping_address = buildShippingPayload();
        }
      }

      const { order } = await api.placeOrder(payload);
      setSuccessPhone(ship.phone.trim());
      setOrderSuccess(order);
      clearCart();
    } catch (err) {
      setOrderMsg(err.message || t('cart.namePhoneRequired'));
    } finally {
      setSubmitting(false);
    }
  };

  const ctaLabel = submitting
    ? t('cart.placing')
    : isCod
      ? t('checkout.completeOrder')
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

  const renderAddressFields = (data, setData, prefix) => (
    <div className="ck-form-grid">
      <Field label={t('checkout.countryRegion')} className="ck-field--full">
        <select
          value={data.country || 'Pakistan'}
          onChange={(e) => setData((p) => ({ ...p, country: e.target.value }))}
        >
          <option value="Pakistan">Pakistan</option>
        </select>
      </Field>
      <Field label={t('checkout.firstName')}>
        <input
          value={data.firstName}
          onChange={(e) => setData((p) => ({ ...p, firstName: e.target.value }))}
          maxLength={60}
          autoComplete={`${prefix} given-name`}
        />
      </Field>
      <Field label={t('checkout.lastName')}>
        <input
          value={data.lastName}
          onChange={(e) => setData((p) => ({ ...p, lastName: e.target.value }))}
          maxLength={60}
          autoComplete={`${prefix} family-name`}
          required
        />
      </Field>
      <Field label={t('checkout.addressLine')} className="ck-field--full">
        <input
          value={data.streetAddress}
          onChange={(e) => setData((p) => ({ ...p, streetAddress: e.target.value }))}
          maxLength={220}
          autoComplete={`${prefix} address-line1`}
        />
      </Field>
      <Field label={t('checkout.apartmentOptional')} className="ck-field--full">
        <input
          value={data.houseNumber}
          onChange={(e) => setData((p) => ({ ...p, houseNumber: e.target.value }))}
          maxLength={80}
          autoComplete={`${prefix} address-line2`}
        />
      </Field>
      <Field label={t('checkout.city')}>
        <select
          value={CITIES.includes(data.city) ? data.city : 'Other'}
          onChange={(e) => {
            const v = e.target.value;
            setData((p) => ({ ...p, city: v === 'Other' ? '' : v }));
          }}
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="Other">{t('cart.cityOther')}</option>
        </select>
      </Field>
      {!CITIES.includes(data.city) ? (
        <Field label={t('cart.cityOther')}>
          <input value={data.city} onChange={(e) => setData((p) => ({ ...p, city: e.target.value }))} />
        </Field>
      ) : (
        <Field label={t('checkout.postalOptional')}>
          <input
            value={data.postalCode}
            onChange={(e) => setData((p) => ({ ...p, postalCode: e.target.value }))}
            maxLength={20}
            autoComplete={`${prefix} postal-code`}
          />
        </Field>
      )}
      {CITIES.includes(data.city) ? null : (
        <Field label={t('checkout.postalOptional')} className="ck-field--full">
          <input
            value={data.postalCode}
            onChange={(e) => setData((p) => ({ ...p, postalCode: e.target.value }))}
            maxLength={20}
          />
        </Field>
      )}
      <Field label={t('checkout.phoneUpdates')} className="ck-field--full">
        <input
          value={data.phone}
          onChange={(e) => setData((p) => ({ ...p, phone: e.target.value }))}
          maxLength={20}
          inputMode="tel"
          autoComplete={`${prefix} tel`}
        />
      </Field>
    </div>
  );

  return (
    <div className="checkout-page checkout-page--shopify">
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

        {/* Delivery / pickup */}
        <section className="checkout-block">
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
                setShip((p) => ({ ...p, city: 'Lahore' }));
              }}
            >
              {t('cart.fulfillmentPickup')}
            </button>
          </div>
          {isPostExDelivery(deliverySettings) && !isPickup ? (
            <p className="ck-ship-note">{t('cart.postexDeliveryNote')}</p>
          ) : null}
        </section>

        {/* Shipping address — phonecase style, no map */}
        {!isPickup ? (
          <section className="checkout-block">
            <h2 className="ck-section-title">{t('checkout.shippingAddress')}</h2>

            {savedAddresses.length > 0 ? (
              <div className="checkout-addr-mode" style={{ marginBottom: '0.75rem' }}>
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
              <Field label={t('checkout.savedAddresses')} className="ck-field--full">
                <select
                  value={selectedAddressId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value) || e.target.value;
                    setSelectedAddressId(id);
                    const addr = savedAddresses.find((a) => a.id === id);
                    if (!addr) return;
                    const { first, last } = splitName(addr.name || '');
                    setShip((prev) => ({
                      ...prev,
                      firstName: first || prev.firstName,
                      lastName: last || prev.lastName,
                      phone: addr.phone || prev.phone,
                      city: addr.city || prev.city,
                      streetAddress: addr.streetAddress || '',
                      houseNumber: addr.houseNumber || '',
                      postalCode: addr.postalCode || '',
                      country: addr.country || 'Pakistan',
                    }));
                  }}
                >
                  {savedAddresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.name} — {displayAddressLine(addr)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {addressMode === 'new' || !savedAddresses.length ? renderAddressFields(ship, setShip, 'shipping') : null}

            <label className="ck-check">
              <input type="checkbox" checked={newsOptIn} onChange={(e) => setNewsOptIn(e.target.checked)} />
              <span>{t('checkout.textNewsOffers')}</span>
            </label>
          </section>
        ) : (
          <section className="checkout-block">
            <h2 className="ck-section-title">{t('cart.fulfillmentPickup')}</h2>
            <p className="checkout-pickup-hint">{t('cart.pickupHint')}</p>
            <div className="ck-form-grid">
              <Field label={t('checkout.firstName')}>
                <input value={ship.firstName} onChange={(e) => setShip((p) => ({ ...p, firstName: e.target.value }))} />
              </Field>
              <Field label={t('checkout.lastName')}>
                <input value={ship.lastName} onChange={(e) => setShip((p) => ({ ...p, lastName: e.target.value }))} />
              </Field>
              <Field label={t('checkout.phoneUpdates')} className="ck-field--full">
                <input value={ship.phone} onChange={(e) => setShip((p) => ({ ...p, phone: e.target.value }))} />
              </Field>
            </div>
          </section>
        )}

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
        </section>

        {/* Payment — phonecase style COD + Safepay */}
        <section className="checkout-block">
          <h2 className="ck-section-title">{t('checkout.paymentHeading')}</h2>
          <p className="ck-secure-line">{t('checkout.paymentSecure')}</p>
          <div className="ck-pay-list" role="radiogroup" aria-label={t('cart.paymentTitle')}>
            {primaryMethods.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`ck-pay-option${paymentMode === m.id ? ' is-selected' : ''}`}
                onClick={() => setPaymentMode(m.id)}
              >
                <span className={`ck-radio${paymentMode === m.id ? ' is-on' : ''}`} aria-hidden />
                <span className="ck-pay-option__body">
                  <strong>
                    {m.icon} {t(`cart.${m.id}`)}
                  </strong>
                  {m.id === 'cod' ? (
                    <small className="ck-pay-cod-box">{t('checkout.codPolicy')}</small>
                  ) : null}
                  {m.id === 'safepay' ? (
                    <small>
                      {t('cart.safepayDesc')}
                      {m.logos ? ` · ${m.logos}` : ''}
                    </small>
                  ) : null}
                </span>
              </button>
            ))}
          </div>

          {otherMethods.length > 0 ? (
            <div className="ck-other-pay">
              <button type="button" className="ck-other-pay__toggle" onClick={() => setShowOtherPay((v) => !v)}>
                {showOtherPay ? '▾' : '▸'} {t('checkout.otherMethods')}
              </button>
              {showOtherPay
                ? otherMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`ck-pay-option${paymentMode === m.id ? ' is-selected' : ''}`}
                      onClick={() => setPaymentMode(m.id)}
                    >
                      <span className={`ck-radio${paymentMode === m.id ? ' is-on' : ''}`} aria-hidden />
                      <span className="ck-pay-option__body">
                        <strong>
                          {m.icon} {t(`cart.${m.id}`)}
                        </strong>
                        <small>{t(`cart.${m.id}Desc`)}</small>
                      </span>
                    </button>
                  ))
                : null}
            </div>
          ) : null}
        </section>

        {/* Billing address */}
        <section className="checkout-block">
          <h2 className="ck-section-title">{t('checkout.billingAddress')}</h2>
          <div className="ck-radio-cards" role="radiogroup">
            <button
              type="button"
              className={`ck-radio-card${billingSame ? ' is-selected' : ''}`}
              onClick={() => setBillingSame(true)}
            >
              <span className={`ck-radio${billingSame ? ' is-on' : ''}`} aria-hidden />
              <span>{t('checkout.billingSame')}</span>
            </button>
            <button
              type="button"
              className={`ck-radio-card${!billingSame ? ' is-selected' : ''}`}
              onClick={() => {
                setBillingSame(false);
                setBilling((prev) => ({
                  ...prev,
                  firstName: prev.firstName || ship.firstName,
                  lastName: prev.lastName || ship.lastName,
                  phone: prev.phone || ship.phone,
                  city: prev.city || ship.city,
                }));
              }}
            >
              <span className={`ck-radio${!billingSame ? ' is-on' : ''}`} aria-hidden />
              <span>{t('checkout.billingDifferent')}</span>
            </button>
          </div>
          {!billingSame ? (
            <div className="ck-billing-fields">{renderAddressFields(billing, setBilling, 'billing')}</div>
          ) : null}
        </section>

        {/* Order summary */}
        <section className="checkout-block checkout-summary">
          <h2 className="ck-section-title">{t('cart.orderSummary')}</h2>
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
            <span>
              {isPickup
                ? formatPrice(0)
                : shippingPending
                  ? t('checkout.feeTbd')
                  : formatPrice(shippingFee)}
            </span>
          </div>
          <div className="checkout-summary__row">
            <span>{t('checkout.otherFees')}</span>
            <span>{formatPrice(otherFees)}</span>
          </div>
          <div className="checkout-summary__row checkout-summary__row--total">
            <span>{t('cart.total')}</span>
            <span>{formatPrice(grandTotal)}</span>
          </div>
          {count > 0 ? <p className="checkout-summary__count">{t('cart.itemsCount', { count })}</p> : null}
        </section>

        <Field label={t('cart.orderNotes')} className="checkout-block ck-field--notes">
          <textarea
            rows={2}
            value={ship.notes}
            onChange={(e) => setShip((p) => ({ ...p, notes: e.target.value }))}
            maxLength={500}
          />
        </Field>

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
            <div className="checkout-summary__row checkout-summary__row--total">
              <span>{t('checkout.totalAmount')}</span>
              <span>{formatPrice(grandTotal)}</span>
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
