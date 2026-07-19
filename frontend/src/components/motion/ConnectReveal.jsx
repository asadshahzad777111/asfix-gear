import useScrollReveal from '../../hooks/useScrollReveal';

/**
 * Continuous connect-together scroll motion.
 * from = 'left' | 'right' | 'up' | 'line'
 */
export default function ConnectReveal({
  children,
  className = '',
  from = 'up',
  delay = 0,
  threshold = 0.12,
  as: Tag = 'div',
  ...rest
}) {
  const { ref, revealed } = useScrollReveal({
    threshold,
    delay,
    rootMargin: '-8% 0px -14% 0px',
  });

  return (
    <Tag
      ref={ref}
      className={[
        'connect-reveal',
        `connect-reveal--${from}`,
        revealed ? 'is-in' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}
