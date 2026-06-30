import { useId } from 'react';

export default function ShopLogo({ size = 48, className = '', animated = true }) {
  const uid = useId().replace(/:/g, '');
  const grad = `sGrad-${uid}`;
  const glow = `sGlow-${uid}`;

  return (
    <svg
      className={`shop-logo-svg ${animated ? 'shop-logo--animated' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="120" y2="120">
          <stop stopColor="#ff6b2c" />
          <stop offset="0.5" stopColor="#f97316" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
        <filter id={glow}>
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="60" cy="60" r="46" fill="#0f0a08" stroke={`url(#${grad})`} strokeWidth="2.5" />
      <circle cx="60" cy="60" r="38" fill="none" stroke={`url(#${grad})`} strokeWidth="1" strokeDasharray="6 8" opacity="0.45" className="shop-logo-orbit" />

      {/* Shopping bag */}
      <path
        d="M38 48 C38 42 42 38 48 38 H72 C78 38 82 42 82 48 V88 C82 92 78 96 74 96 H46 C42 96 38 92 38 88 Z"
        fill="#1a1008"
        stroke={`url(#${grad})`}
        strokeWidth="2"
      />
      <path
        d="M48 38 V34 C48 28 52 24 60 24 C68 24 72 28 72 34 V38"
        fill="none"
        stroke={`url(#${grad})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Phone in bag */}
      <rect x="52" y="52" width="16" height="28" rx="3" fill="#0a0a12" stroke="#fbbf24" strokeWidth="1.2" className="shop-logo-phone" />
      <circle cx="60" cy="74" r="1.5" fill="#ff6b2c" />

      {/* Accessory dots — charger, case, buds */}
      <circle cx="46" cy="58" r="4" fill="#ff6b2c" opacity="0.85" className="shop-logo-dot shop-logo-dot--1" filter={`url(#${glow})`} />
      <circle cx="74" cy="62" r="3.5" fill="#fbbf24" opacity="0.85" className="shop-logo-dot shop-logo-dot--2" />
      <circle cx="68" cy="78" r="3" fill="#f97316" opacity="0.85" className="shop-logo-dot shop-logo-dot--3" />

      {/* Badge */}
      <rect x="40" y="16" width="40" height="16" rx="5" fill={`url(#${grad})`} />
      <text x="60" y="27" textAnchor="middle" fill="#0f0a08" fontSize="8" fontWeight="900" fontFamily="Syne,sans-serif">SHOP</text>
    </svg>
  );
}
