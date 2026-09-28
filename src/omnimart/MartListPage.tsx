import { useEffect, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  MultiFilter,
  PageHeader,
  Pagination,
  SubTabs,
  Table,
  TableAction,
  TableRowActions,
  emitToast,
  toColumn,
  usePagination,
  type Column,
} from "../components";
import { downloadCsv } from "../admin/AdminPage/exportCsv";
import type { MartList, MartRow } from "./types";
import { StoreOverview } from "./StoreOverview";

export interface MartListPageProps {
  list: MartList;
  /** Search text from the shell's topbar. */
  externalSearch?: string;
}

/**
 * One work list — Pipeline, Operations, Schedule & Sites, Store.
 *
 * The same relationship the admin masters have to `AdminPage`: four screens,
 * one component, a descriptor each. These are not CRUD masters though — they
 * are work in flight, so instead of add/edit/archive they carry the views the
 * application puts in the header (All Leads · Short Cycle · Long Cycle ·
 * Archived), the search-with-FILTERS beneath it, and the row actions the app
 * offers: View · Next stage · Archive.
 *
 * Cells come from the same `toColumn` the admin tables use, which is why a
 * lead table and a language table feel like one table.
 *
 * A view can also be something other than a table — Store opens on a grid of
 * KPI tiles — so a descriptor may name a `kind` per view.
 */
export function MartListPage({ list, externalSearch }: MartListPageProps) {
  const views = list.tabs ?? [];
  const [tab, setTab] = useState(views[0]?.label ?? "All");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [perPage, setPerPage] = useState(10);
  // Loaded on the server; in the browser the screen opens through its skeleton.
  const [loading, setLoading] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    setTab(views[0]?.label ?? "All");
    setSearch("");
    setFilters({});
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
    // Keyed on the list: `views` is derived from it, so it is the only input.
  }, [list]);

  const view = views.find((v) => v.label === tab);
  const query = (externalSearch?.trim() || search.trim()).toLowerCase();

  const filtered = useMemo(() => {
    return list.rows.filter((r) => {
      if (view?.field && r[view.field] !== view.value) return false;
      for (const [key, values] of Object.entries(filters)) {
        if (values.length > 0 && !values.includes(String(r[key] ?? ""))) return false;
      }
      if (!query) return true;
      return list.columns.some((c) =>
        String(r[c.key] ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [list, view, filters, query]);

  const { page, setPage, paginated, total } = usePagination(filtered, perPage);
  const narrowed =
    Boolean(query) || Boolean(view?.field) || Object.values(filters).some((v) => v.length > 0);

  const columns: Column<MartRow>[] = [
    ...list.columns.map((c) => toColumn(c) as Column<MartRow>),
    ...(list.rowActions?.length
      ? [
          {
            key: "__actions",
            header: "Actions",
            width: `${68 + list.rowActions.length * 62}px`,
            align: "right" as const,
            render: () => (
              <TableRowActions nowrap>
                {list.rowActions!.map((a) => (
                  <TableAction
                    key={a}
                    tone={a === "Archive" ? "danger" : "default"}
                    onClick={() => emitToast(`${a} — demo`, "info")}
                  >
                    {a}
                  </TableAction>
                ))}
              </TableRowActions>
            ),
          },
        ]
      : []),
  ];

  const isTable = !view?.kind || view.kind === "table";

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "OmniMart" }, { label: list.label }]}
        marginBottom={12}
        actions={
          views.length > 0 ? (
            <SubTabs
              tabs={views.map((v) => v.label)}
              active={tab}
              onChange={(t) => {
                setTab(t);
                setPage(1);
              }}
              ariaLabel={`${list.label} views`}
            />
          ) : undefined
        }
      />

      {view?.kind === "overview" && list.overview ? (
        <StoreOverview overview={list.overview} loading={loading} />
      ) : view?.kind === "placeholder" ? (
        <EmptyState
          size="card"
          title={`${tab} is not in this demo`}
          description="The screen exists in the application; this workspace carries the views that show the design."
        />
      ) : (
        <>
          <div className="opx-toolbar">
            <MultiFilter
              searchInput={search}
              onSearchChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              searchPlaceholder={list.searchPlaceholder}
              sections={(list.filters ?? []).map((f) => ({
                kind: "checklist" as const,
                key: f.key,
                label: f.label,
                selected: filters[f.key] ?? [],
                onChange: (next: string[]) => {
                  setFilters((v) => ({ ...v, [f.key]: next }));
                  setPage(1);
                },
                options: f.options.map((o) => ({ value: o, label: o })),
              }))}
            />
            <div className="opx-toolbar__actions">
              {list.exportable && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadCsv(`${list.key}.csv`, list.columns, filtered)}
                >
                  Export CSV
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => emitToast(`New ${list.singular.toLowerCase()} — demo`, "info")}
              >
                {list.addLabel ?? `+ Add ${list.singular.toLowerCase()}`}
              </Button>
            </div>
          </div>

          {isTable && (
            <>
              <Table
                columns={columns}
                data={paginated}
                rowKey={(r) => r.id}
                loading={loading}
                minWidth={list.minWidth ?? 1100}
                emptyVariant={narrowed ? "no-results" : "empty"}
                emptyMessage={
                  query ? `Nothing matches “${query}”` : (list.emptyMessage ?? `No ${list.countLabel}`)
                }
                emptyHint={query ? "Check the spelling, or clear the search." : list.emptyHint}
                emptyAction={
                  narrowed ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setTab(views[0]?.label ?? "All");
                        setFilters({});
                        setPage(1);
                      }}
                    >
                      Clear search and filters
                    </Button>
                  ) : undefined
                }
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
                label={list.countLabel}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
