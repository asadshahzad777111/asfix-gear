import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { ProductPrice } from '../DiscountPicker';
import { formatPrice } from '../../api/client';
import { getSalePrice } from '../../utils/pricing';
import { maxCartQty } from '../../utils/stock';
import { useTranslation } from '../../context/LanguageContext';
import OrderSuccessPanel from '../OrderSuccessPanel';
import ShopLoginPrompt from '../ShopLoginPrompt';
import CustomerLoginModal from '../CustomerLoginModal';
import { useShopGate } from '../../hooks/useShopGate';

export default function FloatingCart() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const [orderSuccess, setOrderSuccess] = useState(null);
  const [successPhone, setSuccessPhone] = useState('');

  const total = items.reduce((sum, i) => sum + getSalePrice(i) * i.qty, 0);

  useEffect(() => {
    document.body.classList.toggle('cart-open', open);
    return () => document.body.classList.remove('cart-open');
  }, [open]);

  const startCheckout = () => {
    requireCustomer(() => {
      setOpen(false);
      navigate('/checkout');
    });
  };

  // Order Now → dedicated Lazada-style checkout page
  useEffect(() => {
    if (!checkoutIntent || items.length === 0 || orderSuccess) return;
    clearCheckoutIntent?.();
    requireCustomer(() => {
      setOpen(false);
      navigate('/checkout');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot intent from buyNow
  }, [checkoutIntent, items.length, orderSuccess]);

  const handleCartToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    requireCustomer(() => setOpen(true));
  };

  return (
    <>
      <button
        type="button"
        className="floating-cart-trigger"
        onClick={handleCartToggle}
        aria-label={t('cart.openCart', { count })}
      >
        🛒
        {count > 0 ? <span className="floating-cart-badge">{count}</span> : null}
      </button>

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
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
              role="dialog"
              aria-label={t('cart.yourCart')}
            >
              <div className="floating-cart-head">
                <h2>{t('cart.yourCart')}</h2>
                <button type="button" className="floating-cart-close" onClick={() => setOpen(false)} aria-label={t('cart.closeCart')}>
                  ✕
                </button>
              </div>

              {orderSuccess ? (
                <OrderSuccessPanel
                  order={orderSuccess}
                  phone={successPhone}
                  onDone={() => {
                    setOrderSuccess(null);
                    setSuccessPhone('');
                    setOpen(false);
                  }}
                />
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
                            <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} disabled={item.qty <= 1}>
                              −
                            </button>
                            <span>{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.id, item.qty + 1)}
                              disabled={item.qty >= maxCartQty(item)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="floating-cart-remove"
                          onClick={() => removeItem(item.id)}
                          aria-label={t('cart.remove')}
                        >
                          ✕
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                  <p className="floating-cart-total">
                    {t('cart.total')} <strong>{formatPrice(total)}</strong>
                  </p>
                </>
              )}

              {!orderSuccess && (
                <div className="floating-cart-foot">
                  {items.length > 0 && (
                    <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={startCheckout}>
                      {t('cart.proceedCheckout')}
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ width: '100%', marginTop: '0.5rem' }}
                      onClick={clearCart}
                    >
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
