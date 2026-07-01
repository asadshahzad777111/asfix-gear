export const CATEGORIES = [
  'Gaming',
  'Cases',
  'Chargers',
  'Cables',
  'Screen Guards',
  'Audio',
  'Power Banks',
  'Accessories',
];

/** Shop-home brand tiles — repair/accessory brands only (no fake labels). */
export const SHOP_BRANDS = [
  { id: 'iphone', label: 'iPhone', icon: '🍎', search: 'iPhone' },
  { id: 'samsung', label: 'Samsung', icon: '📱', search: 'Samsung' },
  { id: 'xiaomi', label: 'Xiaomi / Redmi', icon: '📲', search: 'Xiaomi' },
  { id: 'oppo', label: 'Oppo / Vivo', icon: '📱', search: 'Oppo' },
  { id: 'infinix', label: 'Infinix / Tecno', icon: '📱', search: 'Infinix' },
  { id: 'huawei', label: 'Huawei / Honor', icon: '📱', search: 'Huawei' },
];

/** Featured collection cards on home (non-gaming, real categories). */
export const HOME_COLLECTIONS = ['Cases', 'Chargers', 'Screen Guards', 'Audio'];

export const SHOP_CATEGORIES = CATEGORIES.filter((c) => c !== 'Gaming');

export const DEFAULT_IMAGES = {
  Gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=600&fit=crop',
  Cases: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop',
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
