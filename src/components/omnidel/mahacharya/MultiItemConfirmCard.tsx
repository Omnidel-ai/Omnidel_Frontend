"use client";

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import type { ActProposal, ActProposalItem } from "@/components/omnidel/mahacharya/ConfirmCard";
import { resolveLabelColor } from "@/lib/label-colors";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { useTr } from "@/lib/client/language";

interface TeamOpt { id: string; name: string; role?: string }

// ─────────────────────────────────────────────────────────────────────────────
// MultiItemConfirmCard — the checklist confirm for a create_project proposal.
// Renders the project header (name + visibility) + grouped checklists of the
// proposed cards (lists), labels, and starter tasks. Each item is included by
// default; the user can uncheck any they don't want. "Create project" replays
// the proposal args + the kept item ids (args.included) so the server creates
// exactly the checked items.
// ─────────────────────────────────────────────────────────────────────────────

type Phase = "idle" | "pending" | "done" | "failed";

const GROUP_LABEL: Record<ActProposalItem["group"], string> = {
  lists: "Cards (columns)",
  labels: "Labels",
  tasks: "Starter tasks",
};
const GROUP_ORDER: ActProposalItem["group"][] = ["lists", "labels", "tasks"];

interface Props {
  proposal: ActProposal;
  /** Re-call create_project with confirmed:true (args already carry `included`). */
  onConfirm: (proposal: ActProposal) => Promise<string | void>;
}

// Build the checklist from the proposal args (lists / labels / tasks). We derive
// it client-side rather than relying on a separately-emitted `items` array, so
// the model only has to emit `args` — that keeps the streamed act block small
// (it was duplicating the data) and far less likely to truncate.
function deriveItems(args: Record<string, unknown> | undefined): ActProposalItem[] {
  if (!args) return [];
  const asArr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const color = (v: unknown): string | null => (typeof v === "string" ? v : null);
  return [
    ...asArr(args.lists).map((l, i): ActProposalItem => ({ id: `list:${i}`, group: "lists", label: str(l.name).trim(), color: color(l.color), included: true })),
    ...asArr(args.labels).map((l, i): ActProposalItem => ({ id: `label:${i}`, group: "labels", label: str(l.label).trim(), color: color(l.color), included: true })),
    ...asArr(args.tasks).map((t, i): ActProposalItem => ({ id: `task:${i}`, group: "tasks", label: str(t.title).trim(), detail: str(t.list) ? `in ${str(t.list).trim()}` : undefined, included: true })),
  ].filter((it) => it.label);
}

export function MultiItemConfirmCard({ proposal, onConfirm }: Props) {
  const tr = useTr();
  const items = proposal.items && proposal.items.length > 0 ? proposal.items : deriveItems(proposal.args);
  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map((it) => [it.id, it.included !== false])),
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [resultMsg, setResultMsg] = useState("");

  // Where to create it. The TEAM is ALWAYS a dropdown here — the model never
  // names, guesses, or prints a team/workspace id; the user picks from their
  // own real teams. Team options are sourced server-side (access-scoped, system
  // workspaces excluded via listRelevantWorkspacesForUser) — never from the LLM.
  const argVis = typeof proposal.args?.visibility === "string" ? proposal.args.visibility : "private";
  const argWs = typeof proposal.args?.workspace_id === "string" ? proposal.args.workspace_id : "";
  // Team the user chose in the guided step-1 card (by NAME — the model never
  // handles ids). We resolve it to a real team here so the card pre-selects it.
  const argTeamName =
    typeof proposal.args?.team_name === "string" ? proposal.args.team_name.trim().toLowerCase() : "";
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamId, setTeamId] = useState<string>("");
  const [visibility, setVisibility] = useState<"private" | "workspace">(
    argVis === "workspace" ? "workspace" : "private",
  );

  useEffect(() => {
    let cancelled = false;
    setTeamsLoading(true);
    Promise.all([
      fetch("/api/omnipulse/workspaces?relevant=1"),
      fetch("/api/me/current-workspace"),
    ])
      .then(async ([w, c]) => {
        if (cancelled) return;
        const wd = w.ok ? await w.json() : { items: [] };
        const list = (wd.items || []) as TeamOpt[];
        setTeams(list);
        const cd = c.ok ? await c.json() : { item: null };
        const curWs = typeof cd.item?.workspace_id === "string" ? cd.item.workspace_id : "";
        // Default selection: step-1 chosen team (by name) → proposal's anchor →
        // current workspace → first team.
        const byName = argTeamName
          ? list.find((t) => (t.name || "").trim().toLowerCase() === argTeamName)?.id
          : "";
        const preferred =
          byName ||
          (argWs && list.some((t) => t.id === argWs) && argWs) ||
          (curWs && list.some((t) => t.id === curWs) && curWs) ||
          (list[0]?.id ?? "");
        setTeamId((prev) => prev || preferred);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => { cancelled = true; };
  }, [argWs, argTeamName]);

  const teamOptions = useMemo(() => teams.map((t) => ({ value: t.id, label: t.name })), [teams]);
  const selectedTeam = useMemo(() => teams.find((t) => t.id === teamId), [teams, teamId]);
  // Team-wide visibility is managers-only (mirrors createProjectAct's server
  // gate). Admins arrive with role:"manager" on every team from the route.
  const canTeamWide = selectedTeam?.role === "manager";

  // Never offer/keep an unauthorised visibility — the server would refuse it.
  // Gated on teamsLoading: canTeamWide is meaningless (always false) until the
  // team list — and the args.team_name resolution — has loaded, so running
  // this before then would clobber a valid "workspace" default from
  // args.visibility on mount, before we ever know the real manager role.
  useEffect(() => {
    if (!teamsLoading && !canTeamWide && visibility === "workspace") setVisibility("private");
  }, [teamsLoading, canTeamWide, visibility]);

  const visibilityOptions = [
    { value: "private", label: "Only me + people I invite" },
    ...(canTeamWide
      ? [{ value: "workspace", label: `Everyone in ${selectedTeam?.name ?? "this team"}` }]
      : []),
  ];

  const keptCount = items.filter((it) => checked[it.id]).length;

  function toggle(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  async function handleConfirm() {
    if (phase === "pending" || phase === "done") return;
    setPhase("pending");
    setResultMsg("");
    try {
      const included = items.filter((it) => checked[it.id]).map((it) => it.id);
      // Resolve the chosen team → workspace_id + a server-safe visibility.
      const workspace_id = teamId || argWs || undefined;
      const finalVisibility = visibility === "workspace" && canTeamWide ? "workspace" : "private";
      const msg = await onConfirm({
        ...proposal,
        args: { ...(proposal.args ?? {}), visibility: finalVisibility, workspace_id, included },
      });
      setPhase("done");
      setResultMsg(typeof msg === "string" && msg ? msg : "Project created.");
    } catch (err) {
      setPhase("failed");
      setResultMsg(err instanceof Error ? err.message : "That didn't go through. Please try again.");
    }
  }

  return (
    <div style={cardStyle} className="mic-card">
      <style>{MIC_CSS}</style>
      <div style={titleRowStyle}>
        <span style={badgeStyle}>{tr("New project")}</span>
        <span style={titleStyle}>{proposal.title || tr("Set up project")}</span>
      </div>

      {/* Container-query grid (mirrors NeedFieldsCard's .nfc-form treatment):
          compact pairs like Team + Who can see it sit side by side once the
          CARD ITSELF has ~480px+ of width — keyed off the card's own box
          (container-type on .mic-card), not the viewport, so it's correct in
          both the wide setup modal and the narrow docked chat bubble at the
          same viewport size. Fields dl, group checklists, hint/error, and
          the action bar all span the full row regardless (gridColumn set on
          their own style consts / inline). */}
      <div className="mic-grid" style={gridWrapStyle}>
        {/* Project fields — drop "Visibility" (the Create-in picker controls
            it). Label sits above its value as a compact micro-label so long
            values (a description) use the full card width instead of a
            narrow value column marooned across a wide gap. Always spans both
            columns — NAME/DESCRIPTION never pair up. */}
        {(() => {
          const fields = (proposal.fields ?? []).filter((f) => f.label.trim().toLowerCase() !== "visibility");
          if (fields.length === 0) return null;
          return (
            <dl style={fieldsStyle}>
              {fields.map((f, i) => (
                <div key={i} style={fieldRowStyle}>
                  <dt style={fieldLabelStyle}>{f.label}</dt>
                  <dd style={fieldValueStyle}>{f.value || "—"}</dd>
                </div>
              ))}
            </dl>
          );
        })()}

        {/* Team — ALWAYS a dropdown of the user's real, access-scoped teams.
            The model never names or picks the team; the user chooses it
            here. Pairs with "Who can see it" on wide cards (no gridColumn
            override — default grid auto-placement puts these two side by
            side). */}
        <div style={{ marginTop: 10 }}>
          <div style={groupHeadStyle}>{tr("Team")}</div>
          {teams.length > 0 ? (
            <CustomSelect
              value={teamId}
              onChange={setTeamId}
              options={teamOptions}
              placeholder={teamsLoading ? "Loading teams…" : "Select a team"}
              disabled={phase === "pending" || phase === "done" || teamsLoading}
            />
          ) : (
            <div style={{ fontSize: 12.5, fontFamily: "var(--sans)", color: "var(--ink-soft)" }}>
              {teamsLoading ? tr("Loading teams…") : tr("Personal — only you + people you invite")}
            </div>
          )}
        </div>

        {/* Who can see it — private always; team-wide only when you manage the team. */}
        {teams.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={groupHeadStyle}>{tr("Who can see it")}</div>
            <CustomSelect
              value={visibility}
              onChange={(v) => setVisibility(v === "workspace" ? "workspace" : "private")}
              options={visibilityOptions}
              disabled={phase === "pending" || phase === "done"}
            />
          </div>
        )}

        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((it) => it.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} style={groupSectionStyle}>
              <div style={groupHeadStyle}>{GROUP_LABEL[group]}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {groupItems.map((it) => (
                  <label key={it.id} style={itemRowStyle} className="mic-item">
                    {/* Custom checkbox — consistent across browsers (native
                        accentColor rendered inconsistently). */}
                    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={!!checked[it.id]}
                        disabled={phase === "pending" || phase === "done"}
                        onChange={() => toggle(it.id)}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer" }}
                      />
                      <span aria-hidden="true" style={{ ...checkBoxStyle, ...(checked[it.id] ? checkBoxOnStyle : null) }}>
                        {checked[it.id] && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f4efdf" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    </span>
                    {it.group === "labels" && (
                      <span aria-hidden="true" style={{ ...dotStyle, background: resolveLabelColor(it.color) }} />
                    )}
                    <span style={{ color: "var(--ink)" }}>{it.label}</span>
                    {it.detail && <span style={{ color: "var(--ink-mute)" }}> · {it.detail}</span>}
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {phase === "done" ? (
          <div style={doneStyle}>{resultMsg}</div>
        ) : (
          // Hint + error scroll with the checklist; the action bar stays pinned
          // to the bottom of the scroll region (sticky) so "Create project" is
          // never lost below the fold on a small screen. The clearance spacer
          // right above it guarantees the scroll region extends far enough
          // that the hint/last checklist row can be scrolled fully clear of
          // the bar, instead of the scrollable area ending exactly where the
          // bar sits (which would trap that content permanently underneath).
          <>
            {phase === "failed" && <div style={errorStyle}>{resultMsg}</div>}
            <p style={hintStyle}>{tr("Uncheck anything you don't want before creating.")}</p>
            <div aria-hidden="true" style={actionsClearanceStyle} />
            <div style={actionsStyle}>
              {(() => {
                const needsTeam = teams.length > 0 && !teamId;
                const disabled = phase === "pending" || needsTeam;
                return (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={disabled}
                    className="mic-primary"
                    style={{ ...primaryBtnStyle, opacity: disabled ? 0.6 : 1 }}
                  >
                    {phase === "pending"
                      ? tr("Creating…")
                      : needsTeam
                        ? tr("Pick a team")
                        : `Create project${keptCount > 0 ? ` (${keptCount} item${keptCount === 1 ? "" : "s"})` : ""}`}
                  </button>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Hover / disabled deltas inline styles can't express — base look stays inline
// (mirrors ConfirmCard); scoped by the `mic-` class prefix.
const MIC_CSS = `
.mic-primary { transition: filter .12s ease; }
.mic-primary:hover:not(:disabled) { filter: brightness(1.08); }
.mic-primary:disabled { cursor: not-allowed; }
.mic-item { transition: background-color .12s ease; }
.mic-item:hover { background: var(--surface-sunk); }
@media (prefers-reduced-motion: reduce) { .mic-primary, .mic-item { transition: none; } }
/* Card is the query container so the field grid responds to the card's OWN
   rendered width, not the viewport — this card renders both docked (~380px,
   the collapsed chat widget bubble) and spacious (560px+, the project-setup
   modal) at the same viewport size, so a viewport @media rule would wrongly
   force 2 columns into a docked, still-narrow bubble. Mirrors NeedFieldsCard. */
.mic-card { container-type: inline-size; width: 100%; }
.mic-grid { grid-template-columns: 1fr; }
@container (min-width: 480px) {
  .mic-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

// ─── Styles (CSS variables only — mirrors ConfirmCard) ──────────────────────
const cardStyle: CSSProperties = {
  marginTop: 8, padding: 12, background: "var(--surface)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--green-deep)", borderRadius: "var(--r-md)",
};
const titleRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const badgeStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "var(--green-deep)", background: "var(--green-wash)", padding: "2px 6px", borderRadius: 999,
};
const titleStyle: CSSProperties = { fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink)" };
// Grid wrapper for the container-query 2-col layout — display:grid only; the
// column count itself lives in the .mic-grid / @container rule in MIC_CSS so
// it responds to the card's own width, not the viewport. No `gap` here: every
// child keeps the marginTop it already had, so spacing is unchanged whether
// items stack (narrow) or pair up (wide, e.g. Team + Who can see it).
const gridWrapStyle: CSSProperties = { display: "grid" };
// Label above value (micro-label idiom, matches groupHead) so the value gets
// the full width — no marooned value column across a wide empty gap. Always
// spans both columns in the 2-up layout — NAME/DESCRIPTION never pair up.
const fieldsStyle: CSSProperties = { margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 8, gridColumn: "1 / -1" };
const fieldRowStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const fieldLabelStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "var(--ink-mute)", margin: 0,
};
const fieldValueStyle: CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.4, color: "var(--ink)", margin: 0, wordBreak: "break-word",
};
const groupHeadStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "var(--ink-mute)", marginBottom: 4,
};
// Cards/Labels/Starter-tasks checklists always span the full row — a
// checklist can't sensibly sit beside another field in the 2-up layout.
const groupSectionStyle: CSSProperties = { marginTop: 12, gridColumn: "1 / -1" };
const itemRowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontFamily: "var(--sans)",
  padding: "4px 6px", margin: "0 -6px", borderRadius: "var(--r-sm)", cursor: "pointer",
};
const dotStyle: CSSProperties = { width: 9, height: 9, borderRadius: "50%", flexShrink: 0, display: "inline-block" };
const checkBoxStyle: CSSProperties = {
  width: 16, height: 16, flexShrink: 0, borderRadius: 4,
  border: "1.5px solid var(--rule-strong)", background: "var(--surface)",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const checkBoxOnStyle: CSSProperties = { background: "var(--green-deep)", borderColor: "var(--green-deep)" };
// Sticky action bar: pins to the bottom of the scroll region and spans the card
// edge-to-edge (negative margins cancel the card's 12px padding) with a hairline
// + solid surface (fully opaque, not translucent) so any content it overlaps
// mid-scroll reads as intentionally tucked under it, not visually broken.
// Always spans the full grid row regardless of the 2-up layout.
const actionsStyle: CSSProperties = {
  position: "sticky", bottom: 0, zIndex: 1, gridColumn: "1 / -1",
  display: "flex", gap: 8, marginTop: 12,
  marginLeft: -12, marginRight: -12, marginBottom: -12,
  padding: "10px 12px",
  background: "var(--surface)",
  borderTop: "1px solid var(--rule)",
  borderBottomLeftRadius: "var(--r-md)", borderBottomRightRadius: "var(--r-md)",
};
// Clearance spacer, placed in normal flow directly above the sticky bar. The
// bar itself adds no bottom padding to the card (its negative margins bleed
// it flush to the edges), so without this the scrollable content ends
// exactly where the bar sits — the hint text / last checklist row would be
// permanently trapped underneath it, un-scrollable. Height approximates the
// bar's own rendered height (10+10 padding + ~9+9 button padding + ~16 line
// + 1px hairline), rounded up for safety across font-size/zoom variance.
const actionsClearanceStyle: CSSProperties = { gridColumn: "1 / -1", height: 56 };
const primaryBtnStyle: CSSProperties = {
  flex: 1, textAlign: "center",
  padding: "9px 13px", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600,
  color: "var(--page)", background: "var(--green-deep)", borderWidth: 0, borderRadius: "var(--r-sm)", cursor: "pointer",
};
const hintStyle: CSSProperties = { margin: "10px 0 0", fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-mute)", gridColumn: "1 / -1" };
const doneStyle: CSSProperties = { marginTop: 10, fontFamily: "var(--sans)", fontSize: 12, color: "var(--green-deep)", fontWeight: 500, gridColumn: "1 / -1" };
const errorStyle: CSSProperties = { marginTop: 10, fontFamily: "var(--sans)", fontSize: 12, color: "var(--crit)", gridColumn: "1 / -1" };
