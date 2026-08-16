/**
 * Normalize barcode / SKU for storage + POS exact match (trim + lowercase).
 */
export function normalizeBarcode(value) {
  return String(value || '').trim().toLowerCase().slice(0, 64);
}
