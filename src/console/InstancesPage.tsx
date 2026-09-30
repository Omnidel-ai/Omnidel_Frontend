import { useMemo, useState } from "react";
import { Button, MultiFilter, Table, type Column } from "../components";
import { ConsoleHeader, StatusBadge } from "./bits";
import { STATUSES, STATUS_DOT, type Instance } from "./types";

export interface InstancesPageProps {
  instances: Instance[];
  /** Open one instance's record. */
  onOpen: (instance: Instance) => void;
}

/**
 * Instances — every customer workspace on the platform, and the console's
 * landing. Search by name or prefix, narrow by status, open a row.
 */
export function InstancesPage({ instances, onOpen }: InstancesPageProps) {
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);

  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      instances.filter(
        (r) =>
          (statuses.length === 0 || statuses.includes(r.status)) &&
          (!q || r.name.toLowerCase().includes(q) || r.prefix.toLowerCase().includes(q)),
      ),
    [instances, statuses, q],
  );
  const narrowed = Boolean(q) || statuses.length > 0;

  const columns: Column<Instance>[] = [
    {
      key: "name",
      header: "Instances",
      width: "minmax(220px, 2fr)",
      render: (r) => (
        <span className="console-name">
          {r.name}
          <span className="console-name__prefix">{r.prefix}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", width: "130px", render: (r) => <StatusBadge status={r.status} /> },
    { key: "seats", header: "Seats", width: "100px", render: (r) => r.seats },
    {
      key: "modules",
      header: "Modules",
      width: "100px",
      render: (r) =>
        r.modules.length > 0 ? (
          <span className="console-count" title={r.modules.join(", ")}>
            {r.modules.length}
          </span>
        ) : (
          <span className="console-none">—</span>
        ),
    },
    { key: "created", header: "Created", width: "120px", render: (r) => r.created },
  ];

  return (
    <div>
      <ConsoleHeader title="Instances" />

      <div className="opx-toolbar">
        <MultiFilter
          searchInput={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name or prefix"
          sections={[
            {
              kind: "checklist",
              key: "status",
              label: "Status",
              selected: statuses,
              onChange: setStatuses,
              options: STATUSES.map((s) => ({
                value: s,
                label: s,
                color: STATUS_DOT[s],
                count: instances.filter((r) => r.status === s).length,
              })),
            },
          ]}
        />
        <div className="opx-toolbar__actions">
          <span className="console-total">
            {narrowed ? `${rows.length} of ${instances.length}` : instances.length} instances
          </span>
        </div>
      </div>

      <Table
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        minWidth={680}
        minHeight={0}
        onRowClick={onOpen}
        emptyVariant={narrowed ? "no-results" : "empty"}
        emptyMessage={q ? `Nothing matches “${search.trim()}”` : "No instances"}
        emptyAction={
          narrowed ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatuses([]);
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
