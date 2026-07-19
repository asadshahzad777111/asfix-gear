/**
 * Stagger delay for product grid scroll reveals — row-first (top → bottom),
 * then across the line, similar to a cascade as you scroll.
 */
export function getProductGridCols(viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024) {
  if (viewportWidth <= 480) return 1;
  if (viewportWidth <= 1024) return 2;
  /* auto-fill minmax(260px) inside ~container */
  const container = Math.min(1120, viewportWidth - 48);
  return Math.max(2, Math.floor(container / 280));
}

export function getProductRevealDelay(index, cols = getProductGridCols()) {
  const safeCols = Math.max(1, cols);
  const row = Math.floor(Math.max(0, index) / safeCols);
  const col = Math.max(0, index) % safeCols;
  /* Cap so deep lists don't wait forever */
  const rowDelay = Math.min(row, 8) * 130;
  const colDelay = col * 60;
  return rowDelay + colDelay;
}
