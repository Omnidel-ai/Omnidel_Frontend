"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import { useTr } from "@/lib/client/language";

// ─────────────────────────────────────────────────────────────────────────────
// MoveProjectDialog — the "what happens to members and labels" confirmation
// shown after a destination team is picked in BoardEditButton's "Move to
// another Team" flow. Preflight (GET) is fetched by the caller BEFORE this
// mounts; this component only runs the execute (POST) step once the user has
// chosen a member/label strategy.
// ─────────────────────────────────────────────────────────────────────────────

export type MemberStrategy = "remove_assignees" | "add_as_guests";
export type LabelStrategy = "keep" | "clear";

export interface OrphanedAssignee {
  userId: string;
  name: string;
}

export interface MovePreflight {
  destTeamName: string;
  orphanedAssignees: OrphanedAssignee[];
  labelCount: number;
  destSlugConflict: boolean;
}

export interface MoveSummary {
  unassigned: number;
  guestsAdded: number;
  labelsCleared: number;
}

interface MoveProjectDialogProps {
  boardId: string;
  boardName: string;
  destWorkspaceId: string;
  destTeamName: string;
  preflight: MovePreflight;
  onClose: () => void;
  onMoved: (summary: MoveSummary) => void;
}

type Phase = "idle" | "pending" | "done";

const AUTO_CLOSE_MS = 1500;

export function MoveProjectDialog({
  boardId,
  boardName,
  destWorkspaceId,
  destTeamName,
  preflight,
  onClose,
  onMoved,
}: MoveProjectDialogProps) {
  const tr = useTr();
  const hasOrphans = preflight.orphanedAssignees.length > 0;
  // Safer default — keeps affected members' work + access visible instead of
  // silently unassigning them.
  const [memberStrategy, setMemberStrategy] = useState<MemberStrategy>("add_as_guests");
  const [labelStrategy, setLabelStrategy] = useState<LabelStrategy>("keep");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<MoveSummary | null>(null);
  const [mounted, setMounted] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "pending") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  async function handleMove() {
    if (phase === "pending" || phase === "done") return;
    setPhase("pending");
    setError("");
    try {
      const data = await fetchJson<{ ok: true; summary: MoveSummary }>(
        `/api/omnipulse/boards/${boardId}/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destWorkspaceId,
            memberStrategy: hasOrphans ? memberStrategy : "remove_assignees",
            labelStrategy,
          }),
        },
      );
      setSummary(data.summary);
      setPhase("done");
      closeTimerRef.current = setTimeout(() => onMoved(data.summary), AUTO_CLOSE_MS);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof FetchError ? err.message : "Couldn't move the project. Please try again.");
    }
  }

  if (!mounted) return null;

  const busy = phase === "pending";
  const done = phase === "done";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-project-title"
      onClick={busy || done ? undefined : onClose}
      style={overlayStyle}
    >
      <div onClick={(e) => e.stopPropagation()} style={cardStyle} className="mpd-card">
        <style>{MPD_CSS}</style>

        <h3 id="move-project-title" style={titleStyle}>
          {tr("Move “")}{boardName}{tr("” to")} {preflight.destTeamName || destTeamName}
        </h3>
        <p style={subtitleStyle}>
          {tr("Choose what happens to members and labels before the move runs.")}
        </p>

        {preflight.destSlugConflict && (
          <div style={noticeStyle}>
            {tr("A project with this name already exists in")} {preflight.destTeamName || destTeamName} {tr("— it will be renamed automatically so both can coexist.")}
          </div>
        )}

        {hasOrphans && (
          <section style={sectionStyle}>
            <div style={sectionHeadStyle}>{tr("Members")}</div>
            <p style={sectionTextStyle}>
              {preflight.orphanedAssignees.length === 1 ? tr("This member is") : tr("These members are")}{" "}
              {tr("assigned to tasks here but")}{" "}
              {preflight.orphanedAssignees.length === 1 ? tr("isn't") : tr("aren't")} {tr("part of")}{" "}
              {preflight.destTeamName || destTeamName}:
            </p>
            <div style={chipRowStyle}>
              {preflight.orphanedAssignees.map((m) => (
                <span key={m.userId} style={chipStyle}>{m.name}</span>
              ))}
            </div>

            <div style={radioGroupStyle} role="radiogroup" aria-label={tr("What to do with these members")}>
              <RadioOption
                name="member-strategy"
                checked={memberStrategy === "remove_assignees"}
                onSelect={() => setMemberStrategy("remove_assignees")}
                disabled={busy || done}
                label={tr("Remove them as assignees")}
                description="Their tasks stay in the project — they're just unassigned. Their past comments remain visible."
              />
              <RadioOption
                name="member-strategy"
                checked={memberStrategy === "add_as_guests"}
                onSelect={() => setMemberStrategy("add_as_guests")}
                disabled={busy || done}
                label={`Add them as guests in ${preflight.destTeamName || destTeamName}`}
                description="They keep their task assignments and access as guests."
              />
            </div>
            {memberStrategy === "add_as_guests" && (
              <p style={noteStyle}>
                {tr("If the task has been completed and you don't want them to see this project anymore, you can remove them from visibility.")}
              </p>
            )}
          </section>
        )}

        <section style={sectionStyle}>
          <div style={sectionHeadStyle}>{tr("Labels")}</div>
          <p style={sectionTextStyle}>
            {tr("This project has")} {preflight.labelCount} label{preflight.labelCount === 1 ? "" : "s"}.
          </p>
          <div style={radioGroupStyle} role="radiogroup" aria-label={tr("What to do with labels")}>
            <RadioOption
              name="label-strategy"
              checked={labelStrategy === "keep"}
              onSelect={() => setLabelStrategy("keep")}
              disabled={busy || done}
              label={tr("Keep the project's labels")}
              description="They move with the project."
            />
            <RadioOption
              name="label-strategy"
              checked={labelStrategy === "clear"}
              onSelect={() => setLabelStrategy("clear")}
              disabled={busy || done}
              label={tr("Clear all labels on move")}
              description="Every label is removed from this project's tasks."
            />
          </div>
        </section>

        {error && <div style={errorStyle}>{error}</div>}
        {done && summary && (
          <div style={doneStyle}>
            {tr("Moved —")} {summary.unassigned} {tr("unassigned,")} {summary.guestsAdded} {tr("added as guests,")}{" "}
            {summary.labelsCleared} {tr("labels cleared.")}
          </div>
        )}

        <div style={actionsStyle}>
          <button type="button" onClick={onClose} disabled={busy} style={cancelBtnStyle}>
            {tr("Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleMove()}
            disabled={busy || done}
            className="mpd-primary"
            style={{ ...primaryBtnStyle, opacity: busy || done ? 0.7 : 1 }}
          >
            {busy ? tr("Moving…") : done ? tr("Moved") : tr("Move project")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RadioOption({
  name,
  checked,
  onSelect,
  disabled,
  label,
  description,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  label: string;
  description: string;
}) {
  return (
    <label style={{ ...radioRowStyle, ...(checked ? radioRowOnStyle : null) }} className="mpd-radio">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        style={radioInputStyle}
      />
      <span style={radioTextWrapStyle}>
        <span style={radioLabelStyle}>{label}</span>
        <span style={radioDescStyle}>{description}</span>
      </span>
    </label>
  );
}

// Interaction-state deltas inline styles can't express — scoped by the `mpd-`
// prefix, mirrors the ConfirmCard family idiom.
const MPD_CSS = `
.mpd-primary { transition: filter .12s ease; }
.mpd-primary:hover:not(:disabled) { filter: brightness(1.08); }
.mpd-primary:disabled { cursor: not-allowed; }
.mpd-radio { transition: border-color .12s ease, background-color .12s ease; }
.mpd-radio:hover { border-color: var(--rule-strong); }
@media (prefers-reduced-motion: reduce) { .mpd-primary, .mpd-radio { transition: none; } }
/* Card is the query container so long member/label copy re-flows against the
   card's OWN rendered width rather than the viewport — mirrors
   NeedFieldsCard/MultiItemConfirmCard. This dialog stays single-column (radio
   descriptions need full width to stay readable), but the container-type is
   kept for consistency and to size the box correctly at narrow viewports. */
.mpd-card { container-type: inline-size; }
`;

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2500,
  background: "rgba(35, 29, 20, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
};
const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  maxHeight: "min(640px, 90vh)",
  overflowY: "auto",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-md)",
  padding: "22px 24px",
  boxSizing: "border-box",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 19,
  fontWeight: 600,
  color: "var(--ink)",
  margin: 0,
  lineHeight: 1.35,
};
const subtitleStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink-soft)",
  margin: "6px 0 0",
  lineHeight: 1.5,
};
const noticeStyle: CSSProperties = {
  marginTop: 14,
  padding: "8px 10px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--ochre)",
  background: "var(--ochre-wash)",
  borderRadius: "var(--r-sm)",
};
const sectionStyle: CSSProperties = { marginTop: 18 };
const sectionHeadStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  marginBottom: 6,
};
const sectionTextStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--ink-soft)",
  margin: 0,
};
const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};
const chipStyle: CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  borderRadius: 999,
  padding: "3px 10px",
};
const radioGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 10,
};
const radioRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  background: "var(--page)",
};
const radioRowOnStyle: CSSProperties = {
  borderColor: "var(--green-deep)",
  background: "var(--green-wash)",
};
const radioInputStyle: CSSProperties = {
  marginTop: 3,
  flexShrink: 0,
  accentColor: "var(--green-deep)",
  cursor: "pointer",
};
const radioTextWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const radioLabelStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
};
const radioDescStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--ink-mute)",
};
const noteStyle: CSSProperties = {
  marginTop: 8,
  marginLeft: 2,
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--ink-mute)",
  fontStyle: "normal",
};
const errorStyle: CSSProperties = {
  marginTop: 16,
  padding: "8px 12px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--crit)",
  background: "var(--crit-wash)",
  borderRadius: "var(--r-sm)",
};
const doneStyle: CSSProperties = {
  marginTop: 16,
  padding: "8px 12px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--green-deep)",
  fontWeight: 500,
  background: "var(--green-wash)",
  borderRadius: "var(--r-sm)",
};
const actionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 20,
  justifyContent: "flex-end",
};
const cancelBtnStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "var(--sans)",
  color: "var(--ink-soft)",
  background: "transparent",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const primaryBtnStyle: CSSProperties = {
  padding: "8px 18px",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "var(--sans)",
  color: "#f4efdf",
  background: "var(--green-deep)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
