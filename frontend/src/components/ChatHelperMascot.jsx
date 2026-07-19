import { useId } from 'react';

/**
 * Peeking helper — face + both hands (wave).
 * Bust is biased toward the right of the viewBox so a half-peek still shows both hands.
 */
export default function ChatHelperMascot({ className = '', variant = 'bust' }) {
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

  return (
    <svg
      className={className}
      viewBox="0 0 110 100"
      width="110"
      height="100"
      aria-hidden="true"
      focusable="false"
    >
      {/* Content sits in x≈20–108 so left peek still keeps both hands on-screen */}
      <ellipse cx="68" cy="94" rx="22" ry="4" fill="rgba(0,0,0,0.14)" />

      <g className="chat-helper-hand chat-helper-hand--left">
        <path
          d="M30 58c-6-8-4-18 4-22 3-1.5 6 0 7 3l6 14c1.2 2.8-.4 6-3.4 7.2-3 1.2-6.4-.2-7.6-3.2L30 58z"
          fill={`url(#${sleeveId})`}
        />
        <circle cx="26" cy="40" r="7.5" fill={`url(#${headId})`} />
        <path d="M22 36.5c1.2-2 4-2.4 5.2-.4" fill="none" stroke="#e08a55" strokeWidth="1.4" strokeLinecap="round" />
      </g>

      <g className="chat-helper-hand chat-helper-hand--right">
        <path
          d="M90 52c7-7 8-17 2-23-2.5-2.5-6-2-8 0L74 42c-2.4 2.2-2.2 5.8.4 7.8 2.6 2 6.2 1.4 8.2-1.2L90 52z"
          fill={`url(#${sleeveId})`}
        />
        <circle cx="96" cy="32" r="7.5" fill={`url(#${headId})`} />
        <path d="M92 28.5c1.2-2 4-2.4 5.2-.4" fill="none" stroke="#e08a55" strokeWidth="1.4" strokeLinecap="round" />
      </g>

      <path
        d="M40 72c2-10 10-16 20-16s18 6 20 16v10c0 4-4 8-10 8H50c-6 0-10-4-10-8V72z"
        fill={`url(#${sleeveId})`}
      />
      <ellipse cx="60" cy="62" rx="11" ry="5" fill="#fff6f0" opacity="0.35" />

      <circle cx="60" cy="38" r="20" fill={`url(#${headId})`} />

      <path
        d="M40 38c0-12 9-20 20-20s20 8 20 20"
        fill="none"
        stroke="#1a120e"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <rect x="35" y="34" width="8" height="12" rx="4" fill="#ff6a2b" />
      <rect x="77" y="34" width="8" height="12" rx="4" fill="#ff6a2b" />

      <circle cx="52" cy="38" r="2.6" fill="#1a120e" />
      <circle cx="68" cy="38" r="2.6" fill="#1a120e" />
      <circle cx="53.2" cy="36.8" r="0.7" fill="#fff" />
      <circle cx="69.2" cy="36.8" r="0.7" fill="#fff" />
      <path
        d="M52 46c3 3.2 13 3.2 16 0"
        fill="none"
        stroke="#1a120e"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      <line x1="60" y1="18" x2="60" y2="10" stroke="#1a120e" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="60" cy="8" r="3" fill="#ff6a2b" />

      <defs>
        <linearGradient id={headId} x1="40" y1="16" x2="80" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe4d2" />
          <stop offset="1" stopColor="#ffc49a" />
        </linearGradient>
        <linearGradient id={sleeveId} x1="40" y1="48" x2="84" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8a4c" />
          <stop offset="1" stopColor="#e04e00" />
        </linearGradient>
      </defs>
    </svg>
  );
}
