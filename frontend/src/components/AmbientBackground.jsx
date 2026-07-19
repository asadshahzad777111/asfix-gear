/** Classic AsFix atmosphere: orange / violet / mint blooms + drifting dots. */

const DOT_COUNT = 56;

/** Deterministic layout so SSR/hydration stays stable */
function buildDots(count) {
  const dots = [];
  for (let i = 0; i < count; i += 1) {
    const left = ((i * 47) % 97) + 1.5;
    const top = ((i * 31) % 96) + 2;
    const size = 1 + (i % 3);
    const delay = -((i % 14) * 1.35);
    const duration = 16 + (i % 10) * 1.4;
    const opacity = 0.22 + ((i % 5) * 0.08);
    dots.push({ left, top, size, delay, duration, opacity });
  }
  return dots;
}

const DOTS = buildDots(DOT_COUNT);

export default function AmbientBackground() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-veil" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="ambient-dots">
        {DOTS.map((dot, i) => (
          <span
            key={i}
            className="ambient-dot"
            style={{
              left: `${dot.left}%`,
              top: `${dot.top}%`,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              opacity: dot.opacity,
              animationDelay: `${dot.delay}s`,
              animationDuration: `${dot.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="grid-overlay" />
    </div>
  );
}
