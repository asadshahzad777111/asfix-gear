/**
 * Unique profile control — cut-corner ring + refined person mark.
 * Used for guest Account and logged-in menu trigger (not a gear / emoji).
 */
export default function ProfileMark({ size = 20, initial = null }) {
  if (initial) {
    return (
      <span className="profile-mark profile-mark--initial" style={{ width: size, height: size }}>
        <span className="profile-mark-letter">{initial}</span>
      </span>
    );
  }

  return (
    <svg
      className="profile-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      {/* Cut-corner frame — brand geometry */}
      <path
        d="M7.2 3.2h9.6c1.2 0 1.6.4 1.6 1.6v9.6c0 1.2-.4 1.6-1.6 1.6H7.2c-1.2 0-1.6-.4-1.6-1.6V4.8c0-1.2.4-1.6 1.6-1.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.1" r="2.15" stroke="currentColor" strokeWidth="1.65" />
      <path
        d="M7.9 16.2c.85-2.05 2.35-3.1 4.1-3.1s3.25 1.05 4.1 3.1"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}
