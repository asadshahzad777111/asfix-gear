import './MenuToggle.css';

/**
 * Animated hamburger ↔ X (path morph + rotate).
 * Button-based for a11y; SVG stroke animation matches the shadcn/Tailwind demo
 * without requiring Tailwind or shadcn CLI.
 */
export default function MenuToggle({
  open,
  onOpenChange,
  className = '',
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth = 2.5,
  strokeLinecap = 'round',
  strokeLinejoin = 'round',
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
  ...props
}) {
  const classes = ['menu-toggle-anim', open ? 'is-open' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded ?? open}
      aria-controls={ariaControls}
      onClick={() => onOpenChange?.(!open)}
      {...props}
    >
      <svg
        viewBox="0 0 32 32"
        width="18"
        height="18"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={strokeLinecap}
        strokeLinejoin={strokeLinejoin}
        className={`menu-toggle-anim__svg${open ? ' is-open' : ''}`}
        aria-hidden="true"
      >
        <path
          className={`menu-toggle-anim__path${open ? ' is-open' : ''}`}
          d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
        />
        <path d="M7 16 27 16" />
      </svg>
    </button>
  );
}
