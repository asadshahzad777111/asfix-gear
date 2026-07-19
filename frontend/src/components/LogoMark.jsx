/** Shared AsFix & Gear icon mark — phone + gear + wrench (matches brand orange). */
export const BRAND_ACCENT = '#ff6a2b';
export const BRAND_WHITE = '#ffffff';

export function LogoMarkPaths({ uid = 'logo' }) {
  const grad = `${uid}-grad`;

  return (
    <>
      <defs>
        <linearGradient id={grad} x1="20" y1="16" x2="100" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8a4c" />
          <stop offset="0.55" stopColor={BRAND_ACCENT} />
          <stop offset="1" stopColor="#e85a1a" />
        </linearGradient>
      </defs>

      {/* Phone body */}
      <rect
        x="28"
        y="18"
        width="44"
        height="84"
        rx="8"
        fill="none"
        stroke={`url(#${grad})`}
        strokeWidth="5.5"
      />
      {/* Speaker notch */}
      <rect x="42" y="26" width="16" height="3.5" rx="1.75" fill={`url(#${grad})`} />
      {/* Home indicator */}
      <rect x="44" y="90" width="12" height="3" rx="1.5" fill={`url(#${grad})`} opacity="0.85" />

      {/* Gear overlapping phone (right) */}
      <g transform="translate(78 62)">
        <path
          d="M0 -26 L5.2 -18.4 L14.2 -19.6 L16.4 -10.8 L25.2 -8.4 L22.8 0.4 L28.8 7.2 L22.8 14 L25.2 22.4 L16.4 24.8 L14.2 33.6 L5.2 32.4 L0 40 L-5.2 32.4 L-14.2 33.6 L-16.4 24.8 L-25.2 22.4 L-22.8 14 L-28.8 7.2 L-22.8 0.4 L-25.2 -8.4 L-16.4 -10.8 L-14.2 -19.6 L-5.2 -18.4 Z"
          fill={`url(#${grad})`}
        />
        <circle r="12.5" fill="#12121a" />
      </g>

      {/* Wrench in gear hub */}
      <g transform="translate(78 62) rotate(-35)">
        <path
          d="M-3.2 -11.5 C-6.8 -11.5 -9.5 -8.6 -9.5 -5.1 C-9.5 -3.2 -8.6 -1.5 -7.2 -0.4 L7.8 14.2 C8.7 15.1 10.1 15.1 11 14.2 L13.6 11.6 C14.5 10.7 14.5 9.3 13.6 8.4 L-0.8 -5.6 C-1.9 -7 -3.2 -7.6 -3.2 -11.5 Z"
          fill={BRAND_WHITE}
        />
        <circle cx="-5.8" cy="-5.4" r="2.6" fill="#12121a" />
        <circle cx="-5.8" cy="-5.4" r="4.6" fill="none" stroke={BRAND_WHITE} strokeWidth="2.2" />
      </g>
    </>
  );
}
