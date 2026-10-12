"use client";

import { useState, type CSSProperties } from "react";
import { ProjectSetupModal } from "@/components/omnidel/omnipulse/project-setup-modal";
import { useTr } from "@/lib/client/language";

// Client wrapper for the "+ New Project" action. Owns the modal open state so the
// boards landing page (a server component) can stay server-rendered. Opens the
// Acharya-guided ProjectSetupModal by default; that modal carries its own manual
// CreateBoardModal fallback for users who prefer a form.
//
// When `presetWorkspaceId` is supplied the create flow is pre-scoped to that
// team (the manual form pre-selects it and locks the Team picker) so the user
// doesn't have to re-pick a team they've already chosen — e.g. the per-team-card
// "+ Project" affordance and the drilled-in team's "+ New Project" button.
//
// `compact` renders the small ghost variant used inside a team card's action
// cluster; the default is the primary green button used in page toolbars.
export function NewBoardButton({
  label = "+ New Project",
  presetWorkspaceId,
  presetWorkspaceName,
  compact = false,
}: {
  label?: string;
  presetWorkspaceId?: string;
  presetWorkspaceName?: string;
  compact?: boolean;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  return (
    <span style={{ display: "contents" }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "opx-newboard-compact" : undefined}
        style={compact ? compactBtnStyle : primaryBtnStyle}
        aria-label={presetWorkspaceName ? `Create project in ${presetWorkspaceName}` : undefined}
        title={presetWorkspaceName ? `Create project in ${presetWorkspaceName}` : undefined}
      >
        {compact && <span aria-hidden="true">+</span>}
        {compact ? tr("Project") : tr(label)}
      </button>
      <ProjectSetupModal
        open={open}
        onClose={() => setOpen(false)}
        presetWorkspaceId={presetWorkspaceId}
        presetWorkspaceName={presetWorkspaceName}
      />
      {compact && (
        <style>{`.opx-newboard-compact:hover{background:var(--green-wash);border-color:var(--green-deep);color:var(--green-deep);}`}</style>
      )}
    </span>
  );
}

const primaryBtnStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--green-deep)",
  color: "#f4efdf",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
  cursor: "pointer",
};

// Compact ghost pill for the per-card action cluster: quiet by default, greens
// up on hover so it reads as a secondary create affordance next to the pin.
const compactBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "3px 8px",
  fontSize: 11,
  fontWeight: 500,
  fontFamily: "var(--mono)",
  letterSpacing: "0.04em",
  background: "var(--surface-sunk)",
  color: "var(--ink-soft)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  transition: "background-color .12s ease, border-color .12s ease, color .12s ease",
};
