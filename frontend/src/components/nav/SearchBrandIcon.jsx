import { useState } from 'react';
import { getBrandFallbackEmoji, getBrandIconUrl } from '../../utils/brandIcon';

export default function SearchBrandIcon({ brandId, className = '' }) {
  const [failed, setFailed] = useState(false);
  const url = getBrandIconUrl(brandId);

  if (!brandId || !url || failed) {
    return (
      <span className={`nav-search-brand-fallback ${className}`.trim()} aria-hidden="true">
        {getBrandFallbackEmoji(brandId)}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={`nav-search-brand-icon ${className}`.trim()}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
