import { useTheme } from '../context/ThemeContext';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path
        d="M21 14.5A8.5 8.5 0 1 1 9.5 3a6.5 6.5 0 0 0 11.5 11.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
      <path d="M7 10h4M7 7.5h6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

const LABELS = {
  light: 'Light mode',
  dark: 'Dark mode',
  auto: 'Auto mode (follows system)',
};

export default function ThemeToggle({ className = '' }) {
  const { mode, cycleMode } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={cycleMode}
      aria-label={LABELS[mode]}
      title={LABELS[mode]}
    >
      <span className="theme-toggle-glow" aria-hidden="true" />
      <span className={`theme-toggle-icon ${mode === 'light' ? 'is-active' : ''}`} data-mode="light">
        <SunIcon />
      </span>
      <span className={`theme-toggle-icon ${mode === 'dark' ? 'is-active' : ''}`} data-mode="dark">
        <MoonIcon />
      </span>
      <span className={`theme-toggle-icon ${mode === 'auto' ? 'is-active' : ''}`} data-mode="auto">
        <AutoIcon />
      </span>
      <span className="theme-toggle-ring" aria-hidden="true" />
    </button>
  );
}
