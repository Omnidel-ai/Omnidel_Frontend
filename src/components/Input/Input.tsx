import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { FormField } from "./FormField";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  /** Any non-empty string puts the field in its error state. */
  error?: string;
  required?: boolean;
  /** Icon drawn inside the left edge (search glass, calendar, …). */
  iconLeft?: ReactNode;
  /** Element pinned to the right edge — a unit, a clear button, a counter. */
  addonRight?: ReactNode;
}

/**
 * Single-line text field.
 *
 * States: empty · filled · focus · error · disabled · read-only. The error
 * state is driven by the `error` prop alone; the component never validates.
 */
export function Input({
  label,
  hint,
  error,
  required,
  iconLeft,
  addonRight,
  id,
  className,
  style,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const field = (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {iconLeft && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 10,
            display: "inline-flex",
            color: "var(--ink-mute)",
            pointerEvents: "none",
          }}
        >
          {iconLeft}
        </span>
      )}
      <input
        id={inputId}
        className={["form-input", className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-desc` : undefined}
        style={{
          ...(iconLeft ? { paddingLeft: 32 } : null),
          ...(addonRight ? { paddingRight: 44 } : null),
          ...style,
        }}
        {...rest}
      />
      {addonRight && (
        <span
          style={{
            position: "absolute",
            right: 8,
            display: "inline-flex",
            alignItems: "center",
            color: "var(--ink-mute)",
            fontSize: 11,
            fontFamily: "var(--mono)",
          }}
        >
          {addonRight}
        </span>
      )}
    </div>
  );

  if (!label && !hint && !error) return field;

  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      descriptionId={`${inputId}-desc`}
    >
      {field}
    </FormField>
  );
}
