import useScrollReveal from '../../hooks/useScrollReveal';

/**
 * Left→right typing reveal for a string (replays on scroll up/down).
 */
export default function TypeLine({
  text,
  className = '',
  as: Tag = 'span',
  staggerMs = 26,
  delay = 0,
}) {
  const { ref, revealed } = useScrollReveal({
    threshold: 0.15,
    delay,
    rootMargin: '-6% 0px -12% 0px',
  });

  const chars = Array.from(String(text || ''));

  return (
    <Tag
      ref={ref}
      className={`type-line ${revealed ? 'is-in' : ''} ${className}`.trim()}
      style={{ '--type-stagger': `${staggerMs}ms` }}
      aria-label={text}
    >
      {chars.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="type-line__ch"
          style={{ '--i': i }}
          aria-hidden="true"
        >
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      ))}
    </Tag>
  );
}
