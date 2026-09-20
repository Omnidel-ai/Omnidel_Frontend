import type { ReactNode } from "react";

export interface FormFieldProps {
  /** Mono uppercase label, as every admin form in the app renders it. */
  label?: string;
  /** Marks the field required — a terracotta asterisk after the label. */
  required?: boolean;
  /** Helper text under the control. Hidden while `error` is set. */
  hint?: string;
  /** Error message under the control; also recolours the label row. */
  error?: string;
  /** `id` of the control, so the label points at it. */
  htmlFor?: string;
  /** `id` put on the hint/error line, for the control's aria-describedby. */
  descriptionId?: string;
  children: ReactNode;
}

/**
 * Label + control + hint/error, the layout used by every form in the app.
 *
 * Owns no value and no validation: the caller decides what an error is and
 * passes the message down.
 */
export function FormField({
  label,
  required,
  hint,
  error,
  htmlFor,
  descriptionId,
  children,
}: FormFieldProps) {
  return (
    <div>
      {label && (
        <label className="form-label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span aria-hidden="true" style={{ color: "var(--terracotta)", marginLeft: 3 }}>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <div className="form-error" role="alert" id={descriptionId}>
          {error}
        </div>
      ) : hint ? (
        <div className="form-hint" id={descriptionId}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
