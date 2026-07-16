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

/** WP-style grouped category tree for admin product editor. */
export const CATEGORY_TREE = [
  {
    label: 'Phone Protection',
    items: ['Cases', 'Back Covers', 'Screen Guards'],
  },
  {
    label: 'Charging & Power',
    items: ['Chargers', 'Cables', 'Power Banks'],
  },
  {
    label: 'Shop',
    items: ['Audio', 'Accessories', 'Gaming'],
  },
];

export function flattenCategoryTree(extra = []) {
  const fromTree = CATEGORY_TREE.flatMap((group) => group.items);
  return [...new Set([...fromTree, ...extra, ...CATEGORIES])];
}

export const MAX_GALLERY_IMAGES = 8;

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
  Gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=600&fit=crop&q=80',
  Cases: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop&q=80',
  'Back Covers': 'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&h=600&fit=crop&q=80',
  Chargers: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&h=600&fit=crop&q=80',
  Cables: 'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=600&h=600&fit=crop&q=80',
  'Screen Guards': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&h=600&fit=crop&q=80',
  Audio: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop&q=80',
  'Power Banks': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop&q=80',
  Accessories: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop&q=80',
};

export const EMPTY_PRODUCT = {
  name: '',
  category: 'Cases',
  brand: '',
  compatible_models: '',
  price: '',
  cost_price: '',
  description: '',
  slug: '',
  tags: [],
  image: DEFAULT_IMAGES.Cases,
  gallery: [],
  stock: '10',
  featured: false,
  discount_enabled: false,
  discount_percent: 0,
  warranty: '',
  status: 'published',
};

export function getDefaultImage(category) {
  return DEFAULT_IMAGES[category] || DEFAULT_IMAGES.Accessories;
}

/** Smaller crop for home category chips (trending row, nav, etc.). */
export function getCategoryThumb(category, size = 128) {
  const base = DEFAULT_IMAGES[category];
  if (!base) return null;
  return base.replace(/w=\d+&h=\d+/, `w=${size}&h=${size}`);
}
