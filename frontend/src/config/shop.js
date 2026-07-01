import { buildContactPath, buildContactPrefill } from '../utils/contactPrefill.js';

export const SHOP = {
  name: 'AsFix & Gear',
  tagline: 'Fix • Shop • Care',
  owner: 'Asad Shahzad',
  phone: '03039227000',
  phoneIntl: '923039227000',
  email: 'asadshahzad777111@gmail.com',
  hours: 'Subah 9:00 AM se Raat 9:00 PM (Har roz)',
  hoursEn: 'Daily: 9:00 AM – 9:00 PM',
  openHour: 9,
  closeHour: 21,

  // Google Maps coordinates
  lat: 31.59375,
  lng: 74.46745,

  addressLine1: 'AsFix & Gear — Mobile Repair & Accessories',
  addressLine2: 'Lahore, Pakistan',
  city: 'Lahore',
  landmark: 'Google Maps pin par shop location',

  get coordinates() {
    return `${this.lat}, ${this.lng}`;
  },

  get fullAddress() {
    return `${this.addressLine1}, ${this.addressLine2}`;
  },

  get mapsUrl() {
    return `https://www.google.com/maps?q=${this.lat},${this.lng}`;
  },

  get mapsDirectionsUrl() {
    return `https://www.google.com/maps/dir/?api=1&destination=${this.lat},${this.lng}`;
  },

  get mapsEmbedUrl() {
    return `https://maps.google.com/maps?q=${this.lat},${this.lng}&z=16&ie=UTF8&iwloc=&output=embed`;
  },
};

export function isShopOpen() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= SHOP.openHour && hour < SHOP.closeHour;
}

export function whatsappLink(message) {
  return `https://wa.me/${SHOP.phoneIntl}?text=${encodeURIComponent(message)}`;
}

export function orderProductContactPath(product) {
  return buildContactPath(buildContactPrefill({ type: 'product', product }));
}

export function generalContactPath() {
  return buildContactPath(buildContactPrefill({ type: 'general' }));
}

export function directionsContactPath() {
  return buildContactPath(buildContactPrefill({ type: 'directions' }));
}

export function gamingContactPath() {
  return buildContactPath(buildContactPrefill({ type: 'gaming' }));
}
