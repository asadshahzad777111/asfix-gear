/** Shared AsFix & Gear icon mark — pink/white split gear + phone (matches shop card). */
export const BRAND_PINK = '#e91e8c';
export const BRAND_WHITE = '#ffffff';

export function LogoMarkPaths({ uid = 'logo' }) {
  const gear = `${uid}-gear`;
  const left = `${uid}-left`;
  const right = `${uid}-right`;

  return (
    <>
      <defs>
        <clipPath id={left}>
          <rect x="0" y="0" width="60" height="120" />
        </clipPath>
        <clipPath id={right}>
          <rect x="60" y="0" width="60" height="120" />
        </clipPath>
      </defs>

      {/* 8-tooth gear — left pink, right white */}
      <path
        id={gear}
        d="M60 8 L65.8 19.2 L77.8 16.8 L80.2 28.8 L92.2 31.2 L89.8 43.2 L101.8 49.2 L93.4 58.8 L101.8 68.4 L89.8 74.4 L92.2 86.4 L80.2 88.8 L77.8 100.8 L65.8 98.4 L60 110 L54.2 98.4 L42.2 100.8 L39.8 88.8 L27.8 86.4 L30.2 74.4 L18.2 68.4 L26.6 58.8 L18.2 49.2 L30.2 43.2 L27.8 31.2 L39.8 28.8 L42.2 16.8 L54.2 19.2 Z"
        fill={BRAND_PINK}
        clipPath={`url(#${left})`}
      />
      <path
        d="M60 8 L65.8 19.2 L77.8 16.8 L80.2 28.8 L92.2 31.2 L89.8 43.2 L101.8 49.2 L93.4 58.8 L101.8 68.4 L89.8 74.4 L92.2 86.4 L80.2 88.8 L77.8 100.8 L65.8 98.4 L60 110 L54.2 98.4 L42.2 100.8 L39.8 88.8 L27.8 86.4 L30.2 74.4 L18.2 68.4 L26.6 58.8 L18.2 49.2 L30.2 43.2 L27.8 31.2 L39.8 28.8 L42.2 16.8 L54.2 19.2 Z"
        fill={BRAND_WHITE}
        clipPath={`url(#${right})`}
      />

      {/* Phone + repair tools (tilted) */}
      <g transform="translate(60 62) rotate(-22)">
        <rect x="-13" y="-26" width="26" height="46" rx="4.5" fill={BRAND_PINK} />
        <rect x="-10" y="-21" width="20" height="32" rx="2.5" fill="#c41775" opacity="0.35" />

        {/* Wrench */}
        <path
          d="M-4 -8 L-9 -3 C-10.6 -1.4 -10.6 0.8 -9 2.4 L-2.5 8.8 C-0.9 10.4 1.3 10.4 2.9 8.8 L5.5 6.2 L-4 -8Z"
          fill={BRAND_WHITE}
        />
        <circle cx="-7.5" cy="-0.5" r="2.2" fill={BRAND_WHITE} />

        {/* Small gears */}
        <g transform="translate(6 6)">
          <circle r="4.2" fill="none" stroke={BRAND_WHITE} strokeWidth="1.8" />
          <circle r="1.4" fill={BRAND_WHITE} />
          <rect x="-0.7" y="-6.2" width="1.4" height="2.2" rx="0.4" fill={BRAND_WHITE} />
          <rect x="-0.7" y="4" width="1.4" height="2.2" rx="0.4" fill={BRAND_WHITE} />
          <rect x="-6.2" y="-0.7" width="2.2" height="1.4" rx="0.4" fill={BRAND_WHITE} />
          <rect x="4" y="-0.7" width="2.2" height="1.4" rx="0.4" fill={BRAND_WHITE} />
        </g>
        <g transform="translate(-5 12) scale(0.72)">
          <circle r="4.2" fill="none" stroke={BRAND_WHITE} strokeWidth="1.8" />
          <circle r="1.4" fill={BRAND_WHITE} />
          <rect x="-0.7" y="-6.2" width="1.4" height="2.2" rx="0.4" fill={BRAND_WHITE} />
          <rect x="-0.7" y="4" width="1.4" height="2.2" rx="0.4" fill={BRAND_WHITE} />
          <rect x="-6.2" y="-0.7" width="2.2" height="1.4" rx="0.4" fill={BRAND_WHITE} />
          <rect x="4" y="-0.7" width="2.2" height="1.4" rx="0.4" fill={BRAND_WHITE} />
        </g>
      </g>
    </>
  );
}
