/**
 * Normalize barcode / SKU for save + POS exact match.
 * Must stay in sync with POS findExactBarcodeProduct (trim + lowercase).
 */
export function normalizeBarcode(value) {
  return String(value || '').trim().toLowerCase().slice(0, 64);
}
