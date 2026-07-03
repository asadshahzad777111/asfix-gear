/** Normalize search text: lowercase, strip accents/punctuation, collapse spaces. */
export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

function typoThreshold(wordLen) {
  if (wordLen <= 3) return 0;
  if (wordLen <= 5) return 1;
  if (wordLen <= 8) return 2;
  return 3;
}

function wordMatchesQuery(queryWord, haystackWords) {
  if (!queryWord) return true;
  if (queryWord.length === 1) {
    return haystackWords.some((w) => w.startsWith(queryWord));
  }

  for (const word of haystackWords) {
    if (word.includes(queryWord) || queryWord.includes(word)) return true;
    if (queryWord.length >= 3 && word.length >= 3) {
      const dist = levenshtein(queryWord, word);
      if (dist <= typoThreshold(Math.min(queryWord.length, word.length))) return true;
    }
  }
  return false;
}

/** Fields scanned for shop/nav product search. */
export function productSearchHaystack(product) {
  return normalizeSearchText(
    [
      product.name,
      product.brand,
      product.category,
      product.compatible_models,
      product.description,
      product.warranty,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

/** Typo-tolerant match: full phrase, then each query word against name/brand/model/etc. */
export function productMatchesSearch(product, rawSearch) {
  const term = normalizeSearchText(rawSearch);
  if (!term) return true;

  const haystack = productSearchHaystack(product);
  if (!haystack) return false;
  if (haystack.includes(term)) return true;

  const queryWords = term.split(' ').filter(Boolean);
  const haystackWords = haystack.split(' ').filter(Boolean);
  return queryWords.every((qw) => wordMatchesQuery(qw, haystackWords));
}
