import { SHOP } from './shop';

/** Default payment accounts — admin can override via Settings → Payments (stored in API). */
export const DEFAULT_PAYMENTS = {
  jazzcash: {
    enabled: true,
    number: SHOP.phone,
    accountName: 'ASAD SHAHZAD',
  },
  easypaisa: {
    enabled: true,
    number: SHOP.phone,
    accountName: 'ASAD SHAHZAD',
  },
  bank: {
    enabled: true,
    accountName: 'ASAD SHAHZAD',
    accountNumber: '11590105485732',
    iban: 'PK81MEZN0011590105485732',
    bankName: 'Meezan Bank',
    branch: 'BATAPUR BRANCH LHR',
  },
  /** Cash on Delivery — mainly Lahore; no wallet/bank fields. */
  cod: {
    enabled: true,
  },
  /**
   * Premier PayFast (Pakistan PSO/PSP) — NOT free to go live.
   * Requires merchant signup at https://getstarted.apps.net.pk/signup,
   * sandbox test txs, then live MERCHANT_ID + SECURED_KEY.
   * Hosted checkout: ipg2.apps.net.pk (live) / ipguat.apps.net.pk (UAT).
   * Keep disabled until credentials exist in env (PAYFAST_MERCHANT_ID / PAYFAST_SECURED_KEY).
   */
  payfast: {
    enabled: false,
  },
};

export const PAYMENT_METHOD_IDS = ['jazzcash', 'easypaisa', 'bank', 'cod', 'payfast'];
export const ADVANCE_PAYMENT_MODES = new Set(['jazzcash', 'easypaisa', 'bank', 'payfast']);

function normalizeSavedPayments(saved) {
  return saved && typeof saved === 'object' ? saved : {};
}

export function mergePaymentSettings(saved) {
  const s = normalizeSavedPayments(saved);
  return {
    jazzcash: { ...DEFAULT_PAYMENTS.jazzcash, ...(s.jazzcash || {}) },
    easypaisa: { ...DEFAULT_PAYMENTS.easypaisa, ...(s.easypaisa || {}) },
    bank: { ...DEFAULT_PAYMENTS.bank, ...(s.bank || {}) },
    cod: { ...DEFAULT_PAYMENTS.cod, ...(s.cod || {}) },
    payfast: { ...DEFAULT_PAYMENTS.payfast, ...(s.payfast || {}) },
  };
}

export function enabledPaymentMethods(settings) {
  const merged = mergePaymentSettings(settings);
  return PAYMENT_METHOD_IDS.filter((id) => merged[id]?.enabled !== false);
}

export function isCodPayment(mode) {
  return String(mode || '').toLowerCase() === 'cod';
}
