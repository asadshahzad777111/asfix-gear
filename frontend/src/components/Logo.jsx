import { useId } from 'react';

export default function Logo({ size = 44, showText = true, className = '' }) {
  const uid = useId().replace(/:/g, '');

  return (
    <div className={`brand-logo ${className}`} style={{ '--logo-size': `${size}px` }}>
      <svg
        className="brand-logo-svg"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${uid}-orange`} x1="0" y1="0" x2="120" y2="120">
            <stop stopColor="#FF8534" />
            <stop offset="1" stopColor="#FF6B2C" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter={`url(#${uid}-glow)`}>
          <rect x="8" y="8" width="104" height="104" rx="22" fill="#0a0a0f" />
          <rect
            x="8"
            y="8"
            width="104"
            height="104"
            rx="22"
            fill="none"
            stroke={`url(#${uid}-orange)`}
            strokeWidth="4"
          />

          {/* Controller body */}
          <path
            d="M34 58 C34 44 42 36 60 36 C78 36 86 44 86 58 C86 72 82 78 74 80 L74 88 C74 92 70 96 66 96 L54 96 C50 96 46 92 46 88 L46 80 C38 78 34 72 34 58Z"
            fill="#12121a"
            stroke="#FF6B2C"
            strokeWidth="2"
          />

          {/* D-pad */}
          <rect x="44" y="52" width="14" height="4" rx="1.5" fill="#FF6B2C" />
          <rect x="49" y="47" width="4" height="14" rx="1.5" fill="#FF6B2C" />

          {/* Action buttons */}
          <circle cx="72" cy="50" r="3.5" fill="#FF8534" />
          <circle cx="78" cy="56" r="3.5" fill="#FF6B2C" opacity="0.85" />

          {/* Wrench accent — repair mark */}
          <path
            d="M58 62 L52 68 C50 70 50 73 52 75 L58 81 C60 83 63 83 65 81 L68 78 L58 62Z"
            fill="#FF6B2C"
          />
          <circle cx="54" cy="70" r="2.5" fill="#FFB347" />

          {/* Joy-Con rails */}
          <rect x="30" y="54" width="8" height="22" rx="4" fill="#15151c" stroke="#FF6B2C" strokeWidth="1.5" opacity="0.9" />
          <rect x="82" y="54" width="8" height="22" rx="4" fill="#15151c" stroke="#FF6B2C" strokeWidth="1.5" opacity="0.9" />
        </g>
      </svg>

      {showText && (
        <div className="brand-logo-text">
          <strong>AsFix & Gear</strong>
          <small>Repair · Shop · Game</small>
        </div>
      )}
    </div>
  );
}
