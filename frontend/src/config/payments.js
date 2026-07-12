/** Default payment accounts — admin can override via Settings → Payments (stored in API). */
export const DEFAULT_PAYMENTS = {
  jazzcash: {
    enabled: true,
    number: '03039227000',
    accountName: 'ASAD SHAHZAD',
  },
  easypaisa: {
    enabled: true,
    number: '03039227000',
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
};

export const PAYMENT_METHOD_IDS = ['jazzcash', 'easypaisa', 'bank', 'cod'];
export const ADVANCE_PAYMENT_MODES = new Set(['jazzcash', 'easypaisa', 'bank']);

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
  };
}

export function enabledPaymentMethods(settings) {
  const merged = mergePaymentSettings(settings);
  return PAYMENT_METHOD_IDS.filter((id) => merged[id]?.enabled !== false);
}

export function isCodPayment(mode) {
  return String(mode || '').toLowerCase() === 'cod';
}
