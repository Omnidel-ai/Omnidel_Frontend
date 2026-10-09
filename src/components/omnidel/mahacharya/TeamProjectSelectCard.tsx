"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { fetchJson } from "@/lib/client/fetch-json";
import type { ActProposal } from "@/components/omnidel/mahacharya/ConfirmCard";
import { useTr } from "@/lib/client/language";

// ─────────────────────────────────────────────────────────────────────────────
// TeamProjectSelectCard — renders when a create_task proposal carries
// needsSelection:true (act-tools.ts couldn't resolve the team/project to
// exactly one real project the user can access). Instead of asking the user to
// retype a team/project name in chat (error-prone — see the "Development
// Workspace" / "Dev/Ai Team" guessing game this replaces), this shows two real
// dropdowns: the user's actual teams, then — once one is picked — that team's
// actual projects. Both are populated from the SAME endpoints the Teams/
// Projects pages use (GET /api/omnipulse/workspaces, GET /api/omnipulse/boards
// ?workspace=<id>) — real ids only, never guessed by the model.
//
// On submit, the chosen project id is merged into the original proposal's args
// as board_id and sent through the EXACT same confirm round-trip "Do it for
// me" uses (onConfirm → confirmedAct with confirmed:true) — so the task is
// created against a real id, never one the model invented.
// ─────────────────────────────────────────────────────────────────────────────

interface TeamOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
  is_active?: boolean;
}

type Phase = "idle" | "pending" | "done" | "failed";

interface TeamProjectSelectCardProps {
  proposal: ActProposal;
  onConfirm: (proposal: ActProposal) => Promise<string | void>;
}

export function TeamProjectSelectCard({ proposal, onConfirm }: TeamProjectSelectCardProps) {
  const tr = useTr();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamId, setTeamId] = useState("");

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectId, setProjectId] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [resultMsg, setResultMsg] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Load the user's real teams once.
  useEffect(() => {
    let cancelled = false;
    setTeamsLoading(true);
    fetchJson<{ items?: TeamOption[] }>("/api/omnipulse/workspaces")
      .then((data) => {
        if (cancelled) return;
        setTeams(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load that team's real projects once a team is picked.
  useEffect(() => {
    if (!teamId) {
      setProjects([]);
      setProjectId("");
      return;
    }
    let cancelled = false;
    setProjectId("");
    setProjectsLoading(true);
    fetchJson<{ items?: ProjectOption[] }>(
      `/api/omnipulse/boards?workspace=${encodeURIComponent(teamId)}`,
    )
      .then((data) => {
        if (cancelled) return;
        const items = (Array.isArray(data?.items) ? data.items : []).filter(
          (b) => b.is_active !== false,
        );
        setProjects(items);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const teamOptions = useMemo(
    () => teams.map((t) => ({ value: t.id, label: t.name })),
    [teams],
  );
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects],
  );

  const canSubmit = !!teamId && !!projectId && phase === "idle";

  async function handleSubmit() {
    if (!canSubmit) return;
    setPhase("pending");
    setError("");
    const merged: ActProposal = {
      ...proposal,
      needsSelection: false,
      args: { ...(proposal.args ?? {}), board_id: projectId },
    };
    try {
      const msg = await onConfirm(merged);
      setPhase("done");
      setResultMsg(typeof msg === "string" && msg ? msg : "Done.");
    } catch (err) {
      setPhase("failed");
      setResultMsg(err instanceof Error ? err.message : "That didn't go through. Please try again.");
    }
  }

  const taskTitle = typeof proposal.args?.title === "string" ? proposal.args.title : "";

  return (
    <div style={cardStyle}>
      <div style={titleRowStyle}>
        <span style={badgeStyle}>{tr("Selection needed")}</span>
        <span style={titleStyle}>{taskTitle ? `Where should "${taskTitle}" go?` : tr("Where should this go?")}</span>
      </div>
      <p style={hintStyle}>{tr("Pick the team, then the project — I'll create the task there.")}</p>

      {phase === "done" ? (
        <div style={doneStyle}>{resultMsg}</div>
      ) : (
        <>
          <div style={formStyle}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>{tr("Team")}</span>
              <CustomSelect
                value={teamId}
                onChange={(v) => {
                  setTeamId(v);
                  if (error) setError("");
                }}
                options={teamOptions}
                placeholder={teamsLoading ? "Loading teams…" : "Select a team"}
                disabled={phase !== "idle" || teamsLoading}
              />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>{tr("Project")}</span>
              <CustomSelect
                value={projectId}
                onChange={(v) => {
                  setProjectId(v);
                  if (error) setError("");
                }}
                options={projectOptions}
                placeholder={
                  !teamId
                    ? "Pick a team first"
                    : projectsLoading
                      ? "Loading projects…"
                      : projectOptions.length === 0
                        ? "No projects in this team"
                        : "Select a project"
                }
                disabled={phase !== "idle" || !teamId || projectsLoading}
              />
            </label>
          </div>

          <div style={actionsStyle}>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              style={{ ...primaryBtnStyle, opacity: canSubmit ? 1 : 0.6 }}
            >
              {phase === "pending" ? tr("Working…") : tr("Create task")}
            </button>
          </div>
          {phase === "failed" && <div style={errorStyle}>{resultMsg}</div>}
          {error && <div style={errorStyle}>{error}</div>}
        </>
      )}
    </div>
  );
}

// ─── Styles (CSS variables only, matching ConfirmCard's idiom) ──────────────

const cardStyle: CSSProperties = {
  marginTop: 8,
  padding: 12,
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  borderRadius: "var(--r-md)",
};
const titleRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const badgeStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 9,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--green-deep)",
  background: "var(--green-wash)",
  padding: "2px 6px",
  borderRadius: 999,
};
const titleStyle: CSSProperties = { fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink)" };
const hintStyle: CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--ink-soft)",
};
const formStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, marginTop: 10 };
const labelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const labelTextStyle: CSSProperties = { fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-mute)" };
const actionsStyle: CSSProperties = { display: "flex", gap: 8, marginTop: 12 };
const primaryBtnStyle: CSSProperties = {
  padding: "7px 13px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--page)",
  background: "var(--green-deep)",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const doneStyle: CSSProperties = {
  marginTop: 10,
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--green-deep)",
  fontWeight: 500,
};
const errorStyle: CSSProperties = {
  marginTop: 10,
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--crit)",
};
