/**
 * Placeholder layouts while the API cold-starts — mimic real product sections
 * instead of a bare spinner so Home/Shop feel responsive during backend wake-up.
 */

function SkeletonBlock({ className = '', style }) {
  return <div className={`skeleton-block ${className}`.trim()} style={style} aria-hidden="true" />;
}

function HomeCarouselSkeleton() {
  return (
    <div className="home-carousel-wrap">
      <div className="home-carousel-track skeleton-carousel-track">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton-home-card glass-card">
            <SkeletonBlock className="skeleton-home-card-img" />
            <div className="skeleton-home-card-body">
              <SkeletonBlock className="skeleton-line skeleton-line--md" />
              <SkeletonBlock className="skeleton-line skeleton-line--sm" />
              <SkeletonBlock className="skeleton-line skeleton-line--price" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeProductsSkeleton({ coldStart = false, onRetry, retryLabel }) {
  return (
    <div className="skeleton-products-wrap" role="status" aria-live="polite" aria-busy="true">
      {[0, 1].map((section) => (
        <section key={section} className="home-section">
          <div className="container">
            <SkeletonBlock className="skeleton-line skeleton-line--title" />
            <SkeletonBlock className="skeleton-line skeleton-line--sub" />
            <HomeCarouselSkeleton />
          </div>
        </section>
      ))}
      {coldStart && onRetry && (
        <div className="container skeleton-cold-start-note">
          <p>{coldStart}</p>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export function ShopGridSkeleton({ count = 8, coldStart = false, onRetry, retryLabel }) {
  return (
    <div className="skeleton-products-wrap" role="status" aria-live="polite" aria-busy="true">
      <div className="products-grid skeleton-shop-grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton-shop-card glass-card">
            <SkeletonBlock className="skeleton-shop-card-img" />
            <div className="skeleton-shop-card-body">
              <SkeletonBlock className="skeleton-line skeleton-line--md" />
              <SkeletonBlock className="skeleton-line skeleton-line--sm" />
              <SkeletonBlock className="skeleton-line skeleton-line--price" />
              <SkeletonBlock className="skeleton-line skeleton-line--btn" />
            </div>
          </div>
        ))}
      </div>
      {coldStart && onRetry && (
        <div className="skeleton-cold-start-note skeleton-cold-start-note--shop">
          <p>{coldStart}</p>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      )}
    </div>
  );
}
