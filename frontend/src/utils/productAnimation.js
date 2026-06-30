export function getProductAnimKind(category = '') {
  const c = String(category).toLowerCase();
  if (c.includes('gaming')) return 'gaming';
  if (c.includes('charger') || c.includes('cable') || c.includes('power bank')) return 'charger';
  if (c.includes('pouch') || c.includes('sleeve') || c.includes('flip')) return 'pouch';
  if (c.includes('case') || c.includes('cover')) return 'case';
  return 'default';
}

export const CASE_PREVIEW_COLORS = [
  { id: 'obsidian', label: 'Obsidian', bg: '#0f0f14', accent: '#ff6b2c' },
  { id: 'arctic', label: 'Arctic', bg: '#e8eef5', accent: '#3b82f6' },
  { id: 'forest', label: 'Forest', bg: '#0d1f17', accent: '#00f5d4' },
  { id: 'royal', label: 'Royal', bg: '#1a1030', accent: '#a855f7' },
  { id: 'sunset', label: 'Sunset', bg: '#2a1208', accent: '#fb923c' },
];
