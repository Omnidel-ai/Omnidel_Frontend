"use client";

import { useMemo, useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { PinButton } from "@/components/omnidel/pin-button";
import { BoardEditButton } from "@/components/omnidel/board-edit-button";
import {
  dotColorVar,
  BoardTaskStatus,
  NoMatchState,
  type BoardTaskCounts,
  gridStyle,
  cardWrapStyle,
  cardStyle,
  cardTitleStyle,
  cardTagRowStyle,
  ProjectLeadTag,
  cardMetaStyle,
  cardDescStyle,
  cardActionsStyle,
  controlsRowStyle,
} from "@/components/omnidel/omnipulse/board-card-shared";
import { PROJECT_VISIBILITY, PROJECT_VISIBILITY_BADGE_LABELS, type ProjectVisibility } from "@/lib/project-visibility";
import { MultiFilter, type FilterSectionConfig } from "@/components/omnidel/multi-filter";
import { StatusTag } from "@/components/omnidel/master-form";
import { useTr } from "@/lib/client/language";

// Plain, serializable board shape handed down from the server page.
export interface ProjectGridBoard {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  visibility: "workspace" | "org" | "private";
  visibility_type: ProjectVisibility;
  workspace_id: string | null;
  acharya_id: string | null;
  is_active: boolean;
  /** Everyone project flagged as an announcement channel (Home reads these). */
  is_announcement?: boolean;
  /** Project lead — id for the editor, resolved name for the card pill. */
  project_lead_id?: string | null;
  project_lead_name?: string | null;
}

// 200ms debounce on the search term so a fast typist doesn't re-filter on
// every keystroke. Client-side filtering only — list sizes here are small.
function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function ProjectsGrid({
  boards,
  taskCounts,
  workspaceName,
  canManage,
  canCreate,
  actions,
}: {
  boards: ProjectGridBoard[];
  // Serialized BoardTaskCounts keyed by board id (a Map can't cross the
  // server→client boundary, so the page sends a plain record).
  taskCounts: Record<string, BoardTaskCounts>;
  workspaceName: string | null;
  canManage: boolean;
  canCreate: boolean;
  actions?: ReactNode;
}) {
  const tr = useTr();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 200);
  // Archived (is_active=false) projects are only sent to the client for
  // managers (the server gates the include). They're hidden by default; the
  // Filters panel lets a manager reveal them so an archived project stays reachable.
  const [showArchived, setShowArchived] = useState(false);
  const [visibilityFilters, setVisibilityFilters] = useState<string[]>([]);
  const archivedCount = useMemo(() => boards.filter((b) => !b.is_active).length, [boards]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return boards.filter((b) => {
      if (!showArchived && !b.is_active) return false;
      if (visibilityFilters.length > 0 && !visibilityFilters.includes(b.visibility_type)) return false;
      if (q && !b.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [boards, debounced, showArchived, visibilityFilters]);

  const filterSections: FilterSectionConfig[] = useMemo(() => {
    const sections: FilterSectionConfig[] = [
      {
        key: "visibility",
        type: "checklist",
        label: "Visibility",
        options: [
          { value: PROJECT_VISIBILITY.EVERYONE, label: PROJECT_VISIBILITY_BADGE_LABELS[PROJECT_VISIBILITY.EVERYONE] },
          { value: PROJECT_VISIBILITY.TEAM, label: PROJECT_VISIBILITY_BADGE_LABELS[PROJECT_VISIBILITY.TEAM] },
          {
            value: PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS,
            label: PROJECT_VISIBILITY_BADGE_LABELS[PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS],
          },
          { value: PROJECT_VISIBILITY.TEAM_GUESTS, label: PROJECT_VISIBILITY_BADGE_LABELS[PROJECT_VISIBILITY.TEAM_GUESTS] },
          { value: PROJECT_VISIBILITY.PRIVATE, label: PROJECT_VISIBILITY_BADGE_LABELS[PROJECT_VISIBILITY.PRIVATE] },
        ],
        value: visibilityFilters,
        onChange: setVisibilityFilters,
      },
    ];
    if (canManage && archivedCount > 0) {
      sections.push({
        key: "archived",
        type: "toggle",
        label: "Archive",
        toggleLabel: `Show archived (${archivedCount})`,
        checked: showArchived,
        onChange: setShowArchived,
      });
    }
    return sections;
  }, [visibilityFilters, canManage, archivedCount, showArchived]);

  return (
    <div>
      {/* Lift the card holding an open action menu above its siblings so the
          dropdown isn't painted under the next card (z-index fix).
          On phones keep search + New Project on ONE row. */}
      <style>{`
        .opx-card-wrap:focus-within{z-index:60;}
        @media (max-width: 767px) {
          .projects-controls { flex-wrap: nowrap !important; }
          .projects-controls > :first-child { flex: 1 1 auto !important; min-width: 0 !important; }
          .projects-controls > :last-child { flex-shrink: 0; }
        }
      `}</style>
      {boards.length > 0 && (
        <div className="projects-controls" style={controlsRowStyle}>
          <MultiFilter
            searchInput={search}
            onSearchChange={setSearch}
            searchPlaceholder={tr("Search projects...")}
            sections={filterSections}
          />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {actions}
          </div>
        </div>
      )}

      <div style={gridStyle}>
        {filtered.map((b, i) => {
          const archived = !b.is_active;
          return (
          <div key={b.id} className="opx-card-wrap" style={cardWrapStyle} data-mah={i === 0 ? "board-open" : undefined}>
            <Link
              href={`/omnipulse/boards/${b.id}`}
              style={{ ...cardStyle, borderLeft: `4px solid ${dotColorVar(b.color)}`, opacity: archived ? 0.6 : 1 }}
            >
              {/* Title and status tag stack — they must not share a wrapping
                  flex row. Inline, the tag's position depended on the title's
                  length: a short name ("Devv Tests") left it free to sit up on
                  the title line, where it ran under the absolutely-positioned
                  menu + pin cluster, while a long name pushed it down onto its
                  own line. Stacking pins it to one place on every card, and
                  clears the icons by construction. Teams cards already lay
                  their ARCHIVED label out this way. */}
              {/* title: the card clamps long names, so hover is the only way
                  to read one in full. */}
              <div style={cardTitleStyle} title={b.name}>{b.name}</div>
              <div style={cardTagRowStyle}>
                <StatusTag active={!archived} />
                {b.project_lead_name && <ProjectLeadTag name={b.project_lead_name} />}
              </div>
              {!archived && b.visibility_type !== PROJECT_VISIBILITY.TEAM && (
                <div
                  style={{
                    ...cardMetaStyle,
                    color: b.visibility_type === PROJECT_VISIBILITY.PRIVATE ? "#7c3aed" : b.visibility_type === PROJECT_VISIBILITY.EVERYONE ? "#0f766e" : "var(--ochre)",
                  }}
                >
                  {PROJECT_VISIBILITY_BADGE_LABELS[b.visibility_type].toUpperCase()}
                </div>
              )}
              {b.description && <div style={cardDescStyle}>{b.description}</div>}
              <BoardTaskStatus counts={taskCounts[b.id]} />
            </Link>
            <div style={cardActionsStyle}>
              {(canManage || canCreate) && (
                <BoardEditButton
                  board={{
                    id: b.id,
                    name: b.name,
                    description: b.description,
                    color: b.color,
                    visibility: b.visibility,
                    visibility_type: b.visibility_type,
                    workspace_id: b.workspace_id,
                    acharya_id: b.acharya_id,
                    is_active: b.is_active,
                    is_announcement: b.is_announcement,
                    project_lead_id: b.project_lead_id,
                  }}
                  canManage={canManage}
                  canCreate={canCreate}
                />
              )}
              <PinButton
                item={{ type: "board", id: b.id, name: b.name, href: `/omnipulse/boards/${b.id}` }}
              />
            </div>
          </div>
          );
        })}

        {filtered.length === 0 && boards.length > 0 && (
          <NoMatchState>
            {tr("No projects")}{workspaceName ? ` in ${workspaceName}` : ""} {tr("match “")}{debounced.trim()}&rdquo;.
          </NoMatchState>
        )}
      </div>
    </div>
  );
}

// Manager-only gear → small menu with a "Show archived" toggle. Shared by the
// projects grid and the teams grid (label differs).
export function ArchivedToggle({
  showArchived,
  onToggle,
  archivedCount,
  label = "Show archived projects",
}: {
  showArchived: boolean;
  onToggle: (next: boolean) => void;
  archivedCount: number;
  label?: string;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        title={tr("Project view settings")}
        aria-label={tr("Project view settings")}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: "var(--r-sm)", cursor: "pointer",
          border: "1px solid var(--rule)", background: open ? "var(--surface-sunk)" : "var(--surface)",
          color: "var(--ink-mute)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div style={gearMenuStyle} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => { onToggle(!showArchived); setOpen(false); }}
            style={gearMenuRowStyle}
          >
            <span>{label}</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              color: showArchived ? "var(--green-deep)" : "var(--ink-mute)", fontWeight: 600,
            }}>
              {archivedCount}
              <span style={{
                width: 30, height: 18, borderRadius: 999, position: "relative", flexShrink: 0,
                background: showArchived ? "var(--green-deep)" : "var(--rule-strong)",
              }}>
                <span style={{
                  position: "absolute", top: 2, left: showArchived ? 14 : 2, width: 14, height: 14,
                  borderRadius: "50%", background: "#f4efdf",
                }} />
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

const gearMenuStyle: CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 1000, minWidth: 240,
  background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)", padding: "4px 0",
};
const gearMenuRowStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 12,
  padding: "9px 12px", fontSize: 13, fontFamily: "var(--sans)", textAlign: "left",
  border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer",
};
