/**
 * Rule-based intent engine for the on-site AsFix Assistant chat widget.
 * No external AI API — keeps this free to run and 100% grounded in real
 * shop data (products, orders, repair pricing) instead of hallucinating
 * answers. Anything it can't confidently answer routes to the real
 * Contact/WhatsApp flow, same as every other "talk to us" entry point.
 */

const ORDER_ID_RE = /\bASF[-\s]?(\d{3,6})\b/i;
const PHONE_RE = /(?:\+?92|0)3\d{9}\b/;

const GREETING_RE = /\b(hi|hello|hey|salam|assalam|asalam|aoa|yo|hy)\b/i;
const THANKS_RE = /\b(thanks|thank you|thanx|shukriya|shukria)\b/i;
const TRACK_RE = /\b(track|tracking|order status|mera order|order kahan|where.*order)\b/i;
const REPAIR_RE = /\b(repair|screen|battery|touch|kharab|toot|fix|charging port|water damage|dead mobile)\b/i;
const HOURS_RE = /\b(hour|hours|timing|time|open|close|khul|band|kab)\b/i;
const LOCATION_RE = /\b(address|location|kahan|kidhar|map|pata|shop\s*kahan|visit)\b/i;
const HUMAN_RE = /\b(human|agent|staff|real person|insaan|representative|baat karni|talk to|complaint|shikayat)\b/i;
const PRODUCT_RE = /\b(case|cover|charger|cable|powerbank|power bank|screen guard|protector|headphone|earphone|buy|kharidna|chahiye|dhoond|product|price of|kitne ka)\b/i;

/**
 * @param {string} rawText
 * @returns {'greeting'|'thanks'|'track'|'repair'|'hours'|'location'|'human'|'product'|'unknown'}
 */
export function detectIntent(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return 'unknown';

  if (TRACK_RE.test(text)) return 'track';
  if (REPAIR_RE.test(text)) return 'repair';
  if (HOURS_RE.test(text)) return 'hours';
  if (LOCATION_RE.test(text)) return 'location';
  if (HUMAN_RE.test(text)) return 'human';
  if (PRODUCT_RE.test(text)) return 'product';
  if (GREETING_RE.test(text)) return 'greeting';
  if (THANKS_RE.test(text)) return 'thanks';
  return 'unknown';
}

/** Extracts `{ orderId, phone }` from free text, or null if either is missing. */
export function parseOrderTrackInfo(rawText) {
  const text = String(rawText || '');
  const idMatch = text.match(ORDER_ID_RE);
  const phoneMatch = text.match(PHONE_RE);
  if (!idMatch || !phoneMatch) return null;
  return {
    orderId: `ASF-${idMatch[1]}`,
    phone: phoneMatch[0],
  };
}
