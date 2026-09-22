import type { ReactNode } from "react";

export type EmptyStateVariant =
  /** No records exist yet — the first-run case. */
  | "empty"
  /** Records exist, but the current search or filter matched none. */
  | "no-results"
  /** The fetch failed. Pair with a retry action. */
  | "error";

export type EmptyStateSize = "inline" | "card" | "page";

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  /** One short line: what is not here. */
  title: string;
  /** Why, and what to do about it. */
  description?: ReactNode;
  /** Primary action — "Add the first lane", "Clear filters", "Try again". */
  action?: ReactNode;
  /** Quieter second action, beside the first. */
  secondaryAction?: ReactNode;
  /**
   * `inline` fills the body of a table card, `card` draws its own frame,
   * `page` centres in the viewport for a whole screen with nothing on it.
   */
  size?: EmptyStateSize;
  /** Replaces the variant's default glyph. */
  icon?: ReactNode;
}

/**
 * What a screen shows when there is nothing to show.
 *
 * The three variants exist because they are three different messages: nothing
 * has been created yet, the filter excluded everything, or the read failed. A
 * single "No data" covers all three badly — the reader cannot tell whether to
 * add a record, clear a filter or retry.
 *
 * Presentation only: it never inspects a list or decides which variant applies.
 * The caller knows whether it searched.
 */
export function EmptyState({
  variant = "empty",
  title,
  description,
  action,
  secondaryAction,
  size = "inline",
  icon,
}: EmptyStateProps) {
  const glyph = icon ?? DEFAULT_ICON[variant];
  const tone = variant === "error" ? "var(--crit)" : "var(--ink-mute)";
  const wash = variant === "error" ? "var(--crit-wash)" : "var(--surface-sunk)";

  const body = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
        maxWidth: "44ch",
        margin: "0 auto",
        padding: size === "inline" ? "28px 20px" : "36px 24px",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: size === "page" ? 46 : 38,
          height: size === "page" ? 46 : 38,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: wash,
          color: tone,
          marginBottom: 4,
        }}
      >
        {glyph}
      </span>
      <span
        style={{
          fontFamily: "var(--serif)",
          fontSize: size === "page" ? 22 : 17,
          color: "var(--ink)",
          lineHeight: 1.25,
        }}
      >
        {title}
      </span>
      {description && (
        <span style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          {description}
        </span>
      )}
      {(action || secondaryAction) && (
        <span
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {action}
          {secondaryAction}
        </span>
      )}
    </div>
  );

  if (size === "card") {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          display: "grid",
          placeItems: "center",
          minHeight: 260,
        }}
      >
        {body}
      </div>
    );
  }

  if (size === "page") {
    return (
      <section style={{ minHeight: "min(520px, 60vh)", display: "grid", placeItems: "center" }}>
        {body}
      </section>
    );
  }

  // `inline`: the caller's frame supplies the border — inside a table card this
  // takes the flex row the skeleton and the rows would have occupied.
  return <div style={{ flex: 1, display: "grid", placeItems: "center" }}>{body}</div>;
}

const DEFAULT_ICON: Record<EmptyStateVariant, ReactNode> = {
  empty: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="15" rx="1.5" />
      <path d="M3 10h18M9 10v10" />
    </svg>
  ),
  "no-results": (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  error: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l9 16H3z" />
      <path d="M12 9v5M12 17.2v.1" />
    </svg>
  ),
};
