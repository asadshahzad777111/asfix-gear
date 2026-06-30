import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'data.json');

const CATEGORY_IMAGES = {
  Gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=600&fit=crop&q=80',
  Cases: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop&q=80',
  Chargers: 'https://images.unsplash.com/photo-1583394290456-38d677e27651?w=600&h=600&fit=crop&q=80',
  Cables: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop&q=80',
  'Screen Guards': 'https://images.unsplash.com/photo-1585790050230-5dd28404fcb9?w=600&h=600&fit=crop&q=80',
  Audio: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop&q=80',
  'Power Banks': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop&q=80',
  Accessories: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop&q=80',
};

const PRODUCT_IMAGES = {
  1: CATEGORY_IMAGES.Cases,
  2: CATEGORY_IMAGES['Screen Guards'],
  3: CATEGORY_IMAGES.Chargers,
  4: CATEGORY_IMAGES.Audio,
  5: CATEGORY_IMAGES['Power Banks'],
  6: CATEGORY_IMAGES.Cables,
  7: CATEGORY_IMAGES.Accessories,
  8: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=600&h=600&fit=crop&q=80',
  9: 'https://images.unsplash.com/photo-1612287230202-1ff1d85c1bdf?w=600&h=600&fit=crop&q=80',
  10: 'https://images.unsplash.com/photo-1593305843771-9f83c2aeda4f?w=600&h=600&fit=crop&q=80',
  11: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=600&h=600&fit=crop&q=80',
  12: 'https://images.unsplash.com/photo-1626645731056-f792d8338e18?w=600&h=600&fit=crop&q=80',
  13: 'https://images.unsplash.com/photo-1598331668826-3c408fb35c19?w=600&h=600&fit=crop&q=80',
  14: CATEGORY_IMAGES.Cases,
  15: 'https://images.unsplash.com/photo-1599669454699-248893623440?w=600&h=600&fit=crop&q=80',
  16: 'https://images.unsplash.com/photo-1587825140708-aa577f6e947e?w=600&h=600&fit=crop&q=80',
  17: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=600&fit=crop&q=80',
  18: 'https://images.unsplash.com/photo-1538488889696-7961cb780c98?w=600&h=600&fit=crop&q=80',
};

const REPAIR_SUPPORTED = {
  'Screen Replacement': 'iPhone, Samsung, Xiaomi, Oppo, Vivo, Infinix, Tecno — LCD & OLED models',
  'Battery Replacement': 'All major Android & iPhone models — capacity matched to device',
  'Charging Port Repair': 'Type-C, Micro-USB & Lightning ports — most brands',
  'Camera Repair': 'Front & rear camera modules — Samsung, iPhone, Chinese brands',
  'Software & Data Recovery': 'All smartphones — flash, unlock, data backup',
  'Water Damage Treatment': 'Emergency liquid damage — model diagnosis required first',
};

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

for (const product of data.products) {
  product.image = PRODUCT_IMAGES[product.id] || CATEGORY_IMAGES[product.category] || CATEGORY_IMAGES.Accessories;
}

for (const service of data.repair_services) {
  service.supported_models = REPAIR_SUPPORTED[service.name] || 'All major brands';
}

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

console.log(`✓ ${data.products.length} product images updated`);
console.log(`✓ ${data.repair_services.length} repair services got model lists`);
