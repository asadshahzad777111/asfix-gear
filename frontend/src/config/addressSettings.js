export const DEFAULT_ADDRESS_SETTINGS = {
  addressStructuredFormEnabled: true,
  addressCourierSafeLocationEnabled: false,
  addressMapPickerEnabled: true,
};

export function mergeAddressSettings(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    addressStructuredFormEnabled: s.addressStructuredFormEnabled !== false,
    addressCourierSafeLocationEnabled: Boolean(s.addressCourierSafeLocationEnabled),
    addressMapPickerEnabled: s.addressMapPickerEnabled !== false,
  };
}
