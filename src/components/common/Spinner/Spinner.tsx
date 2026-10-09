import type { CSSProperties } from "react";

export interface SpinnerProps {
  /** Diameter in px. 14 sits inside a button, 28 reads as a page loader. */
  size?: number;
  /** Ring thickness in px. Defaults to a twelfth of the size, min 1.5. */
  thickness?: number;
  /** Colour of the moving arc. Defaults to the primary green. */
  color?: string;
  /** Screen-reader label. Pass "" on a spinner that sits inside labelled text. */
  label?: string;
  style?: CSSProperties;
}

/**
 * Indeterminate loading ring.
 *
 * Presentation only — it never owns the loading state. Callers decide when a
 * spinner is on screen, which keeps it usable inside a button, a table cell or
 * an empty panel without changing the component.
 */
export function Spinner({
  size = 16,
  thickness,
  color = "var(--green-deep)",
  label = "Loading",
  style,
}: SpinnerProps) {
  const border = thickness ?? Math.max(1.5, size / 12);
  return (
    <span
      className="spinner"
      role={label ? "status" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={{
        width: size,
        height: size,
        borderWidth: border,
        borderTopColor: color,
        ...style,
      }}
    />
  );
}
