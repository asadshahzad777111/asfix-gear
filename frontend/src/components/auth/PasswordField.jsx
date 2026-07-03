import { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';

/**
 * Reusable password input with show/hide toggle.
 * Place inside `.auth-2026-field` or `.form-group` — label stays in parent.
 */
export default function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  minLength,
  disabled = false,
  autoFocus = false,
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-password-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('login.hidePassword') : t('login.showPassword')}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
