import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';

const CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.id) return Promise.resolve();

  const existing = document.querySelector(`script[src="${GSI_SCRIPT}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google script failed')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script failed'));
    document.head.appendChild(script);
  });
}

export function isGoogleSignInConfigured() {
  return Boolean(CLIENT_ID);
}

/**
 * Google Identity Services "Continue with Google" button.
 * Hidden gracefully when VITE_GOOGLE_CLIENT_ID is unset.
 */
export default function GoogleSignInButton({ onCredential, disabled = false, submitting = false }) {
  const { t } = useTranslation();
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const handleCredential = useCallback(
    (response) => {
      if (disabled || submitting) return;
      if (response?.credential) onCredential(response.credential);
    },
    [disabled, submitting, onCredential]
  );

  useEffect(() => {
    if (!CLIENT_ID) return undefined;

    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [handleCredential]);

  useEffect(() => {
    if (!ready || !hostRef.current || !window.google?.accounts?.id) return;

    hostRef.current.innerHTML = '';
    const width = Math.min(Math.max(hostRef.current.offsetWidth || 320, 240), 400);
    window.google.accounts.id.renderButton(hostRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width,
      locale: document.documentElement.lang?.startsWith('ur') ? 'ur' : 'en',
    });
  }, [ready]);

  if (!CLIENT_ID) {
    return (
      <p className="auth-2026-google-hint auth-2026-google-hint--muted">
        {t('auth.googleNotConfigured')}
      </p>
    );
  }

  if (loadError) {
    return (
      <p className="auth-2026-google-hint auth-2026-google-hint--muted">
        {t('auth.googleLoadFailed')}
      </p>
    );
  }

  return (
    <div
      className={`auth-2026-google ${disabled || submitting ? 'auth-2026-google--disabled' : ''}`}
      aria-busy={submitting}
    >
      <div ref={hostRef} className="auth-2026-google-btn-host" />
      {(disabled || submitting) && <div className="auth-2026-google-overlay" aria-hidden="true" />}
    </div>
  );
}

/** Divider between Google and email/password auth. */
export function AuthDivider({ label }) {
  return (
    <div className="auth-2026-divider" role="separator">
      <span>{label}</span>
    </div>
  );
}

/** Google button + optional divider — shared on login and signup. */
export function AuthGoogleSection({ onCredential, disabled, submitting, showDivider = true }) {
  const { t } = useTranslation();

  return (
    <div className="auth-2026-google-section">
      <GoogleSignInButton
        onCredential={onCredential}
        disabled={disabled}
        submitting={submitting}
      />
      {showDivider && isGoogleSignInConfigured() && (
        <AuthDivider label={t('auth.orContinueWith')} />
      )}
    </div>
  );
}
