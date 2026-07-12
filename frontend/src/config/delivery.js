/** Estimated delivery fees shown at checkout (final fee confirmed by staff). */
export const DEFAULT_DELIVERY = {
  lahore_fee: 150,
  outside_note:
    'Delivery fee for your city will be confirmed by staff on WhatsApp before dispatch.',
};

export const LAHORE_ESTIMATED_DELIVERY_FEE = DEFAULT_DELIVERY.lahore_fee;

export function mergeDeliverySettings(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const fee = Number(s.lahore_fee);
  return {
    lahore_fee: Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : DEFAULT_DELIVERY.lahore_fee,
    outside_note:
      s.outside_note != null && String(s.outside_note).trim()
        ? String(s.outside_note).trim().slice(0, 300)
        : DEFAULT_DELIVERY.outside_note,
  };
}

export function getEstimatedDeliveryFee(city, settings) {
  const c = String(city || '').trim().toLowerCase();
  if (c !== 'lahore') return null;
  const merged = mergeDeliverySettings(settings);
  return merged.lahore_fee;
}

export function isLahoreCity(city) {
  return String(city || '').trim().toLowerCase() === 'lahore';
}
