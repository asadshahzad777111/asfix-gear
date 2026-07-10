import useScrollReveal from '../../hooks/useScrollReveal';

/**
 * Intersection-based entrance wrapper (Locomotive-style scroll reveal).
 */
export default function Reveal({
  children,
  className = '',
  variant = '',
  threshold = 0.12,
  delay = 0,
  as: Tag = 'div',
}) {
  const { ref, revealClass } = useScrollReveal({ threshold, delay });
  const variantClass = variant ? `loco-reveal--${variant}` : '';

  return (
    <Tag
      ref={ref}
      className={`loco-reveal ${variantClass} ${revealClass ? 'is-in' : ''} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
