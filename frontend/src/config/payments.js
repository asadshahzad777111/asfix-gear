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

export function mergePaymentSettings(saved = {}) {
  return {
    jazzcash: { ...DEFAULT_PAYMENTS.jazzcash, ...(saved.jazzcash || {}) },
    easypaisa: { ...DEFAULT_PAYMENTS.easypaisa, ...(saved.easypaisa || {}) },
    bank: { ...DEFAULT_PAYMENTS.bank, ...(saved.bank || {}) },
  };
}

export function enabledPaymentMethods(settings) {
  const merged = mergePaymentSettings(settings);
  return ['jazzcash', 'easypaisa', 'bank'].filter((id) => merged[id]?.enabled !== false);
}
