import useScrollReveal from '../../hooks/useScrollReveal';

/**
 * Smooth left→right writing reveal.
 * mode: 'chars' for short titles, 'words' for longer lines (fewer nodes = less jitter).
 */
export default function TypeLine({
  text,
  className = '',
  as: Tag = 'span',
  mode = 'chars',
  staggerMs = 22,
  delay = 0,
}) {
  const { ref, revealed } = useScrollReveal({
    threshold: 0.12,
    delay,
    rootMargin: '-6% 0px -10% 0px',
  });

  const raw = String(text || '');
  const parts =
    mode === 'words'
      ? raw.split(/(\s+)/).filter((p) => p.length > 0)
      : Array.from(raw);

  return (
    <Tag
      ref={ref}
      className={`type-line ${revealed ? 'is-in' : ''} ${className}`.trim()}
      style={{ '--type-stagger': `${staggerMs}ms` }}
      aria-label={raw}
    >
      {parts.map((part, i) => (
        <span
          key={`${part}-${i}`}
          className="type-line__ch"
          style={{ '--i': i }}
          aria-hidden="true"
        >
          {part === ' ' ? '\u00a0' : part}
        </span>
      ))}
    </Tag>
  );
}
