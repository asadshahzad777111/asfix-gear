import { SHOP } from './shop.js';

/** Active shop identity for Custom bill — syncs phone ↔ laptop via POS settings. */
export const CUSTOM_BILL_PROFILE_OWN = 'own';
export const CUSTOM_BILL_PROFILE_OTHER = 'other';

export const DEFAULT_CUSTOM_BILL_OWN = {
  shopName: SHOP.name || 'AsFix & Gear',
  shopPlace: SHOP.city || 'Lahore',
  shopPhone: SHOP.phone || '',
  includeLogo: false,
  includeQr: false,
  qrPayload: '',
};

export const DEFAULT_CUSTOM_BILL_OTHER = {
  shopName: 'Osama Center',
  shopPlace: 'Trade World',
  shopPhone: '',
  includeLogo: false,
  includeQr: false,
  qrPayload: '',
};

const MEDIA_KEY = 'asfix_pos_custom_bill_media_v1';
const MAX_IMAGE_CHARS = 900_000;

function clampStr(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeCustomBillProfile(raw, fallback = DEFAULT_CUSTOM_BILL_OTHER) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    shopName: clampStr(src.shopName ?? fallback.shopName, 80) || fallback.shopName,
    shopPlace: clampStr(src.shopPlace ?? fallback.shopPlace, 80),
    shopPhone: clampStr(src.shopPhone ?? fallback.shopPhone, 40),
    includeLogo: Boolean(src.includeLogo),
    includeQr: Boolean(src.includeQr),
    qrPayload: clampStr(src.qrPayload ?? fallback.qrPayload, 500),
  };
}

export function normalizeCustomBillSettings(input = {}) {
  const active = String(input.customBillActiveProfile || '').trim().toLowerCase();
  return {
    customBillActiveProfile:
      active === CUSTOM_BILL_PROFILE_OTHER ? CUSTOM_BILL_PROFILE_OTHER : CUSTOM_BILL_PROFILE_OWN,
    customBillOwn: normalizeCustomBillProfile(input.customBillOwn, DEFAULT_CUSTOM_BILL_OWN),
    customBillOther: normalizeCustomBillProfile(input.customBillOther, DEFAULT_CUSTOM_BILL_OTHER),
  };
}

export function getActiveCustomBillProfile(settings) {
  const normalized = normalizeCustomBillSettings(settings);
  return normalized.customBillActiveProfile === CUSTOM_BILL_PROFILE_OTHER
    ? normalized.customBillOther
    : normalized.customBillOwn;
}

/** Device-local logo / QR PIC — not synced (too large for settings JSON). */
export function loadCustomBillMedia(profileId) {
  try {
    const raw = localStorage.getItem(MEDIA_KEY);
    if (!raw) return { logoDataUrl: '', qrImageDataUrl: '' };
    const parsed = JSON.parse(raw);
    const slot = parsed?.[profileId];
    if (!slot || typeof slot !== 'object') return { logoDataUrl: '', qrImageDataUrl: '' };
    return {
      logoDataUrl: String(slot.logoDataUrl || '').slice(0, MAX_IMAGE_CHARS),
      qrImageDataUrl: String(slot.qrImageDataUrl || '').slice(0, MAX_IMAGE_CHARS),
    };
  } catch {
    return { logoDataUrl: '', qrImageDataUrl: '' };
  }
}

export function saveCustomBillMedia(profileId, media) {
  try {
    const raw = localStorage.getItem(MEDIA_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    next[profileId] = {
      logoDataUrl: String(media?.logoDataUrl || '').slice(0, MAX_IMAGE_CHARS),
      qrImageDataUrl: String(media?.qrImageDataUrl || '').slice(0, MAX_IMAGE_CHARS),
    };
    localStorage.setItem(MEDIA_KEY, JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
}

export { MAX_IMAGE_CHARS as CUSTOM_BILL_MAX_IMAGE_CHARS };
