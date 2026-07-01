import { useRef, useEffect } from 'react';

export default function OtpInput({ value, onChange, length = 6, disabled = false, idPrefix = 'otp' }) {
  const inputsRef = useRef([]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (!disabled && value.length === 0) {
      inputsRef.current[0]?.focus();
    }
  }, [disabled, value.length]);

  const updateAt = (index, char) => {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join('').slice(0, length));
  };

  const handleChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      updateAt(index, '');
      return;
    }
    if (raw.length === 1) {
      updateAt(index, raw);
      if (index < length - 1) inputsRef.current[index + 1]?.focus();
      return;
    }
    const pasted = raw.slice(0, length);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIdx]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="otp-input-row" role="group" aria-label="Verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          id={`${idPrefix}-${i}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          className="otp-digit"
          value={digit}
          disabled={disabled}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
