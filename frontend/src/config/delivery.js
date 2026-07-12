/** Estimated delivery fees shown at checkout (final fee confirmed by staff). */
export const LAHORE_ESTIMATED_DELIVERY_FEE = 150;

export function getEstimatedDeliveryFee(city) {
  const c = String(city || '').trim().toLowerCase();
  if (c === 'lahore') return LAHORE_ESTIMATED_DELIVERY_FEE;
  return null;
}

export function isLahoreCity(city) {
  return String(city || '').trim().toLowerCase() === 'lahore';
}
