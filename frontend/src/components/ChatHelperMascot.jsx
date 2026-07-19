import { useId } from 'react';

/** Friendly repair-helper figure for the side chat trigger. */
export default function ChatHelperMascot({ className = '' }) {
  const uid = useId().replace(/:/g, '');
  const bodyId = `chatHelperBody-${uid}`;
  const headId = `chatHelperHead-${uid}`;

  return (
    <svg
      className={className}
      viewBox="0 0 72 88"
      width="72"
      height="88"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="36" cy="82" rx="18" ry="4" fill="rgba(0,0,0,0.18)" />
      <path
        d="M22 44c0-2.5 2-4.5 4.5-4.5h19c2.5 0 4.5 2 4.5 4.5v22c0 5-4 9-9 9H31c-5 0-9-4-9-9V44z"
        fill={`url(#${bodyId})`}
      />
      <path
        d="M20 48c-5 1-8 5-7 9 1 3 4 4 7 3"
        fill="none"
        stroke="#ff8a4c"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M52 48c5 1 8 5 7 9-1 3-4 4-7 3"
        fill="none"
        stroke="#ff8a4c"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="36" cy="28" r="16" fill={`url(#${headId})`} />
      <path
        d="M20 28c0-10 7-16 16-16s16 6 16 16"
        fill="none"
        stroke="#1a120e"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <rect x="16" y="26" width="7" height="10" rx="3.5" fill="#ff6a2b" />
      <rect x="49" y="26" width="7" height="10" rx="3.5" fill="#ff6a2b" />
      <circle cx="30" cy="28" r="2.2" fill="#1a120e" />
      <circle cx="42" cy="28" r="2.2" fill="#1a120e" />
      <path
        d="M30 35c2.2 2.4 9.8 2.4 12 0"
        fill="none"
        stroke="#1a120e"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line x1="36" y1="12" x2="36" y2="6" stroke="#1a120e" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="36" cy="4.5" r="2.6" fill="#ff6a2b" />
      <circle cx="36" cy="56" r="5.5" fill="#fff6f0" opacity="0.92" />
      <path
        d="M33.2 56.2h2.2l.8-2.4.8 2.4h2.2l-1.8 1.4.7 2.2-1.9-1.3-1.9 1.3.7-2.2z"
        fill="#ff6a2b"
      />
      <defs>
        <linearGradient id={bodyId} x1="22" y1="40" x2="54" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8a4c" />
          <stop offset="1" stopColor="#e04e00" />
        </linearGradient>
        <linearGradient id={headId} x1="20" y1="14" x2="52" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe0cc" />
          <stop offset="1" stopColor="#ffc49a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
