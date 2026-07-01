export default function Logo({ size = 44, showText = true, className = '' }) {
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
          <linearGradient id="logoGradMain" x1="10" y1="10" x2="110" y2="110">
            <stop stopColor="#FF6B2C" />
            <stop offset="0.5" stopColor="#7C3AED" />
            <stop offset="1" stopColor="#00F5D4" />
          </linearGradient>
          <linearGradient id="logoGradInner" x1="30" y1="25" x2="90" y2="95">
            <stop stopColor="#1a1a2e" />
            <stop offset="1" stopColor="#0a0a12" />
          </linearGradient>
          <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.35" />
          </filter>
        </defs>

        <g filter="url(#logoShadow)">
          <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#logoGradMain)" opacity="0.25" />
          <rect x="8" y="8" width="104" height="104" rx="24" fill="#050508" stroke="url(#logoGradMain)" strokeWidth="2" />

          {/* Phone body */}
          <rect x="38" y="20" width="44" height="80" rx="10" fill="url(#logoGradInner)" stroke="url(#logoGradMain)" strokeWidth="2" />
          <rect x="42" y="28" width="36" height="56" rx="4" fill="#0f0f1a" stroke="rgba(255,255,255,0.08)" />

          {/* Screen shine */}
          <path d="M42 28 L78 28 L72 36 L42 36 Z" fill="rgba(0,245,212,0.12)" />

          {/* Wrench / fix icon */}
          <path
            d="M58 46 L52 52 C50.5 53.5 50.5 56 52 57.5 L60.5 66 C62 67.5 64.5 67.5 66 66 L68 64 L58 46Z"
            fill="#FF6B2C"
          />
          <circle cx="54" cy="56" r="4" fill="#00F5D4" />

          {/* Gear dot */}
          <circle cx="72" cy="70" r="6" fill="none" stroke="#7C3AED" strokeWidth="2" />
          <circle cx="72" cy="70" r="2" fill="#7C3AED" />

          {/* Home button */}
          <circle cx="60" cy="92" r="3" fill="url(#logoGradMain)" />

          {/* Top speaker */}
          <rect x="54" y="24" width="12" height="2" rx="1" fill="rgba(255,255,255,0.2)" />

          {/* "As" monogram badge — bottom-left corner, clear of the phone icon */}
          <rect x="14" y="80" width="26" height="18" rx="6" fill="url(#logoGradMain)" />
          <text x="27" y="93" textAnchor="middle" fill="#050508" fontSize="9.5" fontWeight="800" fontFamily="Syne, sans-serif">As</text>
        </g>
      </svg>

      {showText && (
        <div className="brand-logo-text">
          <strong>Fix & Gear</strong>
          <small>Fix • Shop • Care</small>
        </div>
      )}
    </div>
  );
}
