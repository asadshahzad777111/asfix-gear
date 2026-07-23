/**
 * POS thermal “Scan & Pay” slips — large QR per wallet/bank number.
 * Account name is for staff screen / tear-off strip only (not customer-facing body).
 */

export const DEFAULT_POS_PAYMENT_QR_CARDS = [
  {
    id: 'jazzcash-03039227000',
    method: 'JazzCash',
    label: 'JazzCash',
    number: '03039227000',
    accountName: 'ASAD SHAHZAD',
    payload: '03039227000',
    enabled: true,
  },
  {
    id: 'easypaisa-03039227000',
    method: 'EasyPaisa',
    label: 'EasyPaisa',
    number: '03039227000',
    accountName: 'ASAD SHAHZAD',
    payload: '03039227000',
    enabled: true,
  },
  {
    id: 'jazzcash-03004405890',
    method: 'JazzCash',
    label: 'JazzCash',
    number: '03004405890',
    accountName: 'ASAD SHAHZAD',
    payload: '03004405890',
    enabled: true,
  },
  {
    id: 'easypaisa-03218858747',
    method: 'EasyPaisa',
    label: 'EasyPaisa',
    number: '03218858747',
    accountName: 'ASAD SHAHZAD',
    payload: '03218858747',
    enabled: true,
  },
  {
    id: 'meezan-iban',
    method: 'Meezan Bank',
    label: 'Meezan Bank',
    number: 'PK81MEZN0011590105485732',
    accountNumber: '11590105485732',
    iban: 'PK81MEZN0011590105485732',
    accountName: 'ASAD SHAHZAD',
    payload: 'PK81MEZN0011590105485732',
    enabled: true,
  },
];

export function formatPaymentDisplayNumber(raw) {
  const s = String(raw || '').replace(/\s+/g, '').trim();
  if (!s) return '';
  if (/^PK/i.test(s)) {
    return s.replace(/(.{4})/g, '$1 ').trim();
  }
  const digits = s.replace(/\D/g, '');
  /* 0303 922 7000 */
  if (digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length >= 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`.trim();
  }
  return s;
}

function normalizeCard(raw, index = 0) {
  const method = String(raw?.method || raw?.label || 'Pay').trim().slice(0, 40) || 'Pay';
  const number = String(raw?.number || raw?.iban || '').trim().slice(0, 40);
  const iban = String(raw?.iban || '').trim().slice(0, 40);
  const accountNumber = String(raw?.accountNumber || '').trim().slice(0, 30);
  const accountName = String(raw?.accountName || '').trim().slice(0, 120);
  const payload = String(raw?.payload || iban || number || '').trim().slice(0, 80);
  const id = String(raw?.id || `${method}-${number || index}`).trim().slice(0, 64);
  return {
    id,
    method,
    label: String(raw?.label || method).trim().slice(0, 40),
    number: number || iban,
    accountNumber,
    iban,
    accountName,
    payload: payload || number || iban,
    enabled: raw?.enabled !== false,
  };
}

export function mergePosPaymentQrCards(savedCards) {
  if (!Array.isArray(savedCards) || savedCards.length === 0) {
    return DEFAULT_POS_PAYMENT_QR_CARDS.map((c) => ({ ...c }));
  }
  return savedCards.slice(0, 12).map((c, i) => normalizeCard(c, i)).filter((c) => c.payload);
}

export function enabledPosPaymentQrCards(savedCards) {
  return mergePosPaymentQrCards(savedCards).filter((c) => c.enabled !== false && c.payload);
}
