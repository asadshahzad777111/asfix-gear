/** Default home hero slides — shown when no custom admin ads are saved. */
export const DEFAULT_HERO_SLIDES = [
  {
    id: 'cases',
    image:
      'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=1400&h=900&fit=crop&q=80',
    title: 'Cases & Screen Guards',
    subtitle: 'Premium protection — Lahore shop, WhatsApp orders welcome.',
    href: '/shop?category=Cases',
    titleKey: 'home.heroSlide1Title',
    subKey: 'home.heroSlide1Sub',
  },
  {
    id: 'chargers',
    image:
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1400&h=900&fit=crop&q=80',
    title: 'Fast Chargers & Adapters',
    subtitle: 'Genuine charging gear — Lahore delivery.',
    href: '/shop?category=Chargers',
    titleKey: 'home.heroSlide2Title',
    subKey: 'home.heroSlide2Sub',
  },
  {
    id: 'guards',
    image:
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1400&h=900&fit=crop&q=80',
    title: 'Expert Phone Repair',
    subtitle: 'Screens, batteries, boards — quote on WhatsApp after diagnosis.',
    href: '/shop?category=Screen%20Guards',
    titleKey: 'home.heroSlide3Title',
    subKey: 'home.heroSlide3Sub',
  },
];

export function defaultHeroSlidesForAdmin() {
  return DEFAULT_HERO_SLIDES.map((s) => ({
    image: s.image,
    title: s.title,
    subtitle: s.subtitle,
    href: s.href,
    product_id: null,
    source: 'default',
  }));
}
