import * as store from './store.js';

const gamingCount = store.countProductsByCategory('Gaming');

if (gamingCount === 0) {
  const gamingProducts = [
    {
      name: 'PUBG Mobile Trigger Controller (Pair)',
      category: 'Gaming',
      price: 899,
      description: 'Physical L+R triggers for PUBG, Free Fire & COD Mobile. Zero delay, plug & play — chicken dinner ready.',
      image: 'https://images.unsplash.com/photo-1612287230202-1ff1d85c1bdf?w=600&h=600&fit=crop',
      stock: 50,
      featured: 1,
      discount_percent: 10,
    },
    {
      name: 'Pro Gaming Thumb Grips (6 Pack)',
      category: 'Gaming',
      price: 499,
      description: 'Anti-slip thumb grips for precise aim in PUBG. Sweat-proof, universal fit for all phones.',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=600&fit=crop',
      stock: 80,
      featured: 1,
      discount_percent: 0,
    },
    {
      name: 'RGB Phone Cooling Fan',
      category: 'Gaming',
      price: 1999,
      description: 'Clip-on turbo cooler with RGB lights. No lag during long PUBG sessions — phone stays cool.',
      image: 'https://images.unsplash.com/photo-1593305843771-9f83c2aeda4f?w=600&h=600&fit=crop',
      stock: 25,
      featured: 1,
      discount_percent: 15,
    },
    {
      name: 'Gaming Finger Sleeves (4 Pack)',
      category: 'Gaming',
      price: 399,
      description: 'Breathable finger sleeves for smooth swipe & claw grip. PUBG pro players ka favourite.',
      image: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=600&h=600&fit=crop',
      stock: 100,
      featured: 0,
      discount_percent: 0,
    },
    {
      name: 'Low Latency Gaming Earbuds',
      category: 'Gaming',
      price: 2999,
      description: '45ms ultra-low latency mode for PUBG footsteps & gunshots. USB-C gaming dongle included.',
      image: 'https://images.unsplash.com/photo-1598331668826-3c408fb35c19?w=600&h=600&fit=crop',
      stock: 30,
      featured: 1,
      discount_percent: 0,
    },
    {
      name: '6-Finger Claw Gaming Case',
      category: 'Gaming',
      price: 1499,
      description: 'Ergonomic case with raised edges for claw grip gaming. PUBG & Free Fire ke liye perfect hold.',
      image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop',
      stock: 35,
      featured: 0,
      discount_percent: 20,
    },
    {
      name: 'Mobile Gaming Headset with Mic',
      category: 'Gaming',
      price: 2499,
      description: 'Team chat clear, surround sound for PUBG squad mode. Comfortable for marathon gaming.',
      image: 'https://images.unsplash.com/photo-1599669454699-248893623440?w=600&h=600&fit=crop',
      stock: 20,
      featured: 0,
      discount_percent: 0,
    },
    {
      name: 'PUBG Style RGB Phone Stand',
      category: 'Gaming',
      price: 1299,
      description: 'Adjustable gaming stand with RGB base. Stream, record & play PUBG hands-free.',
      image: 'https://images.unsplash.com/photo-1587825140708-aa577f6e947e?w=600&h=600&fit=crop',
      stock: 28,
      featured: 0,
      discount_percent: 0,
    },
    {
      name: 'Universal Gaming Joystick',
      category: 'Gaming',
      price: 799,
      description: 'Suction joystick for smooth movement control in PUBG Mobile. No screen obstruction.',
      image: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=600&fit=crop',
      stock: 45,
      featured: 0,
      discount_percent: 5,
    },
    {
      name: 'Gaming Phone Holder + Trigger Combo',
      category: 'Gaming',
      price: 1799,
      description: 'All-in-one PUBG kit: triggers + rotatable holder. Best value gaming starter pack.',
      image: 'https://images.unsplash.com/photo-1538488889696-7961cb780c98?w=600&h=600&fit=crop',
      stock: 22,
      featured: 1,
      discount_percent: 0,
    },
  ];

  store.insertProducts(gamingProducts);
  console.log(`Seeded ${gamingProducts.length} gaming products.`);
} else {
  console.log(`Gaming products already exist (${gamingCount}). Skipping.`);
}
