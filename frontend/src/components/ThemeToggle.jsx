import { useTheme } from '../context/ThemeContext';

/**
 * iOS-style light/dark switch.
 * Checked = dark; unchecked = light. Auto mode maps to current resolved theme.
 */
export default function ThemeToggle({ className = '' }) {
  const { mode, resolved, setMode } = useTheme();
  const isDark = resolved === 'dark';

  const onToggle = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  const label = isDark ? 'Dark mode' : 'Light mode';
  const hint = mode === 'auto' ? `${label} (was auto)` : label;

  return (
    <button
      type="button"
      className={`theme-switch ${className}`.trim()}
      role="switch"
      aria-checked={isDark}
      aria-label={hint}
      title={hint}
      onClick={onToggle}
    >
      <span className="theme-switch-track" aria-hidden="true">
        <span className="theme-switch-icon theme-switch-icon--sun">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3.5" />
            <path
              d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="theme-switch-icon theme-switch-icon--moon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M20 14.2A7.8 7.8 0 1 1 9.8 4a6 6 0 0 0 10.2 10.2z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="theme-switch-thumb" />
      </span>
    </button>
  );
}
