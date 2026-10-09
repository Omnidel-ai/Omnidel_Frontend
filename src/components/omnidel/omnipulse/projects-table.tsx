"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { BoardEditButton } from "@/components/omnidel/board-edit-button";
import { PinButton } from "@/components/omnidel/pin-button";
import { Pagination, TableControls, useTablePagination } from "@/components/omnidel/table-controls";
import { tableActBtnStyle } from "@/components/omnidel/table-ui";
import { type BoardTaskCounts } from "@/components/omnidel/omnipulse/board-card-shared";
import { useTr } from "@/lib/client/language";

export interface ProjectsTableProject {
  id: string;
  name: string;
  teamName: string | null;
  description: string | null;
  color: string | null;
  visibility: "workspace" | "org" | "private";
  projectTypeLabel: string | null;
  acharya_id: string | null;
  is_active: boolean;
  canManage: boolean;
  taskCounts: BoardTaskCounts;
  myTaskCount: number;
}

type SortKey = "project" | "team" | "total" | "mine" | "status";

// Matches the wash/foreground pairs used by the Sales Pipeline source, cycle,
// and health tags. Team names are assigned from the full project list so the
// same team keeps the same treatment across sorting, searching, and paging.
const TEAM_TAG_TONES: CSSProperties[] = [
  { background: "var(--green-wash)", color: "var(--green-deep)" },
  { background: "var(--terra-wash)", color: "var(--terracotta)" },
  { background: "var(--ochre-wash)", color: "var(--ochre)" },
  { background: "var(--ok-wash)", color: "var(--ok)" },
  { background: "var(--crit-wash)", color: "var(--crit)" },
  { background: "var(--surface-sunk)", color: "var(--ink-soft)" },
];

const NO_TEAM_TAG_TONE: CSSProperties = {
  background: "var(--surface-sunk)",
  color: "var(--ink-mute)",
};

// No-workspace projects get their own colour by visibility so Private and
// Everyone read as distinct states, not a grey "no team".
const PRIVATE_TAG_TONE: CSSProperties = {
  background: "var(--ochre-wash)",
  color: "var(--ochre)",
};
const EVERYONE_TAG_TONE: CSSProperties = {
  background: "var(--ok-wash)",
  color: "var(--ok)",
};

export function ProjectsTable({
  projects,
  canCreate,
}: {
  projects: ProjectsTableProject[];
  canCreate: boolean;
}) {
  const tr = useTr();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("project");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const teamTagTones = useMemo(() => {
    const teamNames = Array.from(new Set(
      projects
        .map((project) => project.teamName?.trim())
        .filter((teamName): teamName is string => Boolean(teamName)),
    )).sort((a, b) => a.localeCompare(b));

    return new Map(
      teamNames.map((teamName, index) => [
        teamName,
        TEAM_TAG_TONES[index % TEAM_TAG_TONES.length],
      ]),
    );
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.teamName || "").toLowerCase().includes(q)
    );
  }, [projects, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "project") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "team") return (a.teamName || "").localeCompare(b.teamName || "") * dir;
      if (sortKey === "total") return (a.taskCounts.total - b.taskCounts.total) * dir;
      if (sortKey === "mine") return (a.myTaskCount - b.myTaskCount) * dir;
      return (statusScore(a.taskCounts) - statusScore(b.taskCounts)) * dir;
    });
  }, [filtered, sortDir, sortKey]);

  const { page, setPage, perPage, setPerPage } = useTablePagination(10, sorted.length, `${search}:${sortKey}:${sortDir}`);
  const rows = sorted.slice((page - 1) * perPage, page * perPage);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (projects.length === 0) {
    return (
      <div className="table-wrap" style={emptyWrapStyle}>
        <div className="table-empty" style={{ flex: "none" }}>{tr("You are not part of any projects yet.")}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <TableControls search={search} onSearch={setSearch} />
      <style>{`.opx-project-row:focus-within{position:relative;z-index:80;}`}</style>
      <div style={tableScrollStyle}>
        <div className="table-wrap" style={tableWrapStyle}>
          <div className="table-header" style={rowGridStyle}>
            <HeaderCell label={tr("PROJECT NAME")} sortKey="project" active={sortKey === "project"} dir={sortDir} onSort={toggleSort} />
            <HeaderCell label={tr("TEAM NAME")} sortKey="team" active={sortKey === "team"} dir={sortDir} onSort={toggleSort} />
            <HeaderCell label={tr("TOTAL TASKS")} sortKey="total" active={sortKey === "total"} dir={sortDir} onSort={toggleSort} />
            <HeaderCell label={tr("MY TASKS")} sortKey="mine" active={sortKey === "mine"} dir={sortDir} onSort={toggleSort} />
            <StatusHeaderCell active={sortKey === "status"} dir={sortDir} onSort={toggleSort} />
            <span>{tr("ACTIONS")}</span>
          </div>

          {rows.length === 0 ? (
            <div className="table-empty" style={{ flex: "none" }}>
              {tr("No projects match \"")}{search.trim()}".
            </div>
          ) : (
            rows.map((project) => (
              <div key={project.id} className="table-row opx-project-row" style={projectRowStyle}>
                <ProjectNameCell project={project} />
                <TeamNameTag
                  teamName={project.teamName}
                  visibility={project.visibility}
                  tone={
                    project.teamName?.trim()
                      ? teamTagTones.get(project.teamName.trim()) ?? NO_TEAM_TAG_TONE
                      : project.visibility === "private"
                        ? PRIVATE_TAG_TONE
                        : project.visibility === "org"
                          ? EVERYONE_TAG_TONE
                          : NO_TEAM_TAG_TONE
                  }
                />
                <CountCell value={project.taskCounts.total} />
                <CountCell value={project.myTaskCount} />
                <StatusBreakdown counts={project.taskCounts} />
                <span style={actionsStyle}>
                  <Link href={`/omnipulse/boards/${project.id}`} style={viewBtnStyle}>
                    {tr("View")}
                  </Link>
                  <PinButton
                    item={{ type: "board", id: project.id, name: project.name, href: `/omnipulse/boards/${project.id}` }}
                    style={{ width: 28, height: 28 }}
                  />
                  <BoardEditButton
                    board={{
                      id: project.id,
                      name: project.name,
                    description: project.description,
                    color: project.color,
                    visibility: project.visibility,
                    acharya_id: project.acharya_id,
                    is_active: project.is_active,
                    }}
                    canManage={project.canManage}
                    canCreate={canCreate}
                  />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <Pagination
        page={page}
        total={sorted.length}
        perPage={perPage}
        onChange={setPage}
        onPerPageChange={setPerPage}
        label="projects"
      />
    </div>
  );
}

function HeaderCell({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <button type="button" onClick={() => onSort(sortKey)} style={headerBtnStyle}>
      <span>{label}</span>
      <SortIcon active={active} dir={dir} />
    </button>
  );
}

function StatusHeaderCell({
  active,
  dir,
  onSort,
}: {
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const tr = useTr();
  return (
    <button type="button" onClick={() => onSort("status")} style={statusHeaderBtnStyle}>
      <span style={statusColumnsStyle}>
        <span>{tr("PLANNED")}</span>
        <span style={hiddenStatusSeparatorStyle} aria-hidden="true">/</span>
        <span>{tr("DOING")}</span>
        <span style={hiddenStatusSeparatorStyle} aria-hidden="true">/</span>
        <span>{tr("DONE")}</span>
      </span>
      <span style={statusSortIconStyle}>
        <SortIcon active={active} dir={dir} />
      </span>
    </button>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true" style={{ color: active ? "var(--green-deep)" : "var(--ink-mute)", flexShrink: 0 }}>
      {active ? (
        dir === "asc"
          ? <path d="M5 1l3.5 5h-7L5 1z" fill="currentColor" />
          : <path d="M5 11L1.5 6h7L5 11z" fill="currentColor" />
      ) : (
        <>
          <path d="M5 1l3 3.5H2L5 1z" fill="currentColor" opacity="0.55" />
          <path d="M5 11L2 7.5h6L5 11z" fill="currentColor" opacity="0.55" />
        </>
      )}
    </svg>
  );
}

function ProjectNameCell({ project }: { project: ProjectsTableProject }) {
  return (
    <Link href={`/omnipulse/boards/${project.id}`} title={project.name} style={projectNameStyle}>
      {project.name}
    </Link>
  );
}

function TeamNameTag({
  teamName,
  visibility,
  tone,
}: {
  teamName: string | null;
  visibility: "workspace" | "org" | "private";
  tone: CSSProperties;
}) {
  // No workspace = a private or everyone (org) project — label it by its
  // visibility rather than a bare "No team", which read as missing metadata.
  const label =
    teamName?.trim() ||
    (visibility === "private" ? "Private" : visibility === "org" ? "Everyone" : "No team");
  return (
    <span className="tag" style={{ ...teamTagStyle, ...tone }} title={label}>
      {label}
    </span>
  );
}

function CountCell({ value }: { value: number }) {
  return <span style={countStyle}>{value}</span>;
}

function StatusBreakdown({ counts }: { counts: BoardTaskCounts }) {
  const label = `Planned ${counts.todo}, Doing ${counts.doing}, Done ${counts.done}`;
  return (
    <span style={statusValueStyle} title={label} aria-label={label}>
      <span>{counts.todo}</span>
      <span style={statusSeparatorStyle} aria-hidden="true">/</span>
      <span>{counts.doing}</span>
      <span style={statusSeparatorStyle} aria-hidden="true">/</span>
      <span>{counts.done}</span>
    </span>
  );
}

function statusScore(counts: BoardTaskCounts) {
  if (counts.total === 0) return 0;
  return (counts.done / counts.total) * 100 + (counts.doing / counts.total) * 50;
}

const rowGridStyle: CSSProperties = {
  gridTemplateColumns: "minmax(180px, 1.7fr) minmax(130px, 1fr) 112px 86px minmax(180px, 0.9fr) 128px",
  minWidth: 940,
};

const projectRowStyle: CSSProperties = {
  ...rowGridStyle,
  padding: "8px 16px",
  lineHeight: 1.2,
};

const tableWrapStyle: CSSProperties = {
  minHeight: 0,
  minWidth: 940,
  overflow: "visible",
};

const tableScrollStyle: CSSProperties = {
  overflowX: "auto",
  overflowY: "visible",
};

const emptyWrapStyle: CSSProperties = {
  minHeight: 0,
};

const headerBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  justifySelf: "start",
  gap: 4,
  width: "fit-content",
  maxWidth: "100%",
  padding: 0,
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  letterSpacing: "inherit",
  textTransform: "inherit",
  cursor: "pointer",
  textAlign: "left",
  whiteSpace: "nowrap",
  lineHeight: 1.2,
};

const statusHeaderBtnStyle: CSSProperties = {
  ...headerBtnStyle,
  display: "block",
  position: "relative",
  width: "100%",
};

const statusColumnsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  columnGap: 0,
};

const hiddenStatusSeparatorStyle: CSSProperties = {
  visibility: "hidden",
};

const statusSeparatorStyle: CSSProperties = {
  color: "var(--ink-mute)",
};

const statusSortIconStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: 0,
  display: "inline-flex",
  transform: "translateY(-50%)",
};

const projectNameStyle: CSSProperties = {
  display: "block",
  color: "var(--ink)",
  fontWeight: 500,
  textDecoration: "none",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const teamTagStyle: CSSProperties = {
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const countStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 12,
  color: "var(--ink-soft)",
};

const statusValueStyle: CSSProperties = {
  ...statusColumnsStyle,
  fontFamily: "var(--mono)",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-soft)",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const actionsStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  justifyContent: "flex-end",
};

// The shared table action button (every other module's View/Edit/Delete), plus
// the two properties a Link needs that a <button> gets for free: no underline,
// and inline-flex so the label centres against the sibling icon buttons.
const viewBtnStyle: CSSProperties = {
  ...tableActBtnStyle,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
