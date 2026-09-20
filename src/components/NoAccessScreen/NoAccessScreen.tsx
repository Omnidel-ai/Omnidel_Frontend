import type { ReactNode } from "react";

export interface NoAccessScreenProps {
  /** What the viewer cannot reach, e.g. "Pricing". Defaults to "this page". */
  area?: string;
  /** Overrides the default sentence entirely. */
  message?: ReactNode;
  /** Optional action — "Request access", "Back to home". */
  action?: ReactNode;
}

/**
 * The permission wall: rendered in place of a page the viewer cannot open.
 *
 * It states the outcome and nothing else — the permission check itself belongs
 * to the caller (in the app, a route guard), never to a presentational
 * component.
 */
export function NoAccessScreen({ area, message, action }: NoAccessScreenProps) {
  const label = area ?? "this page";
  return (
    <section
      aria-labelledby="no-access-title"
      style={{ minHeight: "min(520px, 70vh)", display: "grid", placeItems: "center", padding: 24 }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          padding: "32px 28px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            margin: "0 auto 16px",
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            background: "var(--crit-wash)",
            color: "var(--crit)",
            fontFamily: "var(--mono)",
            fontWeight: 700,
          }}
        >
          !
        </div>
        <h2 id="no-access-title" style={{ fontFamily: "var(--serif)", fontSize: 24, marginBottom: 8 }}>
          You don&apos;t have access
        </h2>
        <p style={{ color: "var(--ink-mute)", fontSize: 13, lineHeight: 1.6 }}>
          {message ?? <>Your current permissions do not include access to {label}.</>}
        </p>
        {action && <div style={{ marginTop: 18 }}>{action}</div>}
      </div>
    </section>
  );
}
