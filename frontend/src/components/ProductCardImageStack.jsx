/**
 * Dual-image product card media — crossfade to gallery[0] on hover/tap.
 */
export default function ProductCardImageStack({
  mainSrc,
  altSrc,
  alt,
  showAlt,
  className = '',
  onError,
}) {
  const hasAlt = Boolean(altSrc);

  return (
    <div
      className={[
        'product-card-image-stack',
        hasAlt ? 'has-alt' : '',
        showAlt ? 'show-alt' : '',
      ].filter(Boolean).join(' ')}
    >
      <img
        src={mainSrc}
        alt={alt}
        loading="lazy"
        onError={onError}
        className={`product-card-img-primary ${className}`.trim()}
      />
      {hasAlt && (
        <img
          src={altSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={onError}
          className={`product-card-img-alt ${className}`.trim()}
        />
      )}
    </div>
  );
}
