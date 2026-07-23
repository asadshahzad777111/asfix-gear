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

export function IconHome({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4.5 11.2 12 4.8l7.5 6.4" />
      <path d="M7 10.8V19a1 1 0 0 0 1 1h3.2v-4.2h1.6V20H16a1 1 0 0 0 1-1v-8.2" />
    </svg>
  );
}

export function IconHomeFilled({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.4 4.35a1 1 0 0 1 1.2 0l7.2 5.7a1 1 0 0 1 .35.76V19a1.5 1.5 0 0 1-1.5 1.5h-4.1a.9.9 0 0 1-.9-.9v-4.1h-2.5v4.1a.9.9 0 0 1-.9.9H5.75A1.5 1.5 0 0 1 4.25 19v-8.19a1 1 0 0 1 .35-.76l6.8-5.7Z"
      />
    </svg>
  );
}

export function IconClose({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  );
}

export function IconMail({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7.5 7.5 6 7.5-6" />
    </svg>
  );
}

export function IconNavDots({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="6" r="1.65" fill="currentColor" />
      <circle cx="12" cy="12" r="1.65" fill="currentColor" />
      <circle cx="12" cy="18" r="1.65" fill="currentColor" />
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

/** Hover morph — open bag */
export function IconShopBag({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M6.5 8.5h11l-.9 10.2a1.6 1.6 0 0 1-1.6 1.4H9a1.6 1.6 0 0 1-1.6-1.4L6.5 8.5Z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
      <path d="M10 12.5h4" />
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

export function IconUserFilled({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" fill="currentColor" />
      <path
        fill="currentColor"
        d="M5.2 19.8c1.4-3.4 3.9-5.1 6.8-5.1s5.4 1.7 6.8 5.1c.2.4 0 .9-.5.9H5.7c-.5 0-.7-.5-.5-.9Z"
      />
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

export function IconHeartFilled({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 20.4S4.2 15.6 4.2 9.7A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.8 2.5c0 5.9-7.8 10.7-7.8 10.7z"
      />
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

export function IconCartReady({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M3.5 5h2l1.6 9.2a1.5 1.5 0 0 0 1.5 1.3h7.8a1.5 1.5 0 0 0 1.5-1.2L19.5 8H7" />
      <path d="M9.2 12.2l1.7 1.7 3.4-3.5" />
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

/** Outline WA-style bubble for idle morph face */
export function IconWhatsAppOutline({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 3.5a8.3 8.3 0 0 0-7.1 12.5L4 20.5l4.7-1.2A8.3 8.3 0 1 0 12 3.5Z" />
      <path d="M9.2 10.2c.9 2.1 2.5 3.5 4.6 4.2" />
    </svg>
  );
}

export function IconSettings({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3.6v2.1M12 18.3v2.1M3.6 12h2.1M18.3 12h2.1M6.1 6.1l1.5 1.5M16.4 16.4l1.5 1.5M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5" />
    </svg>
  );
}

export function IconSettingsSpin({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" />
      <path d="M12 2.8v1.8M12 19.4v1.8M2.8 12h1.8M19.4 12h1.8M5.4 5.4l1.3 1.3M17.3 17.3l1.3 1.3M18.6 5.4l-1.3 1.3M6.7 17.3l-1.3 1.3" />
    </svg>
  );
}

export function IconRepair({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function IconRepairBolt({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.2 2.4 7.1 13.1c-.2.3 0 .7.4.7h4.1l-1.2 7.6c-.1.5.6.8.9.4l6.8-11.2c.2-.3 0-.7-.4-.7h-4.2l1.1-7c.1-.5-.6-.8-.9-.3Z"
      />
    </svg>
  );
}

/** Chat assistant — distinct from WhatsApp fill icon */
export function IconChat({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H12l-3.2 2.7a.6.6 0 0 1-1 .4V15H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" />
      <path d="M8.5 9h7M8.5 12h4.5" />
    </svg>
  );
}
