/**
 * `Cases` covers pouches/cases, `Back Covers` covers rigid back covers, and
 * `Screen Guards` covers screen protectors/front glass — matches the
 * accessory taxonomy staff tag real inventory against per model.
 */
export const CATEGORIES = [
  'Gaming',
  'Cases',
  'Back Covers',
  'Chargers',
  'Cables',
  'Screen Guards',
  'Audio',
  'Power Banks',
  'Accessories',
];

/**
 * Shop-home brand tiles — repair/accessory brands only (no fake labels).
 * Every id here MUST have a matching entry in
 * `SHOP_BRAND_TO_REPAIR_BRAND` (config/repairModels.js) so the mega menu
 * model slide-out never falls through to an empty list.
 */
export const SHOP_BRANDS = [
  { id: 'iphone', label: 'iPhone', icon: '🍎', search: 'iPhone' },
  { id: 'samsung', label: 'Samsung', icon: '📱', search: 'Samsung' },
  { id: 'oneplus', label: 'OnePlus', icon: '📱', search: 'OnePlus' },
  { id: 'xiaomi', label: 'Xiaomi / Redmi / POCO', icon: '📲', search: 'Xiaomi' },
  { id: 'vivo', label: 'Vivo / iQOO', icon: '📱', search: 'Vivo' },
  { id: 'oppo', label: 'Oppo', icon: '📱', search: 'Oppo' },
  { id: 'infinix', label: 'Infinix', icon: '📱', search: 'Infinix' },
  { id: 'tecno', label: 'Tecno', icon: '📱', search: 'Tecno' },
  { id: 'pixel', label: 'Google Pixel', icon: '📱', search: 'Pixel' },
  { id: 'realme', label: 'Realme', icon: '📱', search: 'Realme' },
  { id: 'motorola', label: 'Motorola', icon: '📱', search: 'Motorola' },
  { id: 'nothing', label: 'Nothing', icon: '📱', search: 'Nothing' },
  { id: 'honor', label: 'Honor', icon: '📱', search: 'Honor' },
  { id: 'itel', label: 'Itel', icon: '📱', search: 'Itel' },
];

/** Featured collection cards on home (non-gaming, real categories). */
export const HOME_COLLECTIONS = ['Cases', 'Chargers', 'Screen Guards', 'Audio'];

export const SHOP_CATEGORIES = CATEGORIES.filter((c) => c !== 'Gaming');

/**
 * Categories where the product only fits one exact phone model — for these,
 * clicking the category should guide the customer through "which company? →
 * which model?" first (see `PhoneFinderModal`), instead of dumping every
 * brand's cases/covers/guards into one long list they have to search
 * through manually. Chargers/Cables/Audio/Power Banks/Accessories are
 * mostly universal, so they skip straight to the shop listing.
 */
export const MODEL_SPECIFIC_CATEGORIES = ['Cases', 'Back Covers', 'Screen Guards'];

export const DEFAULT_IMAGES = {
  Gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=600&fit=crop',
  Cases: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop',
  'Back Covers': 'https://images.unsplash.com/photo-1601972599720-36938d4ecd31?w=600&h=600&fit=crop',
  Chargers: 'https://images.unsplash.com/photo-1583394290456-38d677e27651?w=600&h=600&fit=crop&q=80',
  Cables: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop',
  'Screen Guards': 'https://images.unsplash.com/photo-1585790050230-5dd28404fcb9?w=600&h=600&fit=crop',
  Audio: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop',
  'Power Banks': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop',
  Accessories: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop',
};

export const EMPTY_PRODUCT = {
  name: '',
  category: 'Cases',
  brand: '',
  compatible_models: '',
  price: '',
  cost_price: '',
  description: '',
  image: DEFAULT_IMAGES.Cases,
  stock: '10',
  featured: false,
  discount_enabled: false,
  discount_percent: 0,
  warranty: '',
};

export function getDefaultImage(category) {
  return DEFAULT_IMAGES[category] || DEFAULT_IMAGES.Accessories;
}
