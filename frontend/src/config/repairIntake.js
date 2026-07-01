import { buildContactPath, buildContactPrefill } from '../utils/contactPrefill';
import { REPAIR_DEVICE_BRANDS } from './repairModels';

/**
 * Repair booking form brand/model dropdown — derived from the same
 * `REPAIR_DEVICE_BRANDS` catalog used by the Repair models panel and Shop
 * mega menu (`config/repairModels.js`), so the full device list only lives
 * in one place. `'Other model'` stays appended per brand for manual entry.
 */
export const DEVICE_BRANDS = Object.fromEntries(
  REPAIR_DEVICE_BRANDS.map((group) => [
    group.brand,
    [...group.series.flatMap((s) => s.models), 'Other model'],
  ])
);

export const REPAIR_ISSUE_OPTIONS = [
  { id: 'charging_port', label: 'Charging Port issue / Not charging', severity: 'standard' },
  { id: 'screen', label: 'Screen Cracked / Touch not working', severity: 'standard' },
  { id: 'battery', label: 'Battery draining fast / Swollen battery', severity: 'standard' },
  { id: 'water_damage', label: 'Water Damage / Dropped in water', severity: 'severe' },
  { id: 'suddenly_dead', label: 'Suddenly turned off / Suddenly Dead', severity: 'dead' },
  { id: 'sound', label: 'Sound / Speaker / Mic not working', severity: 'standard' },
  { id: 'software', label: 'Software loop / Logo hang / Bootloop', severity: 'standard' },
];

export const ESTIMATE_STANDARD = '1 to 2 Working Days.';
export const ESTIMATE_SEVERE = '5 to 7 Working Days (Diagnostic required).';
export const ESTIMATE_DEAD = '7 to 14 Working Days — board-level check; kisi wajah se zyada time lag sakta hai.';
export const ESTIMATE_DIAGNOSTIC = '5 to 7 Working Days (Diagnostic required).';

export const DEAD_MOBILE_POLICY = {
  title: 'Suddenly Dead / No Power — Important',
  points: [
    'Dead mobile ka masla kisi bhi wajah se ho — motherboard, IC, water, short — diagnose ke baad pata chalta hai.',
    'Is liye repair time normal se zyada lag sakta hai (7–14 working days ya us se bhi zyada).',
    'Suddenly dead / board-level repair par koi warranty nahi hoti — customer pehle se agree karta hai.',
    'Agar phone theek na ho paye to customer ko pehle bataya jata hai; parts/labour charges policy ke mutabiq hongi.',
  ],
};

export const SCREEN_QUALITY_TIERS = [
  {
    id: 'low',
    badge: 'Low',
    label: 'Low Quality Screen',
    description: 'Budget compatible screen — basic display, everyday use ke liye theek.',
    points: ['Normal brightness & touch', 'Compatible / aftermarket panel', 'Sab se kam rate'],
    warranty: '7 days screen warranty (dead mobile par apply nahi)',
  },
  {
    id: 'medium',
    badge: 'Medium',
    label: 'Medium Quality Screen',
    description: 'Balanced quality — achhi colors, smooth touch, zyada tar customers yahi choose karte hain.',
    points: ['Better colors & viewing angles', 'Reliable touch response', 'Best value for money'],
    warranty: '15 days screen warranty (dead mobile par apply nahi)',
  },
  {
    id: 'high',
    badge: 'High',
    label: 'High / Premium Screen',
    description: 'Premium grade — original jaisa feel, best brightness aur touch accuracy.',
    points: ['Premium OLED/LCD where available', 'Best brightness & true colors', 'Longest lasting panel'],
    warranty: '30 days screen warranty (dead mobile par apply nahi)',
  },
];

const TIER_MAP = Object.fromEntries(SCREEN_QUALITY_TIERS.map((t) => [t.id, t]));

export function getEstimatedRepairTime(issueTypes = [], issueOther = '') {
  const selected = REPAIR_ISSUE_OPTIONS.filter((o) => issueTypes.includes(o.id));
  if (selected.length === 0 && !issueOther.trim()) return null;

  if (selected.some((o) => o.severity === 'dead')) return ESTIMATE_DEAD;
  if (selected.some((o) => o.severity === 'severe')) return ESTIMATE_SEVERE;
  if (selected.length > 0) return ESTIMATE_STANDARD;
  return ESTIMATE_DIAGNOSTIC;
}

export function isDeadMobileIssue(issueTypes = []) {
  return issueTypes.includes('suddenly_dead');
}

export function isScreenIssue(issueTypes = []) {
  return issueTypes.includes('screen');
}

export function buildIssueSummary(issueTypes = [], issueOther = '', screenQuality = '') {
  const labels = REPAIR_ISSUE_OPTIONS.filter((o) => issueTypes.includes(o.id)).map((o) => o.label);
  const parts = [...labels];
  if (screenQuality && TIER_MAP[screenQuality]) {
    parts.push(`Screen quality preference: ${TIER_MAP[screenQuality].label}`);
  }
  if (issueOther.trim()) parts.push(`Other: ${issueOther.trim()}`);
  return parts.join(' | ') || issueOther.trim();
}

export function screenQualityContactPath(deviceLabel = '', tierId = 'medium') {
  return buildContactPath(buildContactPrefill({ type: 'screen-quality', deviceLabel, tierId }));
}
