import { useMemo, useState } from "react";
import {
  Button,
  ConfirmDialog,
  PageHeader,
  Pagination,
  StatusToggle,
  SubTabs,
  Table,
  TableAction,
  TableRowActions,
  type Column,
} from "../../components";
import type { DemoMaster, DemoRow } from "../../data/types";
import { toColumn } from "./columns";
import { DetailPanel } from "./DetailPanel";
import { downloadCsv } from "./exportCsv";
import { MasterForm } from "./MasterForm";
import { MasterToolbar, type View } from "./MasterToolbar";
import { SummaryStrip } from "./SummaryStrip";
import { useMasterRows } from "./useMasterRows";

const ALL_TAB = "All";

export interface AdminPageProps {
  master: DemoMaster;
  /** Search text from the shell's topbar, if the page should honour it. */
  externalSearch?: string;
}

/**
 * The master screen — one layout for every master in Admin.
 *
 * The application has fourteen of these pages, each re-implementing the same
 * table, dialog, toggle and archive flow against a different table. This is
 * that page written once, and the parts only some masters need are parameters
 * on the descriptor rather than forks in the code:
 *
 *   reorder     up/down arrows that swap a numeric order field
 *   singleFlag  a flag only one row may hold ("Make default")
 *   filters     extra equality filters in the toolbar
 *   tabs        grouping tabs above the toolbar
 *   summary     counters over the rows in view
 *   exportable  a CSV download of what the table is showing
 *   detail      a per-row panel of child records
 *
 * A master that declares none of them renders the plain screen. Nothing here
 * names a lane, a language or a role.
 */
export function AdminPage({ master, externalSearch }: AdminPageProps) {
  const label = useMemo(() => (row: DemoRow) => labelOf(row, master), [master]);
  const api = useMasterRows(master, label);

  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("active");
  const [tab, setTab] = useState(ALL_TAB);
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editing, setEditing] = useState<DemoRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [detailRow, setDetailRow] = useState<DemoRow | null>(null);
  const [pending, setPending] = useState<{ kind: "archive" | "restore"; row: DemoRow } | null>(null);

  // A different master is a different screen: reset the view state rather than
  // carrying a lanes search over to languages.
  const [loadedKey, setLoadedKey] = useState(master.key);
  if (loadedKey !== master.key) {
    setLoadedKey(master.key);
    setSearch("");
    setView("active");
    setTab(ALL_TAB);
    setExtraFilters({});
    setPage(1);
  }

  const query = (externalSearch?.trim() || search.trim()).toLowerCase();
  const orderField = master.reorder?.field;

  const filtered = useMemo(() => {
    const out = api.rows.filter((r) => {
      const archived = Boolean(r.is_archived);
      if (view === "archived" ? !archived : archived) return false;
      if (view === "active" && !r.is_active) return false;
      if (view === "inactive" && r.is_active) return false;

      const tabDef = master.tabs?.find((t) => t.label === tab);
      if (tabDef && r[tabDef.field] !== tabDef.value) return false;

      for (const [key, value] of Object.entries(extraFilters)) {
        if (value && String(r[key] ?? "") !== value) return false;
      }

      if (!query) return true;
      return master.columns.some((c) =>
        String(r[c.key] ?? "")
          .toLowerCase()
          .includes(query),
      );
    });

    // A reorderable master is ordered by its order field — otherwise the arrows
    // would move a row somewhere the reader cannot see.
    return orderField
      ? [...out].sort((a, b) => Number(a[orderField]) - Number(b[orderField]))
      : out;
  }, [api.rows, view, tab, extraFilters, query, master.columns, master.tabs, orderField]);

  // "Narrowed" means the view is empty because of a search, a tab or a filter —
  // not because the master has no rows. The two need different empty states.
  const narrowed =
    Boolean(query) ||
    tab !== ALL_TAB ||
    Object.values(extraFilters).some(Boolean) ||
    (view !== "all" && api.rows.length > 0);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  // Reordering swaps with the neighbour in the CURRENT list, so it is only
  // meaningful while the list is the whole, ordered set.
  const canReorder = Boolean(orderField) && !narrowed && view !== "archived";

  const columns: Column<DemoRow>[] = [
    ...(orderField
      ? [
          {
            key: "__order",
            header: "",
            width: "52px",
            render: (row: DemoRow) => {
              const i = filtered.findIndex((r) => r.id === row.id);
              return (
                <ReorderCell
                  disabled={!canReorder}
                  atStart={i <= 0}
                  atEnd={i < 0 || i >= filtered.length - 1}
                  onUp={() => api.swapOrder(row, filtered[i - 1])}
                  onDown={() => api.swapOrder(row, filtered[i + 1])}
                  title={
                    canReorder
                      ? undefined
                      : "Clear the search and filters to reorder"
                  }
                />
              );
            },
          } as Column<DemoRow>,
        ]
      : []),
    ...master.columns.map(toColumn),
    {
      key: "__actions",
      header: "Actions",
      width: master.detail || master.singleFlag ? "250px" : "170px",
      align: "right",
      render: (row) => (
        <TableRowActions nowrap>
          {row.is_archived ? (
            <TableAction tone="restore" onClick={() => setPending({ kind: "restore", row })}>
              Restore
            </TableAction>
          ) : (
            <>
              <StatusToggle
                active={row.is_active}
                busy={api.togglingId === row.id}
                label={row.is_active ? "Deactivate" : "Activate"}
                onToggle={(next) => api.setActive(row, next)}
              />
              {master.singleFlag && !row[master.singleFlag.field] && (
                <TableAction onClick={() => api.setDefault(row)}>
                  {master.singleFlag.action ?? "Make default"}
                </TableAction>
              )}
              {master.detail && (
                <TableAction onClick={() => setDetailRow(row)}>
                  {master.detail.action}
                  <Count n={childCount(row, master.detail.itemsKey)} />
                </TableAction>
              )}
              <TableAction onClick={() => setEditing(row)}>Edit</TableAction>
              <TableAction tone="danger" onClick={() => setPending({ kind: "archive", row })}>
                Archive
              </TableAction>
            </>
          )}
        </TableRowActions>
      ),
    },
  ];

  const liveRows = api.rows.filter((r) => !r.is_archived);

  return (
    <div>
      <PageHeader
        eyebrow={master.eyebrow}
        crumbs={[{ label: master.module }, { label: master.section }, { label: master.label }]}
        onNavigate={() => undefined}
        actions={
          <>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
              {liveRows.length} {master.label.toLowerCase()}
            </span>
            <Button variant="ghost" size="sm" onClick={api.reload}>
              Reload
            </Button>
          </>
        }
      />

      {master.tabs && master.tabs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SubTabs
            tabs={[ALL_TAB, ...master.tabs.map((t) => t.label)]}
            active={tab}
            onChange={(t) => {
              setTab(t);
              setPage(1);
            }}
            ariaLabel={`${master.label} groups`}
            counts={Object.fromEntries(
              master.tabs.map((t) => [
                t.label,
                liveRows.filter((r) => r[t.field] === t.value).length,
              ]),
            )}
          />
        </div>
      )}

      <SummaryStrip master={master} rows={filtered} />

      <MasterToolbar
        master={master}
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        view={view}
        onView={(v) => {
          setView(v);
          setPage(1);
        }}
        filters={extraFilters}
        onFilter={(key, value) => {
          setExtraFilters((f) => ({ ...f, [key]: value }));
          setPage(1);
        }}
        onAdd={() => setCreating(true)}
        onExport={() => downloadCsv(`${master.key}.csv`, master.columns, filtered)}
      />

      <Table
        columns={columns}
        data={paginated}
        rowKey={(r) => r.id}
        loading={api.loading}
        minWidth={(master.minWidth ?? 820) + (orderField ? 60 : 0)}
        emptyVariant={narrowed ? "no-results" : "empty"}
        emptyMessage={
          query
            ? `No ${master.label.toLowerCase()} match “${query}”`
            : view === "archived"
              ? `No archived ${master.label.toLowerCase()}`
              : narrowed
                ? `No ${master.label.toLowerCase()} in this view`
                : (master.emptyMessage ?? `No ${master.label.toLowerCase()} yet`)
        }
        emptyHint={
          query
            ? "Check the spelling, or clear the search to see everything."
            : view === "archived"
              ? "Rows archived from this screen can be restored here."
              : narrowed
                ? `There are ${liveRows.length} in total — widen the filters to see them.`
                : master.emptyHint
        }
        emptyAction={
          narrowed ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch("");
                setView("all");
                setTab(ALL_TAB);
                setExtraFilters({});
                setPage(1);
              }}
            >
              Clear search and filters
            </Button>
          ) : (
            <Button size="sm" onClick={() => setCreating(true)}>
              Add the first {master.singular.toLowerCase()}
            </Button>
          )
        }
      />

      <Pagination
        page={safePage}
        total={total}
        perPage={perPage}
        onChange={setPage}
        onPerPageChange={(n) => {
          setPerPage(n);
          setPage(1);
        }}
        label={master.label.toLowerCase()}
      />

      {/* Keyed so each open starts from the row it was opened for. */}
      {(creating || editing) && (
        <MasterForm
          key={editing?.id ?? "new"}
          open
          master={master}
          row={editing}
          onSave={(values) => {
            if (editing) api.update(editing.id, values);
            else {
              api.create(values);
              setPage(1);
            }
            setCreating(false);
            setEditing(null);
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {master.detail && detailRow && (
        <DetailPanel
          panel={master.detail}
          row={api.rows.find((r) => r.id === detailRow.id) ?? detailRow}
          rowLabel={label(detailRow)}
          onClose={() => setDetailRow(null)}
          onChange={(items) => api.setChildren(detailRow.id, master.detail!.itemsKey, items)}
        />
      )}

      <ConfirmDialog
        open={pending != null}
        title={
          pending?.kind === "restore"
            ? `Restore ${master.singular.toLowerCase()}?`
            : `Archive ${master.singular.toLowerCase()}?`
        }
        description={
          pending
            ? pending.kind === "restore"
              ? `Restore “${label(pending.row)}” to the working list.`
              : `Archive “${label(pending.row)}”. It leaves the list — you can restore it from the Archived view.`
            : ""
        }
        confirmLabel={pending?.kind === "restore" ? "Restore" : "Archive"}
        confirmTone={pending?.kind === "restore" ? "primary" : "danger"}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) api.setArchived(pending.row, pending.kind === "archive");
          setPending(null);
        }}
      />
    </div>
  );
}

/** Up/down arrows, in the leading column of a reorderable master. */
function ReorderCell({
  disabled,
  atStart,
  atEnd,
  onUp,
  onDown,
  title,
}: {
  disabled: boolean;
  atStart: boolean;
  atEnd: boolean;
  onUp: () => void;
  onDown: () => void;
  title?: string;
}) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 1 }} title={title}>
      <button
        type="button"
        className="arrow-btn"
        onClick={onUp}
        disabled={disabled || atStart}
        aria-label="Move up"
      >
        <Chevron up />
      </button>
      <button
        type="button"
        className="arrow-btn"
        onClick={onDown}
        disabled={disabled || atEnd}
        aria-label="Move down"
      >
        <Chevron />
      </button>
    </span>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={up ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", marginLeft: 4 }}>
      {n}
    </span>
  );
}

function childCount(row: DemoRow, key: string): number {
  return Array.isArray(row[key]) ? (row[key] as unknown[]).length : 0;
}

/** Best human label for a row — the first text-ish column, else the id. */
function labelOf(row: DemoRow, master: DemoMaster): string {
  const col =
    master.columns.find((c) => !c.type || c.type === "text" || c.type === "user") ??
    master.columns[0];
  return String(row[col.key] ?? row.id);
}
