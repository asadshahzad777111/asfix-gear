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
};

function normalizeSavedPayments(saved) {
  return saved && typeof saved === 'object' ? saved : {};
}

export function mergePaymentSettings(saved) {
  const s = normalizeSavedPayments(saved);
  return {
    jazzcash: { ...DEFAULT_PAYMENTS.jazzcash, ...(s.jazzcash || {}) },
    easypaisa: { ...DEFAULT_PAYMENTS.easypaisa, ...(s.easypaisa || {}) },
    bank: { ...DEFAULT_PAYMENTS.bank, ...(s.bank || {}) },
  };
}

export function enabledPaymentMethods(settings) {
  const merged = mergePaymentSettings(settings);
  return ['jazzcash', 'easypaisa', 'bank'].filter((id) => merged[id]?.enabled !== false);
}
