import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, formatPrice } from '../../api/client';
import {
  CUSTOM_BILL_MAX_IMAGE_CHARS,
  CUSTOM_BILL_MEDIA_ASFIN,
  CUSTOM_BILL_MEDIA_CUSTOM,
  CUSTOM_BILL_MEDIA_NONE,
  CUSTOM_BILL_MEDIA_OWN,
  CUSTOM_BILL_PROFILE_ASFIN,
  CUSTOM_BILL_PROFILE_OTHER,
  CUSTOM_BILL_PROFILE_OWN,
  DEFAULT_CUSTOM_BILL_ASFIN,
  DEFAULT_CUSTOM_BILL_OTHER,
  DEFAULT_CUSTOM_BILL_OWN,
  isAsfinCustomBill,
  loadCustomBillMedia,
  normalizeCustomBillSettings,
  normalizeProfileId,
  resolveLogoSource,
  resolveScannerSource,
  saveCustomBillMedia,
} from '../../config/posCustomBillProfiles';
import { ASFIN } from '../../config/asfin';
import { useTranslation } from '../../context/LanguageContext';
import { isNativePosApp, getSavedPrinter } from '../../utils/nativePosPrint';
import { normalizePrintResult } from './AdminCounterBill';

const STORAGE_KEY = 'asfix_pos_custom_bill_v2';

const DEFAULT_ITEMS_ASFIX = [
  { id: '1', name: 'Body + Body Structure', rate: 2500, qty: 1 },
  { id: '2', name: 'SIM Jack', rate: 200, qty: 1 },
  { id: '3', name: 'Button', rate: 200, qty: 1 },
  { id: '4', name: 'Mobile Panel A+ (1st copy)', rate: 2800, qty: 1 },
  { id: '5', name: '', rate: '', qty: '' },
  { id: '6', name: '', rate: '', qty: '' },
];

const DEFAULT_ITEMS_ASFIN = [
  { id: '1', name: 'Plywood sheet', rate: '', qty: '' },
  { id: '2', name: 'Laminate', rate: '', qty: '' },
  { id: '3', name: 'Edge banding', rate: '', qty: '' },
  { id: '4', name: '', rate: '', qty: '' },
  { id: '5', name: '', rate: '', qty: '' },
  { id: '6', name: '', rate: '', qty: '' },
];

function tomorrowLocalParts() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return {
    dateInput: `${yyyy}-${mm}-${dd}`,
    timeInput: '10:00',
  };
}

function formatReceiptDateLabel(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(`${dateInput}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateInput;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatReceiptTimeLabel(timeInput) {
  if (!timeInput) return '-';
  const [hh = '00', mi = '00'] = String(timeInput).split(':');
  return `${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function loadSavedDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('asfix_pos_custom_bill_v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed.items)) {
      parsed.items = parsed.items.map((row, idx) => ({
        id: row.id || String(idx + 1),
        name: row.name ?? '',
        rate: row.rate ?? '',
        qty: row.qty === undefined || row.qty === null || row.qty === '' ? '' : row.qty,
      }));
    }
    return parsed;
  } catch {
    return null;
  }
}

function newItem() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    rate: '',
    qty: '',
  };
}

function profileIdentityFields(profile) {
  const logoSource = resolveLogoSource(profile, profile.logoSource || CUSTOM_BILL_MEDIA_NONE);
  const scannerSource = resolveScannerSource(profile, profile.scannerSource || CUSTOM_BILL_MEDIA_NONE);
  return {
    shopName: profile.shopName,
    shopPlace: profile.shopPlace,
    shopPhone: profile.shopPhone,
    logoSource,
    scannerSource,
    includeLogo: logoSource !== CUSTOM_BILL_MEDIA_NONE,
    includeQr: scannerSource !== CUSTOM_BILL_MEDIA_NONE,
    qrPayload: profile.qrPayload || '',
  };
}

function migrateDraftMediaSources(draft) {
  if (!draft || typeof draft !== 'object') return draft;
  const logoSource = resolveLogoSource(draft, CUSTOM_BILL_MEDIA_NONE);
  const scannerSource = resolveScannerSource(draft, CUSTOM_BILL_MEDIA_NONE);
  return {
    ...draft,
    logoSource,
    scannerSource,
    includeLogo: logoSource !== CUSTOM_BILL_MEDIA_NONE,
    includeQr: scannerSource !== CUSTOM_BILL_MEDIA_NONE,
  };
}

function buildDefaults(profileId = CUSTOM_BILL_PROFILE_OTHER, settings = null) {
  const t = tomorrowLocalParts();
  const normalized = normalizeCustomBillSettings(settings || {});
  const id = normalizeProfileId(profileId, CUSTOM_BILL_PROFILE_OTHER);
  const profile =
    id === CUSTOM_BILL_PROFILE_OWN
      ? normalized.customBillOwn
      : id === CUSTOM_BILL_PROFILE_ASFIN
        ? normalized.customBillAsfin
        : normalized.customBillOther;
  const media = loadCustomBillMedia(id);
  const items = (
    id === CUSTOM_BILL_PROFILE_ASFIN ? DEFAULT_ITEMS_ASFIN : DEFAULT_ITEMS_ASFIX
  ).map((row) => ({ ...row }));
  return {
    profileId: id,
    ...profileIdentityFields(profile),
    logoDataUrl: media.logoDataUrl,
    qrImageDataUrl: media.qrImageDataUrl,
    dateInput: t.dateInput,
    timeInput: t.timeInput,
    mobileName: id === CUSTOM_BILL_PROFILE_ASFIN ? '' : 'Infinix Smart 5',
    customerName: '',
    notes: '',
    items,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

export function buildCustomBillOrder(draft) {
  const items = (draft.items || [])
    .map((row) => {
      const name = String(row.name || '').trim();
      const qty = Math.max(1, Number(row.qty) || 1);
      const price = Math.max(0, Number(row.rate) || 0);
      return { name, qty, price };
    })
    /* Empty name boxes are ignored — fill name (+ rate/qty) to print */
    .filter((row) => row.name);

  const total = items.reduce((sum, row) => sum + row.price * row.qty, 0);
  const dateLabel = formatReceiptDateLabel(draft.dateInput);
  const timeLabel = formatReceiptTimeLabel(draft.timeInput);
  const createdAt = (() => {
    const iso = new Date(`${draft.dateInput || ''}T${draft.timeInput || '00:00'}:00`);
    return Number.isNaN(iso.getTime()) ? new Date().toISOString() : iso.toISOString();
  })();

  const logoSource = resolveLogoSource(draft, CUSTOM_BILL_MEDIA_NONE);
  const scannerSource = resolveScannerSource(draft, CUSTOM_BILL_MEDIA_NONE);
  const useOwnLogo = logoSource === CUSTOM_BILL_MEDIA_OWN;
  const useAsfinLogo = logoSource === CUSTOM_BILL_MEDIA_ASFIN;
  const useCustomLogo = logoSource === CUSTOM_BILL_MEDIA_CUSTOM;
  const useOwnQr = scannerSource === CUSTOM_BILL_MEDIA_OWN;
  const useAsfinQr = scannerSource === CUSTOM_BILL_MEDIA_ASFIN;
  const useCustomQr = scannerSource === CUSTOM_BILL_MEDIA_CUSTOM;

  return {
    order_id: `CB-${Date.now().toString(36).toUpperCase()}`,
    id: undefined,
    created_at: createdAt,
    receipt_date: dateLabel,
    receipt_time: timeLabel,
    customer_name: String(draft.customerName || '').trim() || 'Walk-in',
    phone: '',
    payment_mode: 'cash',
    device_name: String(draft.mobileName || '').trim(),
    notes: String(draft.notes || '').trim(),
    custom_receipt: true,
    brand: draft.profileId === CUSTOM_BILL_PROFILE_ASFIN ? 'asfin' : 'asfix',
    profileId: draft.profileId,
    shop_name: String(draft.shopName || '').trim() || 'Shop',
    shop_place: String(draft.shopPlace || '').trim(),
    shop_phone: String(draft.shopPhone || '').trim(),
    logo_source: logoSource,
    scanner_source: scannerSource,
    use_own_logo: useOwnLogo,
    use_asfin_logo: useAsfinLogo,
    use_own_qr: useOwnQr,
    use_asfin_qr: useAsfinQr,
    custom_logo_data_url: useCustomLogo && draft.logoDataUrl ? draft.logoDataUrl : '',
    include_qr: useOwnQr || useAsfinQr || useCustomQr,
    custom_qr_payload: useCustomQr ? String(draft.qrPayload || '').trim() : '',
    custom_qr_image_data_url: useCustomQr && draft.qrImageDataUrl ? draft.qrImageDataUrl : '',
    items,
    total_amount: total,
    discount_amount: 0,
  };
}

export default function PosCustomBill({
  onPrintOrder,
  onOpenPrinterSetup,
}) {
  const { t } = useTranslation();
  const nativePos = isNativePosApp();
  const logoInputRef = useRef(null);
  const qrInputRef = useRef(null);
  const settingsRef = useRef(normalizeCustomBillSettings({}));
  const [settingsReady, setSettingsReady] = useState(false);
  const [draft, setDraft] = useState(() => {
    const saved = loadSavedDraft();
    const base = buildDefaults(
      saved?.profileId || CUSTOM_BILL_PROFILE_OTHER,
      null,
    );
    if (!saved) return base;
    return migrateDraftMediaSources({
      ...base,
      ...saved,
      items: saved.items?.length ? saved.items : base.items,
      profileId: normalizeProfileId(saved.profileId, CUSTOM_BILL_PROFILE_OTHER),
    });
  });
  const [busy, setBusy] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const total = useMemo(
    () => (draft.items || []).reduce((sum, row) => {
      if (!String(row.name || '').trim()) return sum;
      const qty = Math.max(1, Number(row.qty) || 1);
      return sum + (Number(row.rate) || 0) * qty;
    }, 0),
    [draft.items],
  );

  const persist = useCallback((next) => {
    setDraft(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota — large images may fail; keep UI state */
    }
    saveCustomBillMedia(next.profileId || CUSTOM_BILL_PROFILE_OTHER, {
      logoDataUrl: next.logoDataUrl,
      qrImageDataUrl: next.qrImageDataUrl,
    });
  }, []);

  /* Load shop identity settings from server (syncs phone ↔ laptop). */
  useEffect(() => {
    let cancelled = false;
    api.getPosSettings()
      .then((settings) => {
        if (cancelled) return;
        const normalized = normalizeCustomBillSettings(settings || {});
        settingsRef.current = normalized;
        setDraft((prev) => {
          const profileId = normalizeProfileId(
            prev.profileId || normalized.customBillActiveProfile,
            normalized.customBillActiveProfile,
          );
          const profile =
            profileId === CUSTOM_BILL_PROFILE_OWN
              ? normalized.customBillOwn
              : profileId === CUSTOM_BILL_PROFILE_ASFIN
                ? normalized.customBillAsfin
                : normalized.customBillOther;
          const media = loadCustomBillMedia(profileId);
          const next = {
            ...prev,
            profileId,
            ...profileIdentityFields(profile),
            logoDataUrl: prev.logoDataUrl || media.logoDataUrl,
            qrImageDataUrl: prev.qrImageDataUrl || media.qrImageDataUrl,
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
      })
      .catch(() => {
        /* keep local draft */
      })
      .finally(() => {
        if (!cancelled) setSettingsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = useCallback((key, value) => {
    persist({ ...draft, [key]: value });
  }, [draft, persist]);

  const updateItem = useCallback((id, patch) => {
    persist({
      ...draft,
      items: draft.items.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  }, [draft, persist]);

  const addItem = useCallback(() => {
    persist({ ...draft, items: [...draft.items, newItem()] });
  }, [draft, persist]);

  const removeItem = useCallback((id) => {
    persist({
      ...draft,
      items: draft.items.length <= 1 ? draft.items : draft.items.filter((row) => row.id !== id),
    });
  }, [draft, persist]);

  const switchProfile = useCallback((profileId) => {
    const id = normalizeProfileId(profileId, CUSTOM_BILL_PROFILE_OTHER);
    const settings = settingsRef.current;
    const profile =
      id === CUSTOM_BILL_PROFILE_OWN
        ? settings.customBillOwn
        : id === CUSTOM_BILL_PROFILE_ASFIN
          ? settings.customBillAsfin
          : settings.customBillOther;
    const media = loadCustomBillMedia(id);
    const keepItems = draft.profileId === id;
    persist({
      ...draft,
      profileId: id,
      ...profileIdentityFields(profile),
      logoDataUrl: media.logoDataUrl,
      qrImageDataUrl: media.qrImageDataUrl,
      mobileName: id === CUSTOM_BILL_PROFILE_ASFIN ? (keepItems ? draft.mobileName : '') : draft.mobileName,
      items: keepItems
        ? draft.items
        : (id === CUSTOM_BILL_PROFILE_ASFIN ? DEFAULT_ITEMS_ASFIN : DEFAULT_ITEMS_ASFIX)
          .map((row) => ({ ...row })),
    });
  }, [draft, persist]);

  const resetDefaults = useCallback(() => {
    const id = draft.profileId || CUSTOM_BILL_PROFILE_OTHER;
    const next = buildDefaults(id, settingsRef.current);
    /* keep current items when resetting identity only? User expects full reset */
    persist(next);
    setFeedback({ type: 'ok', text: t('counter.customBillResetOk') });
  }, [draft.profileId, persist, t]);

  const saveAsSetting = useCallback(async () => {
    const profileId = normalizeProfileId(draft.profileId, CUSTOM_BILL_PROFILE_OTHER);
    const identity = {
      shopName: draft.shopName,
      shopPlace: draft.shopPlace,
      shopPhone: draft.shopPhone,
      logoSource: resolveLogoSource(draft, CUSTOM_BILL_MEDIA_NONE),
      scannerSource: resolveScannerSource(draft, CUSTOM_BILL_MEDIA_NONE),
      includeLogo: resolveLogoSource(draft, CUSTOM_BILL_MEDIA_NONE) !== CUSTOM_BILL_MEDIA_NONE,
      includeQr: resolveScannerSource(draft, CUSTOM_BILL_MEDIA_NONE) !== CUSTOM_BILL_MEDIA_NONE,
      qrPayload: draft.qrPayload || '',
    };
    saveCustomBillMedia(profileId, {
      logoDataUrl: draft.logoDataUrl,
      qrImageDataUrl: draft.qrImageDataUrl,
    });
    setSavingSettings(true);
    setFeedback(null);
    try {
      const body = {
        customBillActiveProfile: profileId,
        ...(profileId === CUSTOM_BILL_PROFILE_OWN
          ? { customBillOwn: identity }
          : profileId === CUSTOM_BILL_PROFILE_ASFIN
            ? { customBillAsfin: identity }
            : { customBillOther: identity }),
      };
      const saved = await api.setPosCustomBillSettings(body);
      settingsRef.current = normalizeCustomBillSettings(saved || {});
      setFeedback({ type: 'ok', text: t('counter.customBillSaveSettingOk') });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err?.message || t('counter.customBillSaveSettingFail'),
      });
    } finally {
      setSavingSettings(false);
    }
  }, [draft, t]);

  const onPickImage = useCallback(async (file, field) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setFeedback({ type: 'error', text: t('counter.customBillImageType') });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length > CUSTOM_BILL_MAX_IMAGE_CHARS) {
        setFeedback({ type: 'error', text: t('counter.customBillImageBig') });
        return;
      }
      persist({ ...draft, [field]: dataUrl });
      setFeedback({ type: 'ok', text: t('counter.customBillImageOk') });
    } catch (err) {
      setFeedback({ type: 'error', text: err?.message || t('counter.customBillImageFail') });
    }
  }, [draft, persist, t]);

  const printBill = useCallback(async () => {
    const order = buildCustomBillOrder(draft);
    if (!order.items.length) {
      setFeedback({ type: 'error', text: t('counter.customBillNeedItems') });
      return;
    }
    if (nativePos) {
      const saved = await getSavedPrinter();
      if (!saved?.address) {
        onOpenPrinterSetup?.();
        setFeedback({ type: 'error', text: t('admin.counterBillNativePrintFailed') });
        return;
      }
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = normalizePrintResult(await onPrintOrder?.(order));
      if (result.ok) {
        if (isAsfinCustomBill({ ...draft, ...order })) {
          try {
            await api.createAsfinBill({
              bill_id: order.order_id,
              shop_name: order.shop_name,
              shop_place: order.shop_place,
              shop_phone: order.shop_phone,
              customer_name: order.customer_name,
              device_name: order.device_name,
              notes: order.notes,
              receipt_date: order.receipt_date,
              receipt_time: order.receipt_time,
              items: order.items,
            });
          } catch {
            /* print succeeded — sheet save is best-effort */
          }
        }
        setFeedback({ type: 'ok', text: t('counter.customBillPrintOk') });
      } else {
        setFeedback({
          type: 'error',
          text: result.message || t('admin.counterBillNativePrintFailed'),
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err?.message || t('admin.counterBillNativePrintFailed') });
    } finally {
      setBusy(false);
    }
  }, [draft, nativePos, onOpenPrinterSetup, onPrintOrder, t]);

  const profileOwn = draft.profileId === CUSTOM_BILL_PROFILE_OWN;
  const profileAsfin = draft.profileId === CUSTOM_BILL_PROFILE_ASFIN;

  return (
    <section className="pos-custom-bill wp-postbox">
      <div className="wp-postbox-head pos-custom-bill__head">
        <strong>{t('counter.customBillTitle')}</strong>
        <span>{t('counter.customBillHint')}</span>
      </div>

      <div className="pos-custom-bill__profile" role="tablist" aria-label={t('counter.customBillProfile')}>
        <button
          type="button"
          role="tab"
          aria-selected={profileOwn}
          className={`wp-button pos-custom-bill__profile-btn${profileOwn ? ' pos-custom-bill__profile-btn--active' : ''}`}
          onClick={() => switchProfile(CUSTOM_BILL_PROFILE_OWN)}
        >
          {t('counter.customBillProfileOwn')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={profileAsfin}
          className={`wp-button pos-custom-bill__profile-btn${profileAsfin ? ' pos-custom-bill__profile-btn--active' : ''}`}
          onClick={() => switchProfile(CUSTOM_BILL_PROFILE_ASFIN)}
        >
          {t('counter.customBillProfileAsfin')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!profileOwn && !profileAsfin}
          className={`wp-button pos-custom-bill__profile-btn${!profileOwn && !profileAsfin ? ' pos-custom-bill__profile-btn--active' : ''}`}
          onClick={() => switchProfile(CUSTOM_BILL_PROFILE_OTHER)}
        >
          {t('counter.customBillProfileOther')}
        </button>
      </div>
      <p className="pos-custom-bill__profile-hint">
        {settingsReady
          ? t('counter.customBillProfileHint')
          : t('common.loading')}
      </p>

      <div className="pos-custom-bill__grid">
        <label>
          <span>{t('counter.customBillShop')}</span>
          <input
            value={draft.shopName}
            onChange={(e) => updateField('shopName', e.target.value)}
            autoComplete="organization"
          />
        </label>
        <label>
          <span>{t('counter.customBillPlace')}</span>
          <input
            value={draft.shopPlace}
            onChange={(e) => updateField('shopPlace', e.target.value)}
          />
        </label>
        <label>
          <span>{t('counter.customBillPhone')}</span>
          <input
            value={draft.shopPhone}
            onChange={(e) => updateField('shopPhone', e.target.value)}
            inputMode="tel"
          />
        </label>
        <label>
          <span>{t('admin.counterBillDate')}</span>
          <input
            type="date"
            value={draft.dateInput}
            onChange={(e) => updateField('dateInput', e.target.value)}
          />
        </label>
        <label>
          <span>{t('counter.customBillTime')}</span>
          <input
            type="time"
            value={draft.timeInput}
            onChange={(e) => updateField('timeInput', e.target.value)}
          />
        </label>
        <label>
          <span>{t('counter.customBillMobile')}</span>
          <input
            value={draft.mobileName}
            onChange={(e) => updateField('mobileName', e.target.value)}
            placeholder="Infinix Smart 5"
          />
        </label>
        <label className="pos-custom-bill__full">
          <span>{t('admin.counterBillCustomer')}</span>
          <input
            value={draft.customerName}
            onChange={(e) => updateField('customerName', e.target.value)}
            placeholder={t('admin.counterBillCustomerPh')}
          />
        </label>
      </div>

      <div className="pos-custom-bill__media">
        <div className="pos-custom-bill__media-block">
          <strong className="pos-custom-bill__media-title">{t('counter.customBillLogo')}</strong>
          <div className="pos-custom-bill__source" role="radiogroup" aria-label={t('counter.customBillLogo')}>
            {[
              { id: CUSTOM_BILL_MEDIA_NONE, label: t('counter.customBillLogoOff') },
              { id: CUSTOM_BILL_MEDIA_OWN, label: t('counter.customBillLogoOwn') },
              { id: CUSTOM_BILL_MEDIA_ASFIN, label: t('counter.customBillLogoAsfin') },
              { id: CUSTOM_BILL_MEDIA_CUSTOM, label: t('counter.customBillLogoCustom') },
            ].map((opt) => (
              <label key={opt.id} className="pos-custom-bill__source-opt">
                <input
                  type="radio"
                  name="custom-bill-logo-source"
                  checked={(draft.logoSource || CUSTOM_BILL_MEDIA_NONE) === opt.id}
                  onChange={() => persist({
                    ...draft,
                    logoSource: opt.id,
                    includeLogo: opt.id !== CUSTOM_BILL_MEDIA_NONE,
                  })}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {draft.logoSource === CUSTOM_BILL_MEDIA_OWN ? (
            <small className="pos-custom-bill__media-hint">{t('counter.customBillLogoOwnHint')}</small>
          ) : null}
          {draft.logoSource === CUSTOM_BILL_MEDIA_ASFIN ? (
            <div className="pos-custom-bill__media-row">
              <img className="pos-custom-bill__thumb" src={ASFIN.logoPath} alt="ASPLYWOOD" />
              <small className="pos-custom-bill__media-hint">{t('counter.customBillLogoAsfinHint')}</small>
            </div>
          ) : null}
          {draft.logoSource === CUSTOM_BILL_MEDIA_CUSTOM ? (
            <div className="pos-custom-bill__media-row">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  void onPickImage(file, 'logoDataUrl');
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="wp-button wp-button--secondary"
                onClick={() => logoInputRef.current?.click()}
              >
                {t('counter.customBillPickLogo')}
              </button>
              {draft.logoDataUrl ? (
                <>
                  <img className="pos-custom-bill__thumb" src={draft.logoDataUrl} alt="" />
                  <button
                    type="button"
                    className="wp-button wp-button--secondary"
                    onClick={() => updateField('logoDataUrl', '')}
                  >
                    {t('counter.customBillClearImage')}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="pos-custom-bill__media-block">
          <strong className="pos-custom-bill__media-title">{t('counter.customBillScanner')}</strong>
          <div className="pos-custom-bill__source" role="radiogroup" aria-label={t('counter.customBillScanner')}>
            {[
              { id: CUSTOM_BILL_MEDIA_NONE, label: t('counter.customBillScannerOff') },
              { id: CUSTOM_BILL_MEDIA_OWN, label: t('counter.customBillScannerOwn') },
              { id: CUSTOM_BILL_MEDIA_ASFIN, label: t('counter.customBillScannerAsfin') },
              { id: CUSTOM_BILL_MEDIA_CUSTOM, label: t('counter.customBillScannerCustom') },
            ].map((opt) => (
              <label key={opt.id} className="pos-custom-bill__source-opt">
                <input
                  type="radio"
                  name="custom-bill-scanner-source"
                  checked={(draft.scannerSource || CUSTOM_BILL_MEDIA_NONE) === opt.id}
                  onChange={() => persist({
                    ...draft,
                    scannerSource: opt.id,
                    includeQr: opt.id !== CUSTOM_BILL_MEDIA_NONE,
                    qrPayload: opt.id === CUSTOM_BILL_MEDIA_ASFIN ? ASFIN.siteUrl : draft.qrPayload,
                  })}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {draft.scannerSource === CUSTOM_BILL_MEDIA_OWN ? (
            <small className="pos-custom-bill__media-hint">{t('counter.customBillScannerOwnHint')}</small>
          ) : null}
          {draft.scannerSource === CUSTOM_BILL_MEDIA_ASFIN ? (
            <small className="pos-custom-bill__media-hint">{t('counter.customBillScannerAsfinHint')}</small>
          ) : null}
          {draft.scannerSource === CUSTOM_BILL_MEDIA_CUSTOM ? (
            <div className="pos-custom-bill__media-col">
              <label>
                <span>{t('counter.customBillQrLink')}</span>
                <input
                  value={draft.qrPayload}
                  onChange={(e) => updateField('qrPayload', e.target.value)}
                  placeholder="https://… or WhatsApp link"
                />
              </label>
              <div className="pos-custom-bill__media-row">
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void onPickImage(file, 'qrImageDataUrl');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="wp-button wp-button--secondary"
                  onClick={() => qrInputRef.current?.click()}
                >
                  {t('counter.customBillPickQr')}
                </button>
                {draft.qrImageDataUrl ? (
                  <>
                    <img className="pos-custom-bill__thumb" src={draft.qrImageDataUrl} alt="" />
                    <button
                      type="button"
                      className="wp-button wp-button--secondary"
                      onClick={() => updateField('qrImageDataUrl', '')}
                    >
                      {t('counter.customBillClearImage')}
                    </button>
                  </>
                ) : null}
              </div>
              <small className="pos-custom-bill__media-hint">{t('counter.customBillScannerHint')}</small>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pos-custom-bill__items">
        <div className="pos-custom-bill__items-head">
          <strong>{t('counter.customBillItems')}</strong>
          <button type="button" className="wp-button wp-button--secondary" onClick={addItem}>
            + {t('counter.customBillAddItem')}
          </button>
        </div>
        <div className="pos-custom-bill__items-labels" aria-hidden="true">
          <span>{t('counter.customBillItemName')}</span>
          <span>{t('counter.customBillQty')}</span>
          <span>{t('counter.customBillRate')}</span>
          <span />
        </div>
        <ul>
          {draft.items.map((row) => (
            <li key={row.id}>
              <input
                className="pos-custom-bill__item-name"
                value={row.name}
                onChange={(e) => updateItem(row.id, { name: e.target.value })}
                placeholder={t('counter.customBillItemName')}
              />
              <input
                className="pos-custom-bill__item-qty"
                type="number"
                min="1"
                step="1"
                value={row.qty}
                onChange={(e) => updateItem(row.id, { qty: e.target.value })}
                placeholder="1"
              />
              <input
                className="pos-custom-bill__item-rate"
                type="number"
                min="0"
                step="1"
                value={row.rate}
                onChange={(e) => updateItem(row.id, { rate: e.target.value })}
                placeholder="0"
              />
              <button
                type="button"
                className="pos-custom-bill__remove"
                onClick={() => removeItem(row.id)}
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label className="pos-custom-bill__notes">
        <span>{t('counter.customBillNotes')}</span>
        <textarea
          value={draft.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={2}
          placeholder={t('counter.customBillNotesPh')}
        />
      </label>

      <div className="pos-custom-bill__total">
        <span>{t('admin.counterBillTotal')}</span>
        <strong>{formatPrice(total)}</strong>
      </div>

      {feedback ? (
        <p className={`pos-custom-bill__feedback pos-custom-bill__feedback--${feedback.type}`}>
          {feedback.text}
        </p>
      ) : null}

      <div className="pos-custom-bill__actions">
        <button type="button" className="wp-button wp-button--secondary" onClick={resetDefaults} disabled={busy || savingSettings}>
          {t('counter.customBillReset')}
        </button>
        <button
          type="button"
          className="wp-button wp-button--secondary"
          onClick={() => void saveAsSetting()}
          disabled={busy || savingSettings}
        >
          {savingSettings ? t('common.loading') : t('counter.customBillSaveSetting')}
        </button>
        <button
          type="button"
          className="wp-button counter-bill__print-cta pos-custom-bill__print"
          onClick={() => void printBill()}
          disabled={busy || savingSettings || total <= 0}
        >
          {busy ? t('common.loading') : t('counter.customBillPrint')}
        </button>
      </div>
    </section>
  );
}

/* re-export helpers used by tests / docs */
export {
  CUSTOM_BILL_PROFILE_OWN,
  CUSTOM_BILL_PROFILE_OTHER,
  DEFAULT_CUSTOM_BILL_OWN,
  DEFAULT_CUSTOM_BILL_OTHER,
};
