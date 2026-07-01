import { motion } from 'framer-motion';
import Logo from '../Logo';

const cardVariants = {
  initial: { opacity: 0, y: 18, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
};

const cardTransition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] };

/** Full-bleed section wrapper with soft gradient glow — sits behind the auth card. */
export function AuthShell({ children }) {
  return (
    <section className="section auth-section auth-2026-shell">
      <span className="auth-2026-glow" aria-hidden="true" />
      {children}
    </section>
  );
}

/** Glass card with gradient edge — the actual login/register surface. */
export function AuthCard({ children, staff = false, className = '' }) {
  return (
    <motion.div
      className={`glass-card auth-2026-card ${staff ? 'auth-2026-card--staff' : ''} ${className}`.trim()}
      initial={cardVariants.initial}
      animate={cardVariants.animate}
      transition={cardTransition}
    >
      {children}
    </motion.div>
  );
}

/** Small brand mark shown at the top of every auth surface. */
export function AuthBrand({ size = 40 }) {
  return (
    <div className="auth-2026-brand">
      <Logo size={size} showText={false} />
    </div>
  );
}

export function AuthHead({ eyebrow, title, subtitle }) {
  return (
    <div className="auth-2026-head">
      {eyebrow && <span className="auth-2026-eyebrow">{eyebrow}</span>}
      <h1 className="auth-2026-title">{title}</h1>
      {subtitle && <p className="auth-2026-subtitle">{subtitle}</p>}
    </div>
  );
}

const alertIcon = { error: '⚠️', info: 'ℹ️', success: '✓' };

/** Themed inline alert for form errors / OTP hints / dev codes. */
export function AuthAlert({ type = 'info', children, center = false }) {
  return (
    <div
      className={`auth-2026-alert auth-2026-alert--${type} ${center ? 'auth-2026-dev-code' : ''}`.trim()}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <span className="auth-2026-alert-icon" aria-hidden="true">{alertIcon[type] || alertIcon.info}</span>
      <span>{children}</span>
    </div>
  );
}

/** Primary gradient submit button with a spinner while `submitting`. */
export function AuthSubmitButton({ submitting, disabled, children, ...rest }) {
  return (
    <motion.button
      type="submit"
      className="auth-2026-submit"
      disabled={disabled || submitting}
      whileHover={submitting || disabled ? undefined : { y: -1 }}
      whileTap={submitting || disabled ? undefined : { scale: 0.97 }}
      {...rest}
    >
      {submitting && <span className="auth-2026-spinner" aria-hidden="true" />}
      {children}
    </motion.button>
  );
}

/** Outline secondary button (resend code, back, etc). */
export function AuthSecondaryButton({ children, className = '', ...rest }) {
  return (
    <button type="button" className={`auth-2026-secondary ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

/** Segmented pill tab control (e.g. Password vs Login-with-code). */
export function AuthTabs({ tabs, active, onChange, layoutId = 'auth-tab-highlight' }) {
  return (
    <div className="auth-2026-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`auth-2026-tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {active === tab.id && (
            <motion.span
              layoutId={layoutId}
              className="auth-2026-tab-highlight"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Two-step progress indicator for OTP flows (details → verify). */
export function AuthSteps({ step, labelStart, labelVerify }) {
  const started = step !== 'start';
  return (
    <div className="auth-2026-steps">
      <div className={`auth-2026-step ${!started ? 'active' : 'done'}`}>
        <span className="auth-2026-step-dot">{started ? '✓' : '1'}</span>
        <span className="auth-2026-step-label">{labelStart}</span>
      </div>
      <span className={`auth-2026-step-line ${started ? 'done' : ''}`} />
      <div className={`auth-2026-step ${started ? 'active' : ''}`}>
        <span className="auth-2026-step-dot">2</span>
        <span className="auth-2026-step-label">{labelVerify}</span>
      </div>
    </div>
  );
}
