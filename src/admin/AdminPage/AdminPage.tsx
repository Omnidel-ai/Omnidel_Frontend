import { useMemo, useState } from "react";
import {
  Badge,
  ConfirmDialog,
  CustomSelect,
  PageHeader,
  Pagination,
  StatusToggle,
  Table,
  TableAction,
  TableAddButton,
  TableControls,
  TableRowActions,
  emitToast,
  type BadgeTone,
  type Column,
} from "../../components";
import type { DemoColumn, DemoMaster, DemoRow } from "../../data/types";
import { MasterForm } from "./MasterForm";

type View = "active" | "inactive" | "all" | "archived";

const VIEW_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
  { value: "archived", label: "Archived" },
];

export interface AdminPageProps {
  master: DemoMaster;
  /** Search text from the shell's topbar, if the page should honour it. */
  externalSearch?: string;
}

/**
 * One admin master screen, rendered entirely from a descriptor.
 *
 * The application has nine of these pages — 3,564 lines — each re-implementing
 * the same table, dialog, toggle and archive flow against a different table.
 * This is that page written once: columns, form fields and rows all come from
 * `master`, so nothing here names a lane, a language or a mission.
 *
 * Rows are held in component state. Create, edit, activate and archive change
 * that state and nothing else — there is no API in this workspace, and the
 * whole screen resets on reload.
 */
export function AdminPage({ master, externalSearch }: AdminPageProps) {
  const [rows, setRows] = useState<DemoRow[]>(master.rows);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("active");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editing, setEditing] = useState<DemoRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<{ kind: "archive" | "restore"; row: DemoRow } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // A different master means a different screen: reset the view state rather
  // than carrying a lanes search over to languages.
  const [loadedKey, setLoadedKey] = useState(master.key);
  if (loadedKey !== master.key) {
    setLoadedKey(master.key);
    setRows(master.rows);
    setSearch("");
    setView("active");
    setPage(1);
  }

  const query = (externalSearch?.trim() || search.trim()).toLowerCase();

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const archived = Boolean(r.is_archived);
      if (view === "archived" ? !archived : archived) return false;
      if (view === "active" && !r.is_active) return false;
      if (view === "inactive" && r.is_active) return false;
      if (!query) return true;
      return master.columns.some((c) =>
        String(r[c.key] ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [rows, view, query, master.columns]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const columns: Column<DemoRow>[] = [
    ...master.columns.map((c) => toColumn(c)),
    {
      key: "__actions",
      header: "Actions",
      width: "170px",
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
                busy={togglingId === row.id}
                label={row.is_active ? "Deactivate" : "Activate"}
                onToggle={(next) => toggleActive(row, next)}
              />
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

  function toggleActive(row: DemoRow, next: boolean) {
    setTogglingId(row.id);
    // A short delay so the busy state is real rather than theoretical — this is
    // where the write would go.
    window.setTimeout(() => {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));
      setTogglingId(null);
      emitToast(`${labelOf(row, master)} ${next ? "activated" : "deactivated"}`, "success");
    }, 320);
  }

  function saveRow(values: Record<string, unknown>) {
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? ({ ...r, ...values } as DemoRow) : r)));
      emitToast(`${master.singular} updated`, "success");
      setEditing(null);
      return;
    }
    const created = {
      ...values,
      id: `new-${Date.now()}`,
      is_active: values.is_active !== false,
      is_archived: false,
    } as DemoRow;
    setRows((rs) => [created, ...rs]);
    emitToast(`${master.singular} created`, "success");
    setCreating(false);
    setPage(1);
  }

  function confirmPending() {
    if (!pending) return;
    const archiving = pending.kind === "archive";
    setRows((rs) =>
      rs.map((r) =>
        r.id === pending.row.id
          ? { ...r, is_archived: archiving, is_active: archiving ? false : r.is_active }
          : r,
      ),
    );
    emitToast(
      `${labelOf(pending.row, master)} ${archiving ? "archived" : "restored"}`,
      archiving ? "info" : "success",
    );
    setPending(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow={master.eyebrow}
        crumbs={[{ label: master.module }, { label: master.section }, { label: master.label }]}
        onNavigate={() => undefined}
        actions={
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
            {rows.filter((r) => !r.is_archived).length} {master.label.toLowerCase()}
          </span>
        }
      />

      <div className="table-toolbar">
        <TableControls
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={master.searchPlaceholder ?? `Search ${master.label.toLowerCase()}…`}
          inlineOnMobile
        >
          <div className="picker-field">
            <CustomSelect
              value={view}
              onChange={(v) => {
                setView(v as View);
                setPage(1);
              }}
              options={VIEW_OPTIONS}
              aria-label="View"
              compact
            />
          </div>
        </TableControls>
        <TableAddButton label={`+ Add ${master.singular.toLowerCase()}`} onClick={() => setCreating(true)} />
      </div>

      <Table
        columns={columns}
        data={paginated}
        rowKey={(r) => r.id}
        minWidth={master.minWidth ?? 820}
        emptyMessage={
          query
            ? `No ${master.label.toLowerCase()} match “${query}”`
            : (master.emptyMessage ?? `No ${master.label.toLowerCase()} in this view`)
        }
        emptyHint={
          view === "archived"
            ? "Archived rows are restored from here."
            : `Add one with “+ Add ${master.singular.toLowerCase()}”.`
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
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={saveRow}
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
              ? `Restore “${labelOf(pending.row, master)}” to the working list.`
              : `Archive “${labelOf(pending.row, master)}”. It leaves the list — you can restore it from the Archived view.`
            : ""
        }
        confirmLabel={pending?.kind === "restore" ? "Restore" : "Archive"}
        confirmTone={pending?.kind === "restore" ? "primary" : "danger"}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
      />
    </div>
  );
}

/** Descriptor column → shared Table column, one renderer per declared type. */
function toColumn(c: DemoColumn): Column<DemoRow> {
  const base = { key: c.key, header: c.header, width: c.width, align: c.align };

  switch (c.type) {
    case "code":
      return {
        ...base,
        render: (r) => (
          <code style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>
            {String(r[c.key] ?? "—")}
          </code>
        ),
      };
    case "badge":
      return {
        ...base,
        render: (r) => {
          const v = String(r[c.key] ?? "");
          if (!v) return <Muted />;
          return <Badge tone={(c.tones?.[v] as BadgeTone) ?? "neutral"}>{v}</Badge>;
        },
      };
    case "flag":
      return {
        ...base,
        render: (r) => (r[c.key] ? <Badge tone="green">Yes</Badge> : <Muted />),
      };
    case "number":
      return {
        ...base,
        align: c.align ?? "right",
        render: (r) => (
          <span style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
            {r[c.key] == null || r[c.key] === "" ? "—" : String(r[c.key])}
          </span>
        ),
      };
    case "date":
      return {
        ...base,
        render: (r) => (
          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-soft)" }}>
            {String(r[c.key] ?? "—")}
          </span>
        ),
      };
    case "status":
      return {
        ...base,
        render: (r) =>
          r.is_archived ? (
            <Badge tone="neutral">Archived</Badge>
          ) : r.is_active ? (
            <Badge tone="ok">Active</Badge>
          ) : (
            <Badge tone="amber">Inactive</Badge>
          ),
      };
    default:
      return { ...base, render: (r) => <span>{String(r[c.key] ?? "—")}</span> };
  }
}

function Muted() {
  return <span style={{ color: "var(--ink-faint)" }}>—</span>;
}

/** Best human label for a row — the first text column, else the id. */
function labelOf(row: DemoRow, master: DemoMaster): string {
  const col = master.columns.find((c) => !c.type || c.type === "text") ?? master.columns[0];
  return String(row[col.key] ?? row.id);
}
