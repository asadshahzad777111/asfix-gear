import { ASFIN } from './asfin.js';
import { SHOP } from './shop.js';

/** Active shop identity for Custom bill — syncs phone ↔ laptop via POS settings. */
export const CUSTOM_BILL_PROFILE_OWN = 'own';
export const CUSTOM_BILL_PROFILE_ASFIN = 'asfin';
export const CUSTOM_BILL_PROFILE_OTHER = 'other';

/** Logo / scanner source on Custom bill */
export const CUSTOM_BILL_MEDIA_NONE = 'none';
export const CUSTOM_BILL_MEDIA_OWN = 'own';
export const CUSTOM_BILL_MEDIA_ASFIN = 'asfin';
export const CUSTOM_BILL_MEDIA_CUSTOM = 'custom';

export const DEFAULT_CUSTOM_BILL_OWN = {
  shopName: SHOP.name || 'AsFix & Gear',
  shopPlace: SHOP.city || 'Lahore',
  shopPhone: SHOP.phone || '',
  logoSource: CUSTOM_BILL_MEDIA_OWN,
  scannerSource: CUSTOM_BILL_MEDIA_OWN,
  includeLogo: true,
  includeQr: true,
  qrPayload: '',
};

export const DEFAULT_CUSTOM_BILL_ASFIN = {
  shopName: ASFIN.shopName,
  shopPlace: SHOP.city || 'Lahore',
  shopPhone: '',
  logoSource: CUSTOM_BILL_MEDIA_ASFIN,
  scannerSource: CUSTOM_BILL_MEDIA_ASFIN,
  includeLogo: true,
  includeQr: true,
  qrPayload: ASFIN.siteUrl,
};

export const DEFAULT_CUSTOM_BILL_OTHER = {
  shopName: 'Osama Center',
  shopPlace: 'Trade World',
  shopPhone: '',
  logoSource: CUSTOM_BILL_MEDIA_NONE,
  scannerSource: CUSTOM_BILL_MEDIA_NONE,
  includeLogo: false,
  includeQr: false,
  qrPayload: '',
};

const MEDIA_KEY = 'asfix_pos_custom_bill_media_v1';
const MAX_IMAGE_CHARS = 900_000;

function clampStr(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeMediaSource(value, fallback = CUSTOM_BILL_MEDIA_NONE) {
  const raw = String(value || '').trim().toLowerCase();
  if (
    raw === CUSTOM_BILL_MEDIA_OWN
    || raw === CUSTOM_BILL_MEDIA_ASFIN
    || raw === CUSTOM_BILL_MEDIA_CUSTOM
    || raw === CUSTOM_BILL_MEDIA_NONE
  ) {
    return raw;
  }
  return fallback;
}

export function normalizeProfileId(value, fallback = CUSTOM_BILL_PROFILE_OTHER) {
  const raw = String(value || '').trim().toLowerCase();
  if (
    raw === CUSTOM_BILL_PROFILE_OWN
    || raw === CUSTOM_BILL_PROFILE_ASFIN
    || raw === CUSTOM_BILL_PROFILE_OTHER
  ) {
    return raw;
  }
  return fallback;
}

/** Migrate old includeLogo / includeQr booleans → source selectors. */
export function resolveLogoSource(src = {}, fallback = CUSTOM_BILL_MEDIA_NONE) {
  if (src.logoSource != null && String(src.logoSource).trim() !== '') {
    return normalizeMediaSource(src.logoSource, fallback);
  }
  if (src.includeLogo) return CUSTOM_BILL_MEDIA_CUSTOM;
  return normalizeMediaSource(fallback, CUSTOM_BILL_MEDIA_NONE);
}

export function resolveScannerSource(src = {}, fallback = CUSTOM_BILL_MEDIA_NONE) {
  if (src.scannerSource != null && String(src.scannerSource).trim() !== '') {
    return normalizeMediaSource(src.scannerSource, fallback);
  }
  if (src.includeQr) return CUSTOM_BILL_MEDIA_CUSTOM;
  return normalizeMediaSource(fallback, CUSTOM_BILL_MEDIA_NONE);
}

export function normalizeCustomBillProfile(raw, fallback = DEFAULT_CUSTOM_BILL_OTHER) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const logoSource = resolveLogoSource(src, fallback.logoSource);
  const scannerSource = resolveScannerSource(src, fallback.scannerSource);
  return {
    shopName: clampStr(src.shopName ?? fallback.shopName, 80) || fallback.shopName,
    shopPlace: clampStr(src.shopPlace ?? fallback.shopPlace, 80),
    shopPhone: clampStr(src.shopPhone ?? fallback.shopPhone, 40),
    logoSource,
    scannerSource,
    includeLogo: logoSource !== CUSTOM_BILL_MEDIA_NONE,
    includeQr: scannerSource !== CUSTOM_BILL_MEDIA_NONE,
    qrPayload: clampStr(src.qrPayload ?? fallback.qrPayload, 500),
  };
}

export function normalizeCustomBillSettings(input = {}) {
  const active = normalizeProfileId(input.customBillActiveProfile, CUSTOM_BILL_PROFILE_OWN);
  return {
    customBillActiveProfile: active,
    customBillOwn: normalizeCustomBillProfile(input.customBillOwn, DEFAULT_CUSTOM_BILL_OWN),
    customBillAsfin: normalizeCustomBillProfile(input.customBillAsfin, DEFAULT_CUSTOM_BILL_ASFIN),
    customBillOther: normalizeCustomBillProfile(input.customBillOther, DEFAULT_CUSTOM_BILL_OTHER),
  };
}

export function getActiveCustomBillProfile(settings) {
  const normalized = normalizeCustomBillSettings(settings);
  if (normalized.customBillActiveProfile === CUSTOM_BILL_PROFILE_ASFIN) {
    return normalized.customBillAsfin;
  }
  if (normalized.customBillActiveProfile === CUSTOM_BILL_PROFILE_OTHER) {
    return normalized.customBillOther;
  }
  return normalized.customBillOwn;
}

export function isAsfinCustomBill(draftOrOrder = {}) {
  const profile = String(draftOrOrder.profileId || draftOrOrder.brand || '').toLowerCase();
  if (profile === CUSTOM_BILL_PROFILE_ASFIN || profile === 'asplywood') return true;
  const logo = String(draftOrOrder.logoSource || draftOrOrder.logo_source || '').toLowerCase();
  const scanner = String(draftOrOrder.scannerSource || draftOrOrder.scanner_source || '').toLowerCase();
  if (logo === CUSTOM_BILL_MEDIA_ASFIN || scanner === CUSTOM_BILL_MEDIA_ASFIN) return true;
  const shop = String(draftOrOrder.shopName || draftOrOrder.shop_name || '').trim().toLowerCase();
  return shop === 'asplywood' || shop.includes('asfin');
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
