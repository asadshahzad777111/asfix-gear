import { useState } from 'react';
import { getModelImageUrl, modelImageAlt } from '../utils/modelImage';

/**
 * Product thumb next to a model name in menus / grids / cards.
 * Falls back to a letter mark if mapping is missing or the image fails.
 */
export default function ModelThumb({ brand, model, className = '' }) {
  const src = getModelImageUrl(brand, model);
  const [failedSrc, setFailedSrc] = useState(null);
  const showImg = Boolean(src) && failedSrc !== src;

  if (!showImg) {
    return (
      <span className={`model-thumb model-thumb--fallback ${className}`.trim()} aria-hidden="true">
        {(model || '?').trim().charAt(0)}
      </span>
    );
  }

  return (
    <img
      className={`model-thumb ${className}`.trim()}
      src={src}
      alt={modelImageAlt(brand, model)}
      loading="lazy"
      decoding="async"
      width={72}
      height={72}
      onError={() => setFailedSrc(src)}
    />
  );
}
