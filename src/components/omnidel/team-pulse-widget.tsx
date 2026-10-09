"use client";

// UNUSED — Page audit 2026-09-16: nothing in src/ imports this module.
// No importers (511 lines).
// Deletion candidate. See docs/architecture/page-audit-2026-09-16.md.

import { useEffect, useState } from "react";
import { useTr } from "@/lib/client/language";

// ---------------------------------------------------------------------------
// Types (mirror the service interface — no server import on client)
// ---------------------------------------------------------------------------

interface LanePulse {
  lane: string;
  open: number;
  done: number;
}

interface TopPerformer {
  user_id: string;
  name: string;
  tasks_done: number;
}

interface UrgentTask {
  id: string;
  title: string;
  lane: string | null;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
}

interface TeamPulseSummary {
  generated_at: string;
  week_start: string;
  week_tasks_done: number;
  week_tasks_open: number;
  overdue_tasks: number;
  by_lane: LanePulse[];
  top_performers: TopPerformer[];
  urgent_open: UrgentTask[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable lane labels matching the project vocabulary. */
const LANE_LABELS: Record<string, string> = {
  m_offices: "100 Offices",
  m_balconies: "100 Balconies",
  m_biophilic: "Biophilic Projects",
  m_retail: "Daily Retail",
  people: "People",
  platform: "Platform",
  governance: "Governance",
  unassigned: "Unassigned",
};

function laneLabel(lane: string): string {
  return LANE_LABELS[lane] || lane;
}

/** Formats a YYYY-MM-DD date as a short "May 6" style string. */
function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Returns whether a due_date string is in the past. */
function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(`${due}T23:59:59Z`).getTime() < Date.now();
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function PulseSkeleton() {
  const bar = (w: string) => (
    <div
      style={{
        height: 12,
        width: w,
        borderRadius: "var(--r-sm)",
        background: "var(--surface-sunk)",
        animation: "pulse-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
        padding: "var(--card-pad)",
      }}
    >
      {/* Eyebrow skeleton */}
      <div style={{ marginBottom: 20 }}>{bar("120px")}</div>

      {/* Stat chips skeleton */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {["80px", "80px", "80px"].map((w, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 64,
              borderRadius: "var(--r-md)",
              background: "var(--surface-sunk)",
              animation: "pulse-shimmer 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      {/* Body skeleton rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {["100%", "80%", "90%", "70%"].map((w, i) => (
          <div key={i}>{bar(w)}</div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat chip
// ---------------------------------------------------------------------------

interface StatChipProps {
  label: string;
  value: number;
  color: "ok" | "amber" | "crit" | "ink-mute";
}

function StatChip({ label, value, color }: StatChipProps) {
  const colorVar = color === "ink-mute" ? "var(--ink-mute)" : `var(--${color})`;
  const bgVar = color === "ink-mute" ? "var(--surface-sunk)" : `var(--${color}-wash)`;

  return (
    <div
      style={{
        flex: 1,
        background: bgVar,
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: colorVar,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--serif)",
          fontSize: 32,
          lineHeight: 1,
          color: colorVar,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lane bar row
// ---------------------------------------------------------------------------

function LaneBar({ lane, open, done }: LanePulse) {
  const total = open + done;
  const pct = total > 0 ? done / total : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Lane label */}
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          width: 130,
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {laneLabel(lane)}
      </span>

      {/* Progress track */}
      <div
        style={{
          flex: 1,
          height: 5,
          background: "var(--surface-sunk)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, pct * 100)}%`,
            background: pct >= 0.6 ? "var(--ok)" : pct >= 0.3 ? "var(--amber)" : "var(--crit)",
            borderRadius: 999,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* Counts */}
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-mute)",
          whiteSpace: "nowrap",
          width: 52,
          textAlign: "right",
        }}
      >
        {done} / {total}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------

export function TeamPulseWidget() {
  const tr = useTr();
  const [data, setData] = useState<TeamPulseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPulse() {
      try {
        const res = await fetch("/api/omnimart/scorecard/summary");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json.item as TeamPulseSummary);
      } catch (err) {
        if (!cancelled) setError("Could not load team pulse.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPulse();
    return () => { cancelled = true; };
  }, []);

  // ---- Loading skeleton ----
  if (loading) return <PulseSkeleton />;

  // ---- Error state ----
  if (error || !data) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          padding: "var(--card-pad)",
          textAlign: "center",
          color: "var(--ink-mute)",
          fontSize: 13,
        }}
      >
        {error || tr("Team pulse unavailable.")}
      </div>
    );
  }

  // ---- Data view ----
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
        padding: "var(--card-pad)",
      }}
    >
      {/* Eyebrow + heading */}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 4,
        }}
      >
        {tr("TEAM PULSE · THIS WEEK")}
      </div>
      <h3
        style={{
          fontFamily: "var(--serif)",
          fontSize: 20,
          marginBottom: 18,
          color: "var(--ink)",
        }}
      >
        {tr("How the team is moving")}
      </h3>

      {/* ---- Stat chips ---- */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <StatChip label={tr("Done")} value={data.week_tasks_done} color="ok" />
        <StatChip label={tr("Open")} value={data.week_tasks_open} color="ink-mute" />
        <StatChip label={tr("Overdue")} value={data.overdue_tasks} color={data.overdue_tasks > 0 ? "crit" : "ok"} />
      </div>

      {/* ---- Two-column body ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* Left: Lane breakdown */}
        <div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              marginBottom: 12,
            }}
          >
            {tr("BY MISSION LANE")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.by_lane.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>{tr("No tasks this week")}</span>
            ) : (
              data.by_lane.map((l) => <LaneBar key={l.lane} {...l} />)
            )}
          </div>
        </div>

        {/* Right: Top performers + urgent tasks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Top performers */}
          <div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                marginBottom: 10,
              }}
            >
              {tr("TOP PERFORMERS")}
            </div>
            {data.top_performers.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>
                {tr("No completed tasks yet")}
              </span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.top_performers.map((p, i) => (
                  <div
                    key={p.user_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: i === 0 ? "var(--green-deep)" : "var(--ink-soft)", fontWeight: i === 0 ? 500 : 400 }}>
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--ink-mute)",
                      }}
                    >
                      {p.tasks_done} done
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Urgent tasks feed */}
          {data.urgent_open.length > 0 && (
            <div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  marginBottom: 10,
                }}
              >
                {tr("NEEDS ATTENTION")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.urgent_open.map((t) => {
                  const overdue = isOverdue(t.due_date);
                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: "8px 10px",
                        background: overdue ? "var(--crit-wash)" : "var(--surface-sunk)",
                        borderRadius: "var(--r-sm)",
                        borderLeft: `2px solid ${overdue ? "var(--crit)" : "var(--amber)"}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--ink)",
                          fontWeight: 500,
                          marginBottom: 3,
                          lineHeight: 1.35,
                        }}
                      >
                        {t.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: overdue ? "var(--crit)" : "var(--ink-mute)",
                        }}
                      >
                        {t.lane && (
                          <span>{laneLabel(t.lane)}</span>
                        )}
                        {t.due_date && (
                          <>
                            <span style={{ color: "var(--rule-strong)" }}>&middot;</span>
                            <span>{overdue ? `OVERDUE · ${shortDate(t.due_date)}` : `DUE ${shortDate(t.due_date)}`}</span>
                          </>
                        )}
                        {t.assignee_name && (
                          <>
                            <span style={{ color: "var(--rule-strong)" }}>&middot;</span>
                            <span style={{ color: "var(--ink-mute)" }}>{t.assignee_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer — generated at */}
      <div
        style={{
          marginTop: 18,
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          textAlign: "right",
        }}
      >
        {tr("WEEK FROM")} {data.week_start}
      </div>
    </div>
  );
}
