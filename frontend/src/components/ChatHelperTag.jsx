import { useId } from 'react';

/**
 * Arched speech tag — text rides a curve (not straight).
 */
export default function ChatHelperTag({ text, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const pathId = `chatHelpArc-${uid}`;
  const fillId = `chatHelpTagFill-${uid}`;

  return (
    <span className={`chat-helper__tag ${className}`.trim()}>
      <svg
        className="chat-helper__tag-svg"
        viewBox="0 0 148 46"
        width="148"
        height="46"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <path id={pathId} d="M12 34 C 40 8, 108 8, 136 34" fill="none" />
          <linearGradient id={fillId} x1="10" y1="4" x2="138" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff8a4c" />
            <stop offset="0.55" stopColor="#ff6a2b" />
            <stop offset="1" stopColor="#e04e00" />
          </linearGradient>
        </defs>
        <path
          className="chat-helper__tag-bubble"
          d="M10 36 C 14 14, 40 4, 74 4 C 108 4, 134 14, 138 36 C 110 30, 38 30, 10 36 Z"
          fill={`url(#${fillId})`}
        />
        <path d="M66 34 L74 44 L82 34" fill="#ff6a2b" />
        <text className="chat-helper__tag-curve-text">
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {text}
          </textPath>
        </text>
      </svg>
      <span className="sr-only">{text}</span>
    </span>
  );
}
