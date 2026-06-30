import { useId } from 'react';

export default function GamingLogo({ size = 48, className = '', animated = true }) {
  const uid = useId().replace(/:/g, '');
  const grad = `gGrad-${uid}`;
  const glow = `gGlow-${uid}`;
  const pulse = `gPulse-${uid}`;

  return (
    <svg
      className={`gaming-logo-svg ${animated ? 'gaming-logo--animated' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="120" y2="120">
          <stop stopColor="#00ff88" />
          <stop offset="0.45" stopColor="#00d4ff" />
          <stop offset="1" stopColor="#ff0055" />
        </linearGradient>
        <radialGradient id={pulse} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </radialGradient>
        <filter id={glow}>
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon
        points="60,4 110,32 110,88 60,116 10,88 10,32"
        fill="#06060f"
        stroke={`url(#${grad})`}
        strokeWidth="2"
        className="gaming-logo-hex"
      />

      <circle
        cx="60"
        cy="60"
        r="48"
        fill="none"
        stroke={`url(#${grad})`}
        strokeWidth="1"
        strokeDasharray="8 12"
        opacity="0.5"
        className="gaming-logo-orbit"
      />

      <circle cx="60" cy="60" r="36" fill={`url(#${pulse})`} className="gaming-logo-pulse-bg" />

      <rect x="34" y="38" width="52" height="44" rx="12" fill="#0c0c18" stroke={`url(#${grad})`} strokeWidth="1.5" />

      <path
        d="M34 46 L22 52 L22 62 L34 58 Z"
        fill={`url(#${grad})`}
        opacity="0.9"
        className="gaming-logo-trigger-l"
        filter={`url(#${glow})`}
      />
      <text x="24" y="59" fill="#06060f" fontSize="7" fontWeight="900" fontFamily="Syne,sans-serif">L</text>

      <path
        d="M86 46 L98 52 L98 62 L86 58 Z"
        fill={`url(#${grad})`}
        opacity="0.9"
        className="gaming-logo-trigger-r"
        filter={`url(#${glow})`}
      />
      <text x="90" y="59" fill="#06060f" fontSize="7" fontWeight="900" fontFamily="Syne,sans-serif">R</text>

      <rect x="42" y="52" width="6" height="14" rx="1" fill="#00ff88" opacity="0.7" />
      <rect x="39" y="55" width="12" height="6" rx="1" fill="#00ff88" opacity="0.7" />

      <circle cx="72" cy="56" r="4" fill="#ff0055" opacity="0.85" />
      <circle cx="78" cy="62" r="4" fill="#00d4ff" opacity="0.85" />

      <circle cx="60" cy="72" r="10" fill="none" stroke="#00ff88" strokeWidth="1.2" opacity="0.8" className="gaming-logo-cross" />
      <circle cx="60" cy="72" r="2.5" fill="#ff0055" filter={`url(#${glow})`} className="gaming-logo-dot" />
      <line x1="60" y1="58" x2="60" y2="64" stroke="#00ff88" strokeWidth="1.5" />
      <line x1="60" y1="80" x2="60" y2="86" stroke="#00ff88" strokeWidth="1.5" />
      <line x1="46" y1="72" x2="52" y2="72" stroke="#00ff88" strokeWidth="1.5" />
      <line x1="68" y1="72" x2="74" y2="72" stroke="#00ff88" strokeWidth="1.5" />

      <rect x="44" y="14" width="32" height="16" rx="5" fill={`url(#${grad})`} />
      <text x="60" y="25" textAnchor="middle" fill="#06060f" fontSize="10" fontWeight="900" fontFamily="Syne,sans-serif">AsG</text>

      <path
        d="M60 28 L56 36 L62 36 L58 44"
        stroke="#00ff88"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        className="gaming-logo-bolt"
      />
    </svg>
  );
}
