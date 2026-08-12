/** Delivery at checkout — PostEx API mode when server has POSTEX_TOKEN. */
export const DEFAULT_DELIVERY = {
  mode: 'manual',
  postex_configured: false,
  courier: null,
  lahore_fee: 150,
  outside_note:
    'Delivery fee for your city will be confirmed by staff on WhatsApp before dispatch.',
};

export const LAHORE_ESTIMATED_DELIVERY_FEE = DEFAULT_DELIVERY.lahore_fee;

export function mergeDeliverySettings(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const fee = Number(s.lahore_fee);
  const postex = Boolean(s.postex_configured) || s.mode === 'postex';
  return {
    mode: postex ? 'postex' : 'manual',
    postex_configured: postex,
    courier: postex ? 'postex' : null,
    lahore_fee: Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : DEFAULT_DELIVERY.lahore_fee,
    outside_note:
      s.outside_note != null && String(s.outside_note).trim()
        ? String(s.outside_note).trim().slice(0, 300)
        : DEFAULT_DELIVERY.outside_note,
  };
}

/** Manual Lahore estimate only — null when PostEx mode (no fake fee). */
export function getEstimatedDeliveryFee(city, settings) {
  const merged = mergeDeliverySettings(settings);
  if (merged.mode === 'postex') return null;
  const c = String(city || '').trim().toLowerCase();
  if (c !== 'lahore') return null;
  return merged.lahore_fee;
}

export function isLahoreCity(city) {
  return String(city || '').trim().toLowerCase() === 'lahore';
}

export function isPostExDelivery(settings) {
  return mergeDeliverySettings(settings).mode === 'postex';
}
