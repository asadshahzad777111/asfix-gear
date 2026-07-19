import { useId } from 'react';

/**
 * Right-edge peek helper — face + one waving hand toward the page.
 * Compact variant for the open-panel header.
 */
export default function ChatHelperMascot({ className = '', variant = 'peek' }) {
  const uid = useId().replace(/:/g, '');
  const headId = `chatHelperHead-${uid}`;
  const sleeveId = `chatHelperSleeve-${uid}`;

  if (variant === 'compact') {
    return (
      <svg
        className={className}
        viewBox="0 0 64 64"
        width="64"
        height="64"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="32" cy="30" r="18" fill={`url(#${headId})`} />
        <path
          d="M14 30c0-11 8-18 18-18s18 7 18 18"
          fill="none"
          stroke="#1a120e"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="10" y="27" width="7" height="11" rx="3.5" fill="#ff6a2b" />
        <rect x="47" y="27" width="7" height="11" rx="3.5" fill="#ff6a2b" />
        <circle cx="25" cy="30" r="2.3" fill="#1a120e" />
        <circle cx="39" cy="30" r="2.3" fill="#1a120e" />
        <path
          d="M25 37c2.4 2.6 11.6 2.6 14 0"
          fill="none"
          stroke="#1a120e"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line x1="32" y1="12" x2="32" y2="6" stroke="#1a120e" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="32" cy="4.5" r="2.5" fill="#ff6a2b" />
        <defs>
          <linearGradient id={headId} x1="14" y1="12" x2="50" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffe0cc" />
            <stop offset="1" stopColor="#ffc49a" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  /* Peek from the RIGHT: face + one hand into the screen; rest stays off-edge */
  return (
    <svg
      className={className}
      viewBox="0 0 72 86"
      width="72"
      height="86"
      aria-hidden="true"
      focusable="false"
    >
      {/* Shoulder stub (mostly clipped off-screen on the right) */}
      <path
        d="M40 68c4-12 14-18 28-16v28c-10 2-20 0-28-4V68z"
        fill={`url(#${sleeveId})`}
      />

      {/* One hand waving into the page (left of face) */}
      <g className="chat-helper-hand chat-helper-hand--wave">
        <path
          d="M22 54c-8-6-10-16-4-22 2.5-2.5 6.5-2 8.5 0.5L38 46c2.2 2.4 1.8 6.2-.8 8.2-2.6 2-6.4 1.4-8.4-1L22 54z"
          fill={`url(#${sleeveId})`}
        />
        <circle cx="16" cy="34" r="8" fill={`url(#${headId})`} />
        <path
          d="M12 30.5c1.4-2.2 4.4-2.6 5.6-.4"
          fill="none"
          stroke="#e08a55"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      {/* Face — sits near left of this SVG so it stays on-screen when peeking from right */}
      <circle cx="44" cy="36" r="19" fill={`url(#${headId})`} />
      <path
        d="M25 36c0-12 8.5-19 19-19s19 7 19 19"
        fill="none"
        stroke="#1a120e"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <rect x="21" y="32" width="7.5" height="11" rx="3.8" fill="#ff6a2b" />
      <rect x="60" y="32" width="7.5" height="11" rx="3.8" fill="#ff6a2b" />

      <circle cx="37" cy="36" r="2.5" fill="#1a120e" />
      <circle cx="51" cy="36" r="2.5" fill="#1a120e" />
      <circle cx="38.1" cy="34.9" r="0.65" fill="#fff" />
      <circle cx="52.1" cy="34.9" r="0.65" fill="#fff" />
      <path
        d="M37 44c2.8 2.8 12.2 2.8 15 0"
        fill="none"
        stroke="#1a120e"
        strokeWidth="2.1"
        strokeLinecap="round"
      />

      <line x1="44" y1="17" x2="44" y2="9" stroke="#1a120e" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="44" cy="7" r="2.8" fill="#ff6a2b" />

      <defs>
        <linearGradient id={headId} x1="25" y1="14" x2="63" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe4d2" />
          <stop offset="1" stopColor="#ffc49a" />
        </linearGradient>
        <linearGradient id={sleeveId} x1="16" y1="40" x2="68" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8a4c" />
          <stop offset="1" stopColor="#e04e00" />
        </linearGradient>
      </defs>
    </svg>
  );
}
