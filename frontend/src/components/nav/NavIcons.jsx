/** Consistent outline icons for the diagnostic header — muted stroke, no accent fill */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconSearch({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function IconShop({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  );
}

export function IconUser({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c1.5-3.2 4-4.8 6.5-4.8s5 1.6 6.5 4.8" />
    </svg>
  );
}

export function IconHeart({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" />
    </svg>
  );
}

export function IconCart({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M3.5 5h2l1.6 9.2a1.5 1.5 0 0 0 1.5 1.3h7.8a1.5 1.5 0 0 0 1.5-1.2L19.5 8H7" />
      <circle cx="9.5" cy="19" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconWhatsApp({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.82c0 1.96.52 3.86 1.51 5.54L2 22l4.8-1.57a9.9 9.9 0 0 0 5.24 1.43h.01c5.46 0 9.89-4.4 9.89-9.82C21.94 6.4 17.5 2 12.04 2zm5.75 13.9c-.24.67-1.4 1.23-1.93 1.31-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.78-4.17-4.93-4.36-.14-.2-1.2-1.6-1.2-3.05 0-1.46.76-2.17 1.03-2.47.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.24.6.82 2.07.89 2.22.07.15.12.32.02.52-.1.2-.15.32-.29.5-.15.17-.3.38-.43.51-.14.14-.29.3-.12.58.17.29.75 1.24 1.61 2.01 1.11.99 2.04 1.3 2.33 1.44.29.15.46.12.63-.07.17-.2.72-.84.91-1.13.2-.29.39-.24.66-.14.27.1 1.72.81 2.02.96.29.14.49.22.56.34.07.12.07.7-.17 1.37z"
      />
    </svg>
  );
}
