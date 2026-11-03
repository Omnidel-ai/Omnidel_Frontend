import { forwardRef, type CSSProperties } from "react";

export interface OtpInputProps {
  value: string;
  onChange: (digits: string) => void;
  /** Accessible label — "Enter the 6-digit code". */
  label: string;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Called once the last digit lands — submit from here. */
  onComplete?: (code: string) => void;
}

/**
 * One digit per box, drawn over a single real input.
 *
 * Both apps sign in with a phone OTP. Contractor's `LoginClient` uses six
 * separate inputs with focus juggling. Kaarigar's `OtpBoxes` (PR #207) uses
 * one input under six boxes. One input keeps SMS autofill
 * (`autocomplete="one-time-code"`), paste-the-whole-code and backspace working
 * with no extra code, so that is the version kept here.
 */
export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(function OtpInput(
  { value, onChange, label, length = 6, autoFocus, disabled, onComplete },
  ref,
) {
  const active = Math.min(value.length, length - 1);
  return (
    <label className="am-otp" data-disabled={disabled ? "" : undefined} style={{ "--am-otp-len": length } as CSSProperties}>
      <span className="am-sr-only">{label}</span>
      {Array.from({ length }, (_, i) => (
        <span key={i} aria-hidden className="am-otp__box" data-filled={value[i] ? "" : undefined} data-active={i === active ? "" : undefined}>
          {value[i] ?? ""}
        </span>
      ))}
      <input
        ref={ref}
        className="am-otp__input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        autoFocus={autoFocus}
        disabled={disabled}
        maxLength={length}
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(digits);
          if (digits.length === length && value.length < length) onComplete?.(digits);
        }}
      />
    </label>
  );
});

export interface PhoneInputProps {
  /** Ten digits, no prefix. */
  value: string;
  onChange: (digits: string) => void;
  label: string;
  prefix?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * The phone number field on both sign-in screens: a fixed country prefix
 * (both apps are India-only today), then digits only, 16px+ text so iOS does
 * not zoom on focus.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, label, prefix = "+91", placeholder = "98765 43210", autoFocus, disabled },
  ref,
) {
  return (
    <label className="am-phone">
      <span className="am-sr-only">{label}</span>
      <span className="am-phone__prefix" aria-hidden>{prefix}</span>
      <input
        ref={ref}
        className="am-phone__input"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
      />
    </label>
  );
});

/** "+919830067217" or "9830067217" → "+91 98300 67217", for reading a number back. */
export function formatIndianPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : raw;
}
