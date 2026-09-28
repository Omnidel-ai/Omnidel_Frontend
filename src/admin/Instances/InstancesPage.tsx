import { useEffect, useMemo, useState } from "react";
import { Button, MultiFilter, PageHeader, StatTile, SubTabs, Table, type Column } from "../../components";
import { InstanceMark, ModuleChips, SeatMeter, StatusBadge } from "./bits";
import { formatDate, statusNote, type Instance, type InstancesData } from "./types";

export interface InstancesPageProps {
  data: InstancesData;
  /** Open one instance's page. */
  onOpen: (instance: Instance) => void;
}

const VIEWS = ["All", "Active", "Trial", "Closing"] as const;

/**
 * Instances — every customer workspace on the platform.
 *
 * The console's landing. A work list in the application's shape: views in the
 * page header, search-with-FILTERS beneath, and a row that opens the record.
 * Each status carries the line that says what happens next — "Grace ends in
 * 10 days" — because a status alone does not tell support whether to act.
 */
export function InstancesPage({ data, onOpen }: InstancesPageProps) {
  const [view, setView] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(id);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: data.rows.length };
    for (const r of data.rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [data.rows]);

  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      data.rows.filter((r) => {
        if (view !== "All" && r.status !== view) return false;
        if (modules.length > 0 && !modules.some((m) => r.modules.includes(m))) return false;
        if (!q) return true;
        return [r.name, r.prefix, r.owner?.name, r.owner?.email].some((s) => s?.toLowerCase().includes(q));
      }),
    [data.rows, view, modules, q],
  );
  const narrowed = Boolean(q) || view !== "All" || modules.length > 0;

  const seatsInUse = data.rows.reduce((n, r) => n + r.seats.used, 0);

  const columns: Column<Instance>[] = [
    {
      key: "name",
      header: "Instance",
      width: "minmax(200px, 1.6fr)",
      render: (r) => (
        <span className="inst-name">
          <InstanceMark name={r.name} />
          <span style={{ minWidth: 0 }}>
            <span className="inst-name__label">{r.name}</span>
            <span className="inst-name__prefix">{r.prefix}</span>
          </span>
        </span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      width: "minmax(170px, 1.2fr)",
      render: (r) =>
        r.owner ? (
          <span className="inst-two">
            <span>{r.owner.name}</span>
            <span className="inst-two__sub">{r.owner.email}</span>
          </span>
        ) : (
          <span className="inst-none">Not claimed yet</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "170px",
      render: (r) => {
        const note = statusNote(r, data.today);
        return (
          <span className="inst-two">
            <span>
              <StatusBadge status={r.status} />
            </span>
            {note && <span className={r.status === "Closing" ? "inst-two__sub inst-two__sub--crit" : "inst-two__sub"}>{note}</span>}
          </span>
        );
      },
    },
    { key: "seats", header: "Seats", width: "110px", render: (r) => <SeatMeter {...r.seats} /> },
    { key: "modules", header: "Modules", width: "minmax(170px, 1.2fr)", render: (r) => <ModuleChips modules={r.modules} max={2} /> },
    {
      key: "created",
      header: "Created",
      width: "110px",
      render: (r) => <span className="inst-date">{formatDate(r.created)}</span>,
    },
    {
      key: "__open",
      header: "",
      width: "28px",
      align: "right",
      render: () => (
        <svg className="inst-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="OmniDel platform"
        crumbs={[{ label: "Admin" }, { label: "Platform" }, { label: "Instances" }]}
        marginBottom={12}
        actions={
          <SubTabs
            tabs={[...VIEWS]}
            active={view}
            onChange={setView}
            counts={counts}
            ariaLabel="Instance views"
          />
        }
      />

      <div className="inst-tiles">
        <StatTile label="instances" value={String(data.rows.length)} hint="Across every customer" />
        <StatTile label="seats in use" value={String(seatsInUse)} hint="Trials are uncapped" />
        <StatTile label="on trial" value={String(counts.Trial ?? 0)} hint="Ends 14 days after sign-up" />
        <StatTile label="closing" value={String(counts.Closing ?? 0)} hint="In grace or export window" tone={counts.Closing ? "crit" : undefined} />
      </div>

      <div className="opx-toolbar">
        <MultiFilter
          searchInput={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, prefix or owner…"
          sections={[
            {
              kind: "checklist",
              key: "modules",
              label: "Has module",
              selected: modules,
              onChange: setModules,
              options: data.modules.map((m) => ({ value: m, label: m })),
            },
          ]}
        />
        <div className="opx-toolbar__actions">
          <span className="inst-count">
            {rows.length} of {data.rows.length} instances
          </span>
        </div>
      </div>

      <Table
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={6}
        minWidth={980}
        minHeight={0}
        onRowClick={onOpen}
        emptyVariant={narrowed ? "no-results" : "empty"}
        emptyMessage={q ? `Nothing matches “${search.trim()}”` : "No instances in this view"}
        emptyHint={q ? "Search looks at the name, the prefix and the owner." : undefined}
        emptyAction={
          narrowed ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch("");
                setView("All");
                setModules([]);
              }}
            >
              Clear search and filters
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
