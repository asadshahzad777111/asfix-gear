/** Slow-moving orange + companion color atmosphere (always drifting). */
export default function AmbientBackground() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-veil" />
      <div className="ambient-mesh" />
      <div className="ambient-flare" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="orb orb-5" />
      <div className="ambient-grain" />
      <div className="grid-overlay" />
    </div>
  );
}
