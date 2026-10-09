"use client";

import { useMemo, useState, useEffect, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { PinButton } from "@/components/omnidel/pin-button";
import { TeamActionsMenu } from "@/components/omnidel/team-actions-menu";
import {
  CardCountsMeta,
  NoMatchState,
  gridStyle,
  cardWrapStyle,
  cardStyle,
  cardTitleStyle,
  cardMetaStyle,
  cardActionsStyle,
  teamIconStyle,
  controlsRowStyle,
} from "@/components/omnidel/omnipulse/board-card-shared";
import { useTr } from "@/lib/client/language";

// Plain, serializable team shape handed down from the server page.
export interface TeamGridTeam {
  id: string;
  name: string;
  count: number;
  memberCount: number;
  slug: string | null;
  description: string | null;
  color: string | null;
  icon_hint: string | null;
  visibility: "public" | "private";
  is_system: boolean;
  is_protected: boolean;
  is_active: boolean;
  canManage: boolean;
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// Compact quick-filter pill shown on the right of the teams toolbar — a
// visible toggle (not buried in a dropdown) so "with projects" / "archived"
// are one click away.
function QuickToggle({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      style={{
        padding: "6px 14px",
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--rule-strong)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: active ? "var(--green-deep)" : "transparent",
        color: active ? "#f4efdf" : "var(--ink-soft)",
      }}
    >
      {label}
    </button>
  );
}

const teamSearchStyle: CSSProperties = {
  flex: "0 1 320px",
  minWidth: 160,
  padding: "8px 12px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink)",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
};

export function TeamsGrid({
  teams,
  actions,
}: {
  teams: TeamGridTeam[];
  actions?: ReactNode;
}) {
  const tr = useTr();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 200);
  // Archived (deactivated) teams are hidden by default; a manager who manages
  // at least one archived team gets a toggle to reveal them (so a deactivated
  // team stays reachable for restore — same pattern as the projects view).
  const [showArchived, setShowArchived] = useState(false);
  // "Show only teams with projects" — hides empty (0-project) teams so a member
  // of many not-yet-populated teams can focus on the active ones.
  const [onlyWithProjects, setOnlyWithProjects] = useState(false);
  const showGear = teams.some((t) => !t.is_active && t.canManage);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return teams.filter((t) => {
      if (!showArchived && !t.is_active) return false;
      if (onlyWithProjects && t.count === 0) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [teams, debounced, showArchived, onlyWithProjects]);

  return (
    <div>
      {/* Lift the card holding an open action menu above its siblings so the
          dropdown isn't painted under the next card (z-index fix).
          On phones keep search + "With projects" + "New Project" on ONE row:
          stop the toolbar wrapping and let the search shrink (its inline
          flex-basis/min-width need !important to give way). */}
      <style>{`
        .opx-card-wrap:focus-within{z-index:60;}
        @media (max-width: 767px) {
          .teams-controls { flex-wrap: nowrap !important; }
          .teams-controls .teams-search { flex: 1 1 auto !important; min-width: 0 !important; }
          .teams-controls .teams-controls-actions { flex-shrink: 0; }
        }
      `}</style>
      {teams.length > 0 && (
        <div className="teams-controls" style={controlsRowStyle}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Search teams...")}
            aria-label={tr("Search teams")}
            className="teams-search"
            style={teamSearchStyle}
          />
          <div className="teams-controls-actions" style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <QuickToggle
              key="with-projects"
              active={onlyWithProjects}
              onClick={() => setOnlyWithProjects((v) => !v)}
              label={tr("With projects")}
              title={tr("On: show only teams that already have at least one project. Off: show all your teams, including empty ones.")}
            />
            {showGear ? (
              <QuickToggle
                key="archived"
                active={showArchived}
                onClick={() => setShowArchived((v) => !v)}
                label={tr("Archived")}
              />
            ) : null}
            {actions != null ? (
              <span key="teams-grid-actions" style={{ display: "inline-flex", alignItems: "center" }}>
                {actions}
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div style={gridStyle}>
        {filtered.map((t, i) => {
          const archived = !t.is_active;
          const isSynthetic = t.id === "type:private" || t.id === "type:everyone";
          const syntheticColor = t.id === "type:private" ? "#7c3aed" : "#0f766e";
          const syntheticWash = t.id === "type:private" ? "rgba(124, 58, 237, 0.08)" : "rgba(15, 118, 110, 0.08)";
          return (
          <div key={`${t.id}::${i}`} className="opx-card-wrap" style={cardWrapStyle}>
            <Link
              href={`/omnipulse/boards?workspace=${t.id}`}
              // Team cards hold only two lines (name row + counts) — center them
              // vertically so the shared card height doesn't read as bottom slack.
              style={{
                ...cardStyle,
                justifyContent: "center",
                opacity: archived ? 0.6 : 1,
                background: isSynthetic ? syntheticWash : cardStyle.background,
                borderColor: isSynthetic ? syntheticColor : cardStyle.borderColor,
                borderLeft: isSynthetic ? `4px solid ${syntheticColor}` : undefined,
              }}
              data-mah={i === 0 ? "team-open" : undefined}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  // Reserve room for the absolute top-right action cluster so a
                  // long team name never runs under the pin / menu controls.
                  paddingRight: 40,
                }}
              >
                <div
                  style={{
                    ...teamIconStyle,
                    marginBottom: 0,
                    flexShrink: 0,
                    background: isSynthetic ? "#fff" : teamIconStyle.background,
                    color: isSynthetic ? syntheticColor : teamIconStyle.color,
                    border: isSynthetic ? `1px solid ${syntheticColor}` : undefined,
                  }}
                  aria-hidden="true"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div style={{ minWidth: 0, paddingRight: 0 }}>
                  <div
                    // title: this line ellipsises, so hover is the only way to
                    // read a long team name in full.
                    title={t.name}
                    style={{
                      ...cardTitleStyle,
                      paddingRight: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                      marginBottom: isSynthetic ? 2 : 4,
                    }}
                  >
                    {t.name}
                  </div>
                  {isSynthetic && (
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: syntheticColor,
                      }}
                    >
                      {tr("System generated")}
                    </div>
                  )}
                </div>
              </div>
              {archived && <div style={{ ...cardMetaStyle, color: "var(--ochre)" }}>{tr("ARCHIVED")}</div>}
              <CardCountsMeta projects={t.count} members={t.memberCount} />
            </Link>
            <div style={cardActionsStyle}>
              {t.canManage && (
                <TeamActionsMenu
                  team={{
                    id: t.id,
                    name: t.name,
                    slug: t.slug,
                    description: t.description,
                    color: t.color,
                    icon_hint: t.icon_hint,
                    visibility: t.visibility,
                    is_system: t.is_system,
                    is_protected: t.is_protected,
                    is_active: t.is_active,
                  }}
                />
              )}
              <PinButton
                item={{ type: "team", id: t.id, name: t.name, href: `/omnipulse/boards?workspace=${t.id}` }}
              />
            </div>
          </div>
          );
        })}

        {filtered.length === 0 && teams.length > 0 && (
          <NoMatchState key="no-match">{tr("No teams match “")}{debounced.trim()}&rdquo;.</NoMatchState>
        )}
      </div>
    </div>
  );
}
