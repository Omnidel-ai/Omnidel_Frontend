import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  /** Muted line under the label. */
  hint?: string;
}

/**
 * Native checkbox tinted to the app's green, with the label row the filter
 * popovers and option lists use.
 */
export function Checkbox({ label, hint, id, disabled, style, ...rest }: CheckboxProps) {
  const autoId = useId();
  const boxId = id ?? autoId;

  return (
    <label
      htmlFor={boxId}
      style={{
        display: "flex",
        alignItems: hint ? "flex-start" : "center",
        gap: 8,
        fontSize: 13,
        fontFamily: "var(--sans)",
        color: disabled ? "var(--ink-mute)" : "var(--ink)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        minWidth: 0,
      }}
    >
      <input
        id={boxId}
        type="checkbox"
        disabled={disabled}
        style={{
          accentColor: "var(--green-deep)",
          width: 14,
          height: 14,
          marginTop: hint ? 2 : 0,
          flexShrink: 0,
          cursor: "inherit",
          ...style,
        }}
        {...rest}
      />
      {label != null && (
        <span style={{ minWidth: 0 }}>
          <span className="picker-truncate">{label}</span>
          {hint && (
            <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
              {hint}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
