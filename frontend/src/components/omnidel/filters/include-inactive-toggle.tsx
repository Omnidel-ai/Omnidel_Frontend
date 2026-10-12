"use client";

// UNUSED — Page audit 2026-09-16: nothing in src/ imports this module.
// No importers.
// Deletion candidate. See docs/architecture/page-audit-2026-09-16.md.

import type React from "react";

// Shared "Include inactive" filter toggle for admin/master table controls.
// Replaces the bare browser checkbox so it matches the search box + CustomSelect
// dropdowns sitting beside it (same border, radius, and HEIGHT — 10px vertical
// padding + 1px border, identical to the CustomSelect trigger).
//
//   <IncludeInactiveToggle checked={includeInactive} onChange={setIncludeInactive} />
//
// `checked` = inactive rows ARE shown. Pass a custom `label` for pages that say
// "Show inactive" etc.

export function IncludeInactiveToggle({ checked, onChange, label = "Include inactive" }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "10px 12px", fontSize: 13, fontFamily: "var(--sans)",
        cursor: "pointer", borderRadius: "var(--r-sm)", whiteSpace: "nowrap", boxSizing: "border-box",
        border: `1px solid ${checked ? "var(--green-deep)" : "var(--rule)"}`,
        background: checked ? "var(--green-deep)" : "var(--surface)",
        color: checked ? "#f4efdf" : "var(--ink-soft)",
        lineHeight: 1,
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
        border: `1px solid ${checked ? "#f4efdf" : "var(--rule-strong)"}`,
        background: checked ? "#f4efdf" : "transparent",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "var(--green-deep)", fontSize: 10, lineHeight: 1,
      }}>{checked ? "✓" : ""}</span>
      {label}
    </button>
  );
}
