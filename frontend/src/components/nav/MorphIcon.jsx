/** Dual-face icon — idle face A swaps to hover face B with a live flip. */
export default function MorphIcon({ idle, hover, className = '' }) {
  return (
    <span className={`dx-morph ${className}`.trim()} aria-hidden="true">
      <span className="dx-morph__face dx-morph__face--idle">{idle}</span>
      <span className="dx-morph__face dx-morph__face--hover">{hover}</span>
    </span>
  );
}
