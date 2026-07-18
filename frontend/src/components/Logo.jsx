import { useId } from 'react';
import { LogoMarkPaths } from './LogoMark';

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
        <LogoMarkPaths uid={uid} />
      </svg>

      {showText && (
        <div className="brand-logo-text">
          <strong className="brand-logo-wordmark">
            <span className="brand-logo-accent">AS</span>{' '}
            <span className="brand-logo-name">FIX</span>{' '}
            <span className="brand-logo-accent">&</span>{' '}
            <span className="brand-logo-name">GEAR</span>
          </strong>
          <small>Mobile Repair &amp; Accessories</small>
        </div>
      )}
    </div>
  );
}
