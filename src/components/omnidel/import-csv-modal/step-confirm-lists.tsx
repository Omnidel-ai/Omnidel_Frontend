"use client";

import { type CSSProperties } from "react";
import { useTr } from "@/lib/client/language";

// Confirm step — shown between extraction (AI import or template) and the
// preview grid whenever an extracted task's workstream/group (list_name)
// doesn't match any of the board's existing lists by name. Per Shubham's
// decision: creating the missing lists is opt-in — decline and the affected
// tasks import with no list (list_id null), left for the user to assign
// manually on the board afterward.
export function StepConfirmLists({ unmatchedListNames }: { unmatchedListNames: string[] }) {
  const tr = useTr();
  return (
    <div>
      <p style={subtitleStyle}>
        {tr("These lists don’t exist yet on this board:")}
      </p>
      <div style={chipsWrapStyle}>
        {unmatchedListNames.map((name) => (
          <span key={name} style={chipStyle}>
            {name}
          </span>
        ))}
      </div>
      <p style={subtitleStyle}>
        {tr("Create them and place matching tasks there, or import without — you can assign a list to any task manually afterward.")}
      </p>
    </div>
  );
}

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
  lineHeight: 1.5,
  marginBottom: 16,
};
const chipsWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 16,
};
const chipStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
  padding: "6px 12px",
  background: "var(--surface-sunk)",
  borderRadius: "var(--r-full, 999px)",
};
