import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "../Spinner/Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swaps the label for a spinner + `loadingLabel`, and disables the button. */
  loading?: boolean;
  /** Text shown while loading. Matches the app's confirm dialog wording. */
  loadingLabel?: string;
  /** Icon rendered before the label. */
  iconLeft?: ReactNode;
  /** Icon rendered after the label. */
  iconRight?: ReactNode;
  /** Stretch to the width of the parent. */
  block?: boolean;
  /** Defaults to "button" — a shared button never submits a form by accident. */
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

const SPINNER_COLOR: Record<ButtonVariant, string> = {
  primary: "var(--surface)",
  secondary: "var(--ink-soft)",
  danger: "var(--surface)",
  ghost: "var(--ink-soft)",
};

/**
 * The application's four button tones in one component.
 *
 * States: default · hover · active · focus-visible · disabled · loading —
 * hover/active/focus live in global.css so they apply to a plain
 * `className="btn-primary"` element too (the app has many of those).
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Working…",
  iconLeft,
  iconRight,
  block = false,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    VARIANT_CLASS[variant],
    size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "",
    block ? "btn-block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        lineHeight: 1.4,
      }}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner size={size === "lg" ? 14 : 12} color={SPINNER_COLOR[variant]} label="" />
          {loadingLabel}
        </>
      ) : (
        <>
          {iconLeft}
          {children}
          {iconRight}
        </>
      )}
    </button>
  );
}
