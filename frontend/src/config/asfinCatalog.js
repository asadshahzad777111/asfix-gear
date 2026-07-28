/**
 * ASPLYWOOD / ASFIN custom-bill item suggestions (local catalog).
 * Type a few letters (e.g. LA) → pick Lamination / Lasani / etc.
 * Free typing still works if nothing matches.
 */

export const ASFIN_CATALOG = [
  { name: 'Lamination', keywords: ['la', 'lami', 'laminate', 'sheet'] },
  { name: 'Lamination sheet', keywords: ['la', 'lami', 'sheet'] },
  { name: 'Laminated board', keywords: ['la', 'lami', 'board'] },
  { name: 'Sunmica', keywords: ['sun', 'mica', 'lami'] },
  { name: 'Formica', keywords: ['form', 'lami'] },
  { name: 'Lasani', keywords: ['la', 'lasani', 'sheet'] },
  { name: 'Lasani sheet', keywords: ['la', 'lasani'] },
  { name: 'MDF', keywords: ['mdf', 'board'] },
  { name: 'MDF board', keywords: ['mdf', 'board'] },
  { name: 'MDF 16mm', keywords: ['mdf', '16'] },
  { name: 'MDF 18mm', keywords: ['mdf', '18'] },
  { name: 'Chipboard', keywords: ['chip', 'board'] },
  { name: 'Particle board', keywords: ['particle', 'board'] },
  { name: 'Plywood', keywords: ['ply', 'wood', 'board'] },
  { name: 'Commercial plywood', keywords: ['ply', 'commercial'] },
  { name: 'Marine plywood', keywords: ['ply', 'marine'] },
  { name: 'Block board', keywords: ['block', 'board'] },
  { name: 'Hardboard', keywords: ['hard', 'board'] },
  { name: 'Soft board', keywords: ['soft', 'board'] },
  { name: 'Flush door', keywords: ['flush', 'door'] },
  { name: 'PVC sheet', keywords: ['pvc', 'sheet'] },
  { name: 'Acrylic sheet', keywords: ['acrylic', 'sheet'] },
  { name: 'Gypsum board', keywords: ['gypsum', 'board'] },
  { name: 'Cement board', keywords: ['cement', 'board'] },
  { name: 'Edge banding', keywords: ['edge', 'band', 'tape'] },
  { name: 'Edge tape', keywords: ['edge', 'tape'] },
  { name: 'Trim', keywords: ['trim', 'bead'] },
  { name: 'Trim 17mm', keywords: ['trim', '17'] },
  { name: 'Beading', keywords: ['bead', 'trim', 'wood'] },
  { name: 'Wooden strip', keywords: ['strip', 'wood'] },
  { name: 'Cornice', keywords: ['cornice', 'mould'] },
  { name: 'Veneer', keywords: ['veneer'] },
  { name: 'Screw', keywords: ['screw', 'hardware'] },
  { name: 'Wood screw', keywords: ['screw', 'wood'] },
  { name: 'Nails', keywords: ['nail', 'hardware'] },
  { name: 'Nail', keywords: ['nail'] },
  { name: 'Bolt', keywords: ['bolt'] },
  { name: 'Nut', keywords: ['nut'] },
  { name: 'Washer', keywords: ['washer'] },
  { name: 'Dowel', keywords: ['dowel'] },
  { name: 'Bracket', keywords: ['bracket'] },
  { name: 'L-bracket', keywords: ['bracket', 'l'] },
  { name: 'Hinge', keywords: ['hinge'] },
  { name: 'Handle', keywords: ['handle', 'knob'] },
  { name: 'Lock', keywords: ['lock'] },
  { name: 'Drawer channel', keywords: ['drawer', 'channel', 'slide'] },
  { name: 'Fevicol', keywords: ['fevi', 'glue', 'adhesive'] },
  { name: 'White glue', keywords: ['glue', 'white', 'adhesive'] },
  { name: 'Packing', keywords: ['pack'] },
];

const HISTORY_KEY = 'asfix_asfin_item_history_v1';
const MAX_HISTORY = 40;
const MAX_SUGGESTIONS = 8;

function normalizeTerm(value) {
  return String(value || '').trim().toLowerCase();
}

/** Recent names typed/picked on ASPLYWOOD bills (local only). */
export function loadAsfinItemHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .map((name) => String(name || '').trim())
      .filter(Boolean)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function rememberAsfinItemName(name) {
  const clean = String(name || '').trim();
  if (!clean) return;
  try {
    const prev = loadAsfinItemHistory().filter(
      (n) => n.toLowerCase() !== clean.toLowerCase(),
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify([clean, ...prev].slice(0, MAX_HISTORY)));
  } catch {
    /* ignore quota */
  }
}

function catalogHaystack(item) {
  return [item.name, ...(item.keywords || [])].join(' ').toLowerCase();
}

/**
 * Filter catalog (+ optional history) by typed query.
 * Prefix hits rank above substring hits.
 */
export function filterAsfinCatalog(query, { limit = MAX_SUGGESTIONS, history = [] } = {}) {
  const term = normalizeTerm(query);
  if (term.length < 1) return [];

  const seen = new Set();
  const scored = [];

  const push = (name, score) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    scored.push({ name, score });
  };

  for (const name of history) {
    const lower = name.toLowerCase();
    if (lower.startsWith(term)) push(name, 300 + (100 - Math.min(99, lower.length)));
    else if (lower.includes(term)) push(name, 150);
  }

  for (const item of ASFIN_CATALOG) {
    const hay = catalogHaystack(item);
    const nameLower = item.name.toLowerCase();
    if (nameLower.startsWith(term)) {
      push(item.name, 280 + (100 - Math.min(99, nameLower.length)));
    } else if ((item.keywords || []).some((k) => String(k).toLowerCase().startsWith(term))) {
      push(item.name, 250);
    } else if (hay.includes(term)) {
      push(item.name, 120);
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name }) => ({ name }));
}
