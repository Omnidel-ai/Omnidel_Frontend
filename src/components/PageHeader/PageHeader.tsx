import type { ReactNode } from "react";
import { BreadcrumbTrail, type Crumb } from "./BreadcrumbTrail";

export interface PageHeaderProps {
  /** Module / section / page. The caller resolves the labels. */
  crumbs: Crumb[];
  /** Router push, supplied by the caller — this component imports no router. */
  onNavigate?: (href: string) => void;
  /** Mono uppercase line above the trail. */
  eyebrow?: string;
  /** Buttons and controls pinned to the right of the header row. */
  actions?: ReactNode;
  marginBottom?: number;
}

/**
 * Page title row: eyebrow, breadcrumb trail, and the page's action buttons.
 *
 * In the app this header reads its labels from the module-nav registry; here
 * the labels arrive as props, which is what makes it shared rather than
 * module-specific.
 */
export function PageHeader({
  crumbs,
  onNavigate,
  eyebrow,
  actions,
  marginBottom = 16,
}: PageHeaderProps) {
  return (
    <div style={{ marginBottom }}>
      {eyebrow && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--serif)",
            minWidth: 0,
            flex: "1 1 160px",
            display: "flex",
            overflow: "hidden",
            margin: 0,
          }}
        >
          <BreadcrumbTrail crumbs={crumbs} onNavigate={onNavigate} />
        </h2>
        {actions != null && (
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
