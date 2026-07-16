import { getModelImageUrl, modelImageAlt } from '../utils/modelImage';

/**
 * Tiny product thumb next to a model name in menus/chips/cards.
 * Falls back to a letter mark if mapping is missing.
 */
export default function ModelThumb({ brand, model, className = '' }) {
  const src = getModelImageUrl(brand, model);
  if (!src) {
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
      width={40}
      height={40}
    />
  );
}
