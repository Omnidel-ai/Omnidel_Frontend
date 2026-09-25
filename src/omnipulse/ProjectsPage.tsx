import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  CustomSelect,
  EmptyState,
  PageHeader,
  SearchBar,
  SkeletonCard,
  Table,
  TableAction,
  TableRowActions,
  emitToast,
  type BadgeTone,
  type Column,
} from "../components";
import type { OmniPulseProject, OmniPulseProjectsData, OmniPulseTeam } from "./types";
import {
  BoardGlyph,
  Card,
  CardDesc,
  CardGrid,
  CardIcon,
  CardTitle,
  QuickToggle,
  TaskProgress,
  ViewToggle,
} from "./cards";

const VISIBILITY_TONE: Record<string, BadgeTone> = {
  Team: "neutral",
  Private: "terra",
  Everyone: "green",
};

export interface ProjectsPageProps {
  data: OmniPulseProjectsData;
  teams: OmniPulseTeam[];
  /** Pre-filter to one team, set when arriving from the Teams grid. */
  teamId?: string;
  onTeamChange: (teamId: string) => void;
  /** Open a project's board. */
  onOpen: (project: OmniPulseProject) => void;
}

/**
 * Projects — the same records as cards or as a table.
 *
 * The application offers both and remembers which you picked; the table sorts
 * on every column it says is sortable. Both views read the same descriptor, so
 * a column added to `columns` shows up in the table and nowhere else has to
 * change.
 */
export function ProjectsPage({ data, teams, teamId = "", onTeamChange, onOpen }: ProjectsPageProps) {
  const [view, setView] = useState("Grid");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  // Loaded on the server (the rows are already in hand); in the browser the
  // screen opens through its skeleton, which is where the read will go.
  const [loading, setLoading] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
  }, []);

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const rows = data.rows.filter((p) => {
      if (Boolean(p.archived) !== showArchived) return false;
      if (teamId && p.teamId !== teamId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.lead.toLowerCase().includes(q)
      );
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a[sort.key as keyof OmniPulseProject];
      const y = b[sort.key as keyof OmniPulseProject];
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x ?? "").localeCompare(String(y ?? "")) * dir;
    });
  }, [data.rows, showArchived, teamId, q, sort]);

  const narrowed = Boolean(q) || showArchived || Boolean(teamId);
  const teamName = teams.find((t) => t.id === teamId)?.name;

  function toggleSort(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const columns: Column<OmniPulseProject>[] = [
    ...data.columns.map((c) => ({
      key: c.key,
      width: c.width,
      align: c.align,
      header: c.sortable ? (
        <button
          type="button"
          onClick={() => toggleSort(c.key)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            font: "inherit",
            color: sort.key === c.key ? "var(--ink)" : "inherit",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {c.header}
          <span style={{ opacity: sort.key === c.key ? 1 : 0.25 }}>
            {sort.key === c.key && sort.dir === "desc" ? "▾" : "▴"}
          </span>
        </button>
      ) : (
        c.header
      ),
      render: (p: OmniPulseProject) => {
        if (c.key === "progress") return <TaskProgress done={p.done} doing={p.doing} todo={p.todo} compact />;
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
      width: "128px",
      align: "right",
      render: (p) => (
        <TableRowActions nowrap>
          <TableAction onClick={() => onOpen(p)}>Open board</TableAction>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="OmniPulse"
        crumbs={[
          { label: "OmniPulse" },
          ...(teamName ? [{ label: "Teams", href: "/omnipulse/boards" }] : []),
          { label: teamName ? `${teamName} · ${data.label}` : data.label },
        ]}
        onNavigate={() => onTeamChange("")}
        actions={
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
            {filtered.length} of {data.rows.length}
          </span>
        }
      />

      <div className="opx-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder={data.searchPlaceholder} width={280} />
        <div className="opx-toolbar__actions">
          <div className="picker-field" style={{ width: 170 }}>
            <CustomSelect
              value={teamId}
              onChange={onTeamChange}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Any team"
              aria-label="Team"
              allowDeselect
              compact
            />
          </div>
          <QuickToggle
            label="Archived"
            active={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          />
          <ViewToggle value={view} onChange={setView} />
          <Button size="sm" onClick={() => emitToast("Demo — projects are read-only here", "info")}>
            + New project
          </Button>
        </div>
      </div>

      {loading ? (
        view === "Grid" ? (
          <CardGrid>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} lines={3} />
            ))}
          </CardGrid>
        ) : (
          <Table columns={columns} data={[]} loading minWidth={900} />
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          size="card"
          variant={narrowed ? "no-results" : "empty"}
          title={narrowed ? "No projects match this view" : data.emptyMessage}
          description={narrowed ? "Clear the search, the team and the toggles." : data.emptyHint}
          action={
            narrowed ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setShowArchived(false);
                  onTeamChange("");
                }}
              >
                Clear search and filters
              </Button>
            ) : (
              <Button size="sm">Add the first project</Button>
            )
          }
        />
      ) : view === "Grid" ? (
        <CardGrid>
          {filtered.map((p) => (
            <Card key={p.id} onClick={() => onOpen(p)} muted={p.archived} title={`Open ${p.name}`}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 40 }}>
                <CardIcon tone="ochre">
                  <BoardGlyph />
                </CardIcon>
                <CardTitle pad={false}>{p.name}</CardTitle>
              </span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <Badge tone={p.archived ? "amber" : "ok"}>{p.archived ? "Archived" : "Active"}</Badge>
                <Badge tone={VISIBILITY_TONE[p.visibility] ?? "neutral"}>{p.visibility}</Badge>
                <Badge tone="neutral">{p.lead}</Badge>
              </span>
              {p.description && <CardDesc>{p.description}</CardDesc>}
              <TaskProgress done={p.done} doing={p.doing} todo={p.todo} />
            </Card>
          ))}
        </CardGrid>
      ) : (
        <Table
          columns={columns}
          data={filtered}
          rowKey={(p) => p.id}
          minWidth={980}
          onRowClick={onOpen}
        />
      )}
    </div>
  );
}
