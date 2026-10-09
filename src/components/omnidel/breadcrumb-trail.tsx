"use client";

import {
  collapseBreadcrumbs,
  isEllipsisCrumb,
  type BreadcrumbItem,
} from "@/lib/breadcrumb-collapse";

/** Soft cap for the current crumb in the trail (lead / board name, etc.). */
const CURRENT_CRUMB_MAX_CHARS = 55;

const muteLink: React.CSSProperties = {
  color: "var(--ink-mute)",
  cursor: "pointer",
};

const ellipsisCrumbStyle: React.CSSProperties = {
  color: "var(--ink-mute)",
};

// Flex row: trail only as wide as its text (not full header width). Long current
// names are hard-capped so "..." appears mid-name, not flush against the
// action buttons. Hover still shows the full label.
const outerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  minWidth: 0,
  maxWidth: "100%",
};

const leadingGroupStyle: React.CSSProperties = {
  flex: "0 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const separatorStyle: React.CSSProperties = {
  flexShrink: 0,
  whiteSpace: "nowrap",
  // Flex items collapse leading/trailing regular spaces — pad instead of " / ".
  padding: "0 0.35em",
};

const lastCrumbStyle: React.CSSProperties = {
  flex: "0 1 auto",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function truncateCrumbLabel(label: string, max = CURRENT_CRUMB_MAX_CHARS): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max).trimEnd()}...`;
}

export function BreadcrumbTrail({
  crumbs,
  onNavigate,
}: {
  crumbs: BreadcrumbItem[];
  onNavigate: (href: string) => void;
}) {
  const display = collapseBreadcrumbs(crumbs);
  const fullPath = crumbs.map((c) => c.label).join(" / ");
  const isCollapsed = display.length < crumbs.length;

  const leading = display.slice(0, -1);
  const last = display[display.length - 1];
  const lastLabel = last && !isEllipsisCrumb(last) ? last.label : undefined;
  const lastDisplay =
    lastLabel != null ? truncateCrumbLabel(lastLabel) : undefined;
  // Hover shows the full path / name even when the current crumb is clipped.
  const hoverTitle = isCollapsed ? fullPath : lastLabel;

  return (
    <span title={hoverTitle} style={outerStyle}>
      {leading.length > 0 && (
        <>
          <span style={leadingGroupStyle}>
            {leading.map((c, i) => (
              <span key={i}>
                {isEllipsisCrumb(c) ? (
                  <span style={ellipsisCrumbStyle}>...</span>
                ) : c.href ? (
                  <span style={muteLink} onClick={() => onNavigate(c.href!)}>
                    {c.label}
                  </span>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < leading.length - 1 && <span style={separatorStyle}>/</span>}
              </span>
            ))}
          </span>
          <span style={separatorStyle}>/</span>
        </>
      )}
      <span style={lastCrumbStyle} title={lastLabel}>
        {isEllipsisCrumb(last) ? (
          <span style={ellipsisCrumbStyle}>...</span>
        ) : (
          lastDisplay
        )}
      </span>
    </span>
  );
}
