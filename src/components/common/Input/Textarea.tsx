import { useId, type TextareaHTMLAttributes } from "react";
import { FormField } from "./FormField";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Shows a `used / maxLength` counter under the field. Needs `maxLength`. */
  showCount?: boolean;
}

/** Multi-line text field — same states and chrome as {@link Input}. */
export function Textarea({
  label,
  hint,
  error,
  required,
  showCount,
  id,
  className,
  maxLength,
  value,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const used = typeof value === "string" ? value.length : 0;
  const counter = showCount && maxLength ? `${used} / ${maxLength}` : undefined;

  const field = (
    <>
      <textarea
        id={fieldId}
        className={["form-textarea", className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-desc` : undefined}
        maxLength={maxLength}
        value={value}
        {...rest}
      />
      {counter && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: used === maxLength ? "var(--crit)" : "var(--ink-mute)",
            textAlign: "right",
            marginTop: 4,
          }}
        >
          {counter}
        </div>
      )}
    </>
  );

  if (!label && !hint && !error) return field;

  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      descriptionId={`${fieldId}-desc`}
    >
      {field}
    </FormField>
  );
}
