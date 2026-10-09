import type { CSSProperties } from "react";

export interface Crumb {
  label: string;
  /** Omit to render a non-clickable crumb (module roots have no page). */
  href?: string;
}

/** Soft cap for the last crumb — a lead or board name, not a section. */
const CURRENT_CRUMB_MAX_CHARS = 55;
const ELLIPSIS = "…";

const muteLink: CSSProperties = { color: "var(--ink-mute)", cursor: "pointer" };
const outerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  minWidth: 0,
  maxWidth: "100%",
};
const leadingGroupStyle: CSSProperties = {
  flex: "0 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
// Flex items collapse leading/trailing spaces, so the separator is padded
// rather than written as " / ".
const separatorStyle: CSSProperties = { flexShrink: 0, whiteSpace: "nowrap", padding: "0 0.35em" };
const lastCrumbStyle: CSSProperties = {
  flex: "0 1 auto",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** Keep the first crumb and the last two; everything between becomes "…". */
export function collapseCrumbs(crumbs: Crumb[], maxItems = 4): Crumb[] {
  if (crumbs.length <= maxItems) return crumbs;
  return [crumbs[0], { label: ELLIPSIS }, ...crumbs.slice(-2)];
}

function truncate(label: string, max = CURRENT_CRUMB_MAX_CHARS): string {
  return label.length <= max ? label : `${label.slice(0, max).trimEnd()}${ELLIPSIS}`;
}

export interface BreadcrumbTrailProps {
  crumbs: Crumb[];
  /** Called with a crumb's href. The caller routes — this never imports one. */
  onNavigate?: (href: string) => void;
  /** Collapse threshold; pass Infinity to always render the full trail. */
  maxItems?: number;
}

/**
 * The header's "Module / Section / Page" trail.
 *
 * Long trails collapse in the middle and a long current name is clipped with
 * an ellipsis, so the header never pushes the action buttons off the row.
 */
export function BreadcrumbTrail({ crumbs, onNavigate, maxItems = 4 }: BreadcrumbTrailProps) {
  if (crumbs.length === 0) return null;

  const display = collapseCrumbs(crumbs, maxItems);
  const isCollapsed = display.length < crumbs.length;
  const fullPath = crumbs.map((c) => c.label).join(" / ");

  const leading = display.slice(0, -1);
  const last = display[display.length - 1];
  const hoverTitle = isCollapsed ? fullPath : last.label;

  return (
    <span title={hoverTitle} style={outerStyle}>
      {leading.length > 0 && (
        <>
          <span style={leadingGroupStyle}>
            {leading.map((c, i) => (
              <span key={`${c.label}-${i}`}>
                {c.href && onNavigate ? (
                  <span style={muteLink} onClick={() => onNavigate(c.href!)}>
                    {c.label}
                  </span>
                ) : (
                  <span style={c.label === ELLIPSIS ? muteLink : undefined}>{c.label}</span>
                )}
                {i < leading.length - 1 && <span style={separatorStyle}>/</span>}
              </span>
            ))}
          </span>
          <span style={separatorStyle}>/</span>
        </>
      )}
      <span style={lastCrumbStyle} title={last.label}>
        {truncate(last.label)}
      </span>
    </span>
  );
}
