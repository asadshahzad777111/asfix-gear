/**
 * Triple-image product card media — crossfade through main + up to 2 gallery photos.
 */
export default function ProductCardImageStack({
  mainSrc,
  altSrc,
  thirdSrc,
  images,
  imageIndex = 0,
  alt,
  showAlt,
  className = '',
  onError,
}) {
  const stack = images?.length
    ? images
    : [mainSrc, altSrc, thirdSrc].filter(Boolean);
  const hasAlt = stack.length > 1;
  const activeIndex = showAlt ? Math.min(imageIndex, stack.length - 1) : 0;
  const onThird = activeIndex === 2 && stack.length >= 3;

  return (
    <div
      className={[
        'product-card-image-stack',
        hasAlt ? 'has-alt' : '',
        showAlt ? 'show-alt' : '',
        onThird ? 'is-third' : '',
      ].filter(Boolean).join(' ')}
    >
      {stack.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt={index === activeIndex ? alt : ''}
          aria-hidden={index !== activeIndex}
          loading="lazy"
          onError={onError}
          className={[
            index === 0 ? 'product-card-img-primary' : 'product-card-img-alt',
            index === activeIndex ? 'is-active' : '',
            className,
          ].filter(Boolean).join(' ')}
        />
      ))}
    </div>
  );
}
