import { BRAND_ACCENT } from './LogoMark';

export default function Logo({ size = 44, showText = true, className = '' }) {
  const accentStyle = { color: BRAND_ACCENT, WebkitTextFillColor: BRAND_ACCENT };

  return (
    <div className={`brand-logo ${className}`} style={{ '--logo-size': `${size}px` }}>
      <img
        className="brand-logo-img"
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        decoding="async"
        aria-hidden="true"
      />

      {showText && (
        <div className="brand-logo-text">
          <strong className="brand-logo-wordmark">
            <span className="brand-logo-accent" style={accentStyle}>AS</span>{' '}
            <span className="brand-logo-name">FIX</span>{' '}
            <span className="brand-logo-accent" style={accentStyle}>&</span>{' '}
            <span className="brand-logo-name">GEAR</span>
          </strong>
          <small>Mobile Repair &amp; Accessories</small>
        </div>
      )}
    </div>
  );
}
