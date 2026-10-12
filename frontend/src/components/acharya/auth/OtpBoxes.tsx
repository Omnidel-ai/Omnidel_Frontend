"use client";

import { forwardRef } from "react";
import styles from "./auth-hero.module.css";

interface Props {
  value: string;
  onChange: (digits: string) => void;
  length?: number;
  label: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * Six boxes, one digit each — but a single real input laid over them. One
 * input keeps what separate boxes break: SMS autofill (`one-time-code`),
 * pasting the whole code, and backspace moving back without any focus
 * juggling. The boxes only draw what the input holds.
 */
const OtpBoxes = forwardRef<HTMLInputElement, Props>(function OtpBoxes(
  { value, onChange, length = 6, label, autoFocus, disabled },
  ref,
) {
  const active = Math.min(value.length, length - 1);

  return (
    <label className={styles.otpBoxes}>
      <span className="sr-only">{label}</span>
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`${styles.otpBox} ${value[i] ? styles.otpBoxFilled : ""} ${
            i === active ? styles.otpBoxActive : ""
          }`}
        >
          {value[i] ?? ""}
        </span>
      ))}
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        required
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        maxLength={length}
        className={styles.otpBoxesInput}
      />
    </label>
  );
});

export default OtpBoxes;

/** "+919830067217" or "9830067217" → "+91 98300 67217", for reading back. */
export function formatIndianPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : raw;
}
