import * as store from './store.js';

const productCount = store.countProducts();
const serviceCount = store.countRepairServices();

if (productCount === 0) {
  const products = [
    {
      name: 'Premium Silicone Case',
      category: 'Cases',
      price: 899,
      description: 'Soft-touch silicone case with raised edges for screen protection. Fits snugly and resists yellowing.',
      image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop',
      stock: 45,
      featured: 1,
    },
    {
      name: 'Tempered Glass Screen Guard',
      category: 'Screen Guards',
      price: 499,
      description: '9H hardness tempered glass with oleophobic coating. Bubble-free installation kit included.',
      image: 'https://images.unsplash.com/photo-1585790050230-5dd28404fcb9?w=600&h=600&fit=crop',
      stock: 80,
      featured: 1,
    },
    {
      name: '65W Fast Charger',
      category: 'Chargers',
      price: 2499,
      description: 'GaN technology fast charger with USB-C PD support. Charges most phones to 50% in 30 minutes.',
      image: 'https://images.unsplash.com/photo-1583394290456-38d677e27651?w=600&h=600&fit=crop&q=80',
      stock: 30,
      featured: 1,
    },
    {
      name: 'Wireless Earbuds Pro',
      category: 'Audio',
      price: 3499,
      description: 'Active noise cancellation, 30-hour battery with case, IPX5 water resistance.',
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop',
      stock: 22,
      featured: 1,
    },
    {
      name: 'MagSafe Power Bank 10000mAh',
      category: 'Power Banks',
      price: 3999,
      description: 'Magnetic wireless charging power bank. USB-C in/out, LED battery indicator.',
      image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop',
      stock: 18,
      featured: 0,
    },
    {
      name: 'USB-C Braided Cable 2m',
      category: 'Cables',
      price: 699,
      description: 'Durable nylon braided cable supporting 100W PD and 480Mbps data transfer.',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop',
      stock: 60,
      featured: 0,
    },
    {
      name: 'Car Phone Mount',
      category: 'Accessories',
      price: 1299,
      description: 'Dashboard suction mount with 360° rotation. One-hand release mechanism.',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop',
      stock: 35,
      featured: 0,
    },
    {
      name: 'Leather Flip Cover',
      category: 'Cases',
      price: 1599,
      description: 'Genuine leather flip case with card slot and stand function. Premium finish.',
      image: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=600&h=600&fit=crop',
      stock: 25,
      featured: 0,
    },
  ];

  store.insertProducts(products);
  console.log(`Seeded ${products.length} products.`);
}

if (serviceCount === 0) {
  const services = [
    {
      name: 'Screen Replacement',
      description: 'Original-quality LCD/OLED screen replacement for all major brands.',
      price_from: 0,
      duration: '1-2 hours',
      icon: '📱',
      supported_models: 'iPhone, Samsung, Xiaomi, Oppo, Vivo, Infinix, Tecno — LCD & OLED models',
    },
    {
      name: 'Battery Replacement',
      description: 'Genuine-grade battery swap to restore full-day battery life.',
      price_from: 0,
      duration: '30-60 min',
      icon: '🔋',
      supported_models: 'All major Android & iPhone models — capacity matched to device',
    },
    {
      name: 'Charging Port Repair',
      description: 'Fix loose or damaged charging ports, water damage cleaning included.',
      price_from: 0,
      duration: '1-3 hours',
      icon: '🔌',
      supported_models: 'Type-C, Micro-USB & Lightning ports — most brands',
    },
    {
      name: 'Camera Repair',
      description: 'Front/rear camera module replacement and lens cleaning.',
      price_from: 0,
      duration: '1-2 hours',
      icon: '📷',
      supported_models: 'Front & rear camera modules — Samsung, iPhone, Chinese brands',
    },
    {
      name: 'Software & Data Recovery',
      description: 'OS reinstall, virus removal, and data recovery from damaged devices.',
      price_from: 0,
      duration: '2-4 hours',
      icon: '💾',
      supported_models: 'All smartphones — flash, unlock, data backup',
    },
    {
      name: 'Water Damage Treatment',
      description: 'Ultrasonic cleaning and component-level repair for liquid damage.',
      price_from: 0,
      duration: '24-48 hours',
      icon: '💧',
      supported_models: 'Emergency liquid damage — model diagnosis required first',
    },
  ];

  store.insertRepairServices(services);
  console.log(`Seeded ${services.length} repair services.`);
}

console.log('Data seed complete (data.json).');
