export function composeAddressLine(address = {}) {
  const parts = [
    address.houseNumber,
    address.streetAddress,
    address.landmark,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  return parts.join(', ') || String(address.text || '').trim();
}

export function displayAddressLine(address = {}) {
  return composeAddressLine(address) || String(address.text || '').trim();
}
