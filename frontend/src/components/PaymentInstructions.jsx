import { mergePaymentSettings, DEFAULT_PAYMENTS } from '../config/payments';

export default function PaymentInstructions({ t, amount, orderId, paymentMode = 'jazzcash', settings }) {
  const pay = mergePaymentSettings(settings || DEFAULT_PAYMENTS);
  const isBank = paymentMode === 'bank';
  const wallet = pay[paymentMode] || pay.jazzcash;

  return (
    <div className="checkout-payment-instructions glass-card">
      <h4 className="checkout-payment-instructions-title">{t('cart.paymentInstructionsTitle')}</h4>
      <ol className="checkout-payment-instructions-steps">
        <li>{t('cart.paymentStepSend', { amount })}</li>
        {isBank ? (
          <>
            <li>
              <span className="checkout-payment-instructions-label">{t('cart.bankName')}</span>
              <strong className="checkout-payment-instructions-value">{pay.bank.bankName}</strong>
            </li>
            <li>
              <span className="checkout-payment-instructions-label">{t('cart.paymentMerchantName')}</span>
              <strong className="checkout-payment-instructions-value">{pay.bank.accountName}</strong>
            </li>
            <li>
              <span className="checkout-payment-instructions-label">{t('cart.bankAccountNumber')}</span>
              <strong className="checkout-payment-instructions-value">{pay.bank.accountNumber}</strong>
            </li>
            <li>
              <span className="checkout-payment-instructions-label">{t('cart.bankIban')}</span>
              <strong className="checkout-payment-instructions-value">{pay.bank.iban}</strong>
            </li>
            <li>
              <span className="checkout-payment-instructions-label">{t('cart.bankBranch')}</span>
              <strong className="checkout-payment-instructions-value">{pay.bank.branch}</strong>
            </li>
          </>
        ) : (
          <>
            <li>
              <span className="checkout-payment-instructions-label">{t('cart.paymentMerchantNumber')}</span>
              <strong className="checkout-payment-instructions-value">{wallet.number}</strong>
            </li>
            <li>
              <span className="checkout-payment-instructions-label">{t('cart.paymentMerchantName')}</span>
              <strong className="checkout-payment-instructions-value">{wallet.accountName}</strong>
            </li>
          </>
        )}
        <li>
          {orderId
            ? t('cart.paymentIncludeOrderIdWith', { orderId })
            : t('cart.paymentIncludeOrderId')}
        </li>
      </ol>
    </div>
  );
}
