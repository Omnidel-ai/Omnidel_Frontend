import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Menu,
  MultiFilter,
  Pagination,
  PinButton,
  SkeletonCard,
  Table,
  emitToast,
  usePagination,
  type Column,
} from "../components";
import type { OmniPulseProject, OmniPulseProjectsData, OmniPulseTeam } from "./types";
import { CardGrid, ViewToggle } from "./cards";
import { ProjectCard } from "./ProjectCard";
import { ProjectForm } from "./ProjectForm";

export interface ProjectsPageProps {
  data: OmniPulseProjectsData;
  teams: OmniPulseTeam[];
  /** Pre-filter to one team, set when arriving from the Teams grid. */
  teamId?: string;
  onTeamChange: (teamId: string) => void;
  /** Open a project's board. */
  onOpen: (project: OmniPulseProject) => void;
  /** Everyone who can lead a project, for the form's picker. */
  people?: string[];
}

/**
 * Projects — the same records as cards or as a table.
 *
 * The table is the application's: the team as a chip, the task total and my
 * share, then planned / doing / done as three numbers rather than a bar, and
 * View · pin · ⋯ in the actions column. Every column the descriptor marks
 * sortable sorts, and the footer counts and pages exactly as the admin tables
 * do — it is the same `Pagination`.
 */
export function ProjectsPage({
  data,
  teams,
  teamId = "",
  onTeamChange,
  onOpen,
  people = [],
}: ProjectsPageProps) {
  // The rows live here now rather than only in the props: creating, editing
  // and archiving change them, and nothing behind this screen will do that.
  const [rows, setRows] = useState<OmniPulseProject[]>(data.rows);
  /** null = closed; "new" = creating; a project = editing that one. */
  const [editing, setEditing] = useState<OmniPulseProject | "new" | null>(null);
  const [view, setView] = useState("Table");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [pinned, setPinned] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.rows.filter((r) => r.pinned).map((r) => [r.id, true])),
  );
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [perPage, setPerPage] = useState(10);
  // Loaded on the server; in the browser the screen opens through its skeleton.
  const [loading, setLoading] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
  }, []);

  const q = search.trim().toLowerCase();
  const teamName = teams.find((t) => t.id === teamId)?.name;

  const filtered = useMemo(() => {
    const found = rows.filter((p) => {
      if (Boolean(p.archived) !== showArchived) return false;
      if (teamId && p.teamId !== teamId) return false;
      if (teamFilter.length > 0 && !teamFilter.includes(p.team)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.lead.toLowerCase().includes(q)
      );
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...found].sort((a, b) => {
      const x = a[sort.key as keyof OmniPulseProject];
      const y = b[sort.key as keyof OmniPulseProject];
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x ?? "").localeCompare(String(y ?? "")) * dir;
    });
  }, [rows, showArchived, teamId, teamFilter, q, sort]);

  const { page, setPage, paginated, total } = usePagination(filtered, perPage);
  const narrowed = Boolean(q) || showArchived || Boolean(teamId) || teamFilter.length > 0;

  function toggleSort(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  /**
   * A new project goes to the top; an edited one stays where it is.
   *
   * Sorting is the reader's choice on this screen, so a save that reordered
   * the table would move the row they were looking at out from under them.
   */
  function save(next: OmniPulseProject) {
    setRows((current) =>
      current.some((p) => p.id === next.id)
        ? current.map((p) => (p.id === next.id ? next : p))
        : [next, ...current],
    );
  }

  function archive(project: OmniPulseProject) {
    setRows((current) =>
      current.map((p) => (p.id === project.id ? { ...p, archived: !p.archived } : p)),
    );
    emitToast(
      project.archived ? `${project.name} restored` : `${project.name} archived`,
      project.archived ? "success" : "info",
    );
  }

  const columns: Column<OmniPulseProject>[] = [
    ...data.columns.map((c) => ({
      key: c.key,
      width: c.width,
      align: c.align,
      header: c.sortable ? (
        <button type="button" onClick={() => toggleSort(c.key)} className="opx-sort">
          {c.header}
          <span style={{ opacity: sort.key === c.key ? 1 : 0.3 }}>
            {sort.key === c.key && sort.dir === "desc" ? "▾" : "▴"}
          </span>
        </button>
      ) : (
        c.header
      ),
      render: (p: OmniPulseProject) => {
        if (c.key === "team") return <Badge tone="green">{p.team}</Badge>;
        if (c.key === "counts") {
          return (
            <span className="opx-counts">
              <b>{p.planned}</b>
              <i>/</i>
              <b>{p.doing}</b>
              <i>/</i>
              <b>{p.done}</b>
            </span>
          );
        }
        if (c.key === "total" || c.key === "mine") {
          return (
            <span style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
              {p[c.key]}
            </span>
          );
        }
        return <span className="picker-truncate">{String(p[c.key as keyof OmniPulseProject] ?? "—")}</span>;
      },
    })),
    {
      key: "__actions",
      header: "Actions",
      width: "150px",
      align: "right",
      render: (p) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(p);
            }}
          >
            View
          </Button>
          <PinButton
            pinned={Boolean(pinned[p.id])}
            onToggle={(next) => setPinned((v) => ({ ...v, [p.id]: next }))}
            label={p.name}
            size="sm"
          />
          <Menu
            size="sm"
            label={`${p.name} actions`}
            items={[
              { label: "Open board", onClick: () => onOpen(p) },
              { label: "Project settings", onClick: () => setEditing(p) },
              {
                label: p.archived ? "Restore project" : "Archive project",
                onClick: () => archive(p),
                tone: p.archived ? undefined : "danger",
                separated: true,
              },
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 className="opx-title">
          <span>OmniPulse</span>
          <span className="opx-title__sep">/</span>
          {teamName ? (
            <>
              <button type="button" className="opx-title__link" onClick={() => onTeamChange("")}>
                Teams
              </button>
              <span className="opx-title__sep">/</span>
              <span className="opx-title__current">{teamName} Projects</span>
            </>
          ) : (
            <span className="opx-title__current">{data.label}</span>
          )}
        </h1>
        <p className="opx-subtitle">
          {teamName
            ? `${filtered.length} projects · ${teams.find((t) => t.id === teamId)?.members ?? 0} members`
            : data.subtitle}
        </p>
      </header>

      <div className="opx-toolbar">
        <MultiFilter
          searchInput={search}
          onSearchChange={setSearch}
          searchPlaceholder={data.searchPlaceholder}
          sections={[
            {
              kind: "checklist",
              key: "team",
              label: "Team",
              selected: teamFilter,
              onChange: setTeamFilter,
              options: teams.map((t) => ({ value: t.name, label: t.name })),
            },
            {
              kind: "toggle",
              key: "archived",
              label: "Archived",
              checked: showArchived,
              onChange: setShowArchived,
            },
          ]}
        />
        <div className="opx-toolbar__actions">
          <ViewToggle value={view} onChange={setView} options={["Card", "Table"]} />
          <Button size="sm" onClick={() => setEditing("new")}>
            + New Project
          </Button>
        </div>
      </div>

      {loading ? (
        view === "Card" ? (
          <CardGrid>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} lines={3} />
            ))}
          </CardGrid>
        ) : (
          <Table columns={columns} data={[]} loading minWidth={1040} />
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          size="card"
          variant={narrowed ? "no-results" : "empty"}
          title={narrowed ? "No projects match this view" : data.emptyMessage}
          description={narrowed ? "Clear the search and the filters." : data.emptyHint}
          action={
            narrowed ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setShowArchived(false);
                  setTeamFilter([]);
                  onTeamChange("");
                }}
              >
                Clear search and filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => setEditing("new")}>
                Add the first project
              </Button>
            )
          }
        />
      ) : view === "Card" ? (
        <CardGrid>
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              pinned={Boolean(pinned[p.id])}
              onPinChange={(next) => setPinned((v) => ({ ...v, [p.id]: next }))}
              onOpen={() => onOpen(p)}
            />
          ))}
        </CardGrid>
      ) : (
        <>
          <Table
            columns={columns}
            data={paginated}
            rowKey={(p) => p.id}
            minWidth={1100}
            onRowClick={onOpen}
          />
          <Pagination
            page={page}
            total={total}
            perPage={perPage}
            onChange={setPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            label="projects"
          />
        </>
      )}

      <ProjectForm
        open={editing != null}
        project={editing === "new" ? null : editing}
        teams={teams}
        people={people}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </div>
  );
}
