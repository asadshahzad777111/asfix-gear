/** Shared storefront page / list motion tokens (Framer Motion). Orange brand — no aurora. */

export const PAGE_EASE = [0.22, 1, 0.36, 1];

export const pageEnter = {
  opacity: 0,
  y: 10,
};

export const pageCenter = {
  opacity: 1,
  y: 0,
};

export const pageExit = {
  opacity: 0,
  y: -6,
};

export const pageTransition = {
  duration: 0.22,
  ease: PAGE_EASE,
};

/** Touch / coarse: opacity only — avoids transform fight with scroll. */
export const pageEnterMobile = { opacity: 0 };
export const pageCenterMobile = { opacity: 1 };
export const pageExitMobile = { opacity: 0 };
export const pageTransitionMobile = {
  duration: 0.18,
  ease: 'easeOut',
};

export const listItemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
};

export const listItemTransition = {
  duration: 0.28,
  ease: PAGE_EASE,
};

export const emptyStateVariants = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
};

export const emptyStateTransition = {
  duration: 0.35,
  ease: PAGE_EASE,
};

export const lightboxBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const lightboxImage = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

/** Staff / POS / thermal — never animate route shell. */
export function shouldSkipPageMotion(pathname = '') {
  if (!pathname) return true;
  if (pathname.startsWith('/pos')) return true;
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/counter')) return true;
  if (pathname === '/login') return true;
  return false;
}

export function isCoarsePointer() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}
