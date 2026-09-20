import { useMemo, useState } from "react";
import {
  Badge,
  Pagination,
  StatusToggle,
  Table,
  TableAction,
  TableAddButton,
  TableControls,
  TableRowActions,
  usePagination,
  type Column,
} from "../components";
import { Case, Section } from "./Case";

/**
 * Demo row. It lives in the playground, not in the library — the shared Table
 * has no idea this type exists, which is the whole point of the boundary.
 */
interface LaneRow {
  id: string;
  name: string;
  code: string;
  region: string;
  status: "active" | "paused" | "archived";
  stops: number;
  active: boolean;
}

const REGIONS = ["North", "South", "East", "West"];
const ROWS: LaneRow[] = Array.from({ length: 43 }, (_, i) => ({
  id: `lane-${i + 1}`,
  name:
    i === 2
      ? "Newtown → Barasat overnight consolidation lane (pilot, phase two, reviewed quarterly)"
      : `Lane ${i + 1}`,
  code: `LN-${String(i + 1).padStart(3, "0")}`,
  region: REGIONS[i % REGIONS.length],
  status: i % 7 === 0 ? "archived" : i % 3 === 0 ? "paused" : "active",
  stops: (i * 7) % 40,
  active: i % 3 !== 0,
}));

const STATUS_TONE = { active: "ok", paused: "amber", archived: "neutral" } as const;

export function TableSection() {
  const [search, setSearch] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [perPage, setPerPage] = useState(10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ROWS;
    return ROWS.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
    );
  }, [search]);

  const { page, setPage, paginated, total } = usePagination(filtered, perPage);

  const columns: Column<LaneRow>[] = [
    { key: "code", header: "Code", width: "110px" },
    { key: "name", header: "Name", width: "minmax(180px, 2fr)" },
    { key: "region", header: "Region", width: "120px" },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>,
    },
    { key: "stops", header: "Stops", width: "90px", align: "right" },
    {
      key: "active",
      header: "Live",
      width: "70px",
      render: (r) => (
        <StatusToggle
          active={toggles[r.id] ?? r.active}
          onToggle={(next) => setToggles((t) => ({ ...t, [r.id]: next }))}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      width: "150px",
      render: () => (
        <TableRowActions>
          <TableAction>Edit</TableAction>
          <TableAction tone="danger">Archive</TableAction>
        </TableRowActions>
      ),
    },
  ];

  const shortColumns: Column<LaneRow>[] = columns.slice(0, 4);

  return (
    <Section id="table" title="Table">
      <Case label="Normal — toolbar, 43 rows, search, pagination, mixed column widths" stack={false}>
        <div style={{ width: "100%" }}>
          <div className="table-toolbar">
            <TableControls
              search={search}
              onSearch={setSearch}
              placeholder="Search lanes…"
              inlineOnMobile
            />
            <TableAddButton label="+ Add Lane" onClick={() => undefined} />
          </div>
          <Table
            columns={columns}
            data={paginated}
            rowKey={(r) => r.id}
            minWidth={900}
            emptyMessage="No lanes match this search"
            emptyHint="Clear the search to see all 43 lanes."
          />
          <Pagination
            page={page}
            total={total}
            perPage={perPage}
            onChange={setPage}
            onPerPageChange={setPerPage}
            label="lanes"
          />
        </div>
      </Case>

      <div className="pg-grid-2">
        <div>
          <div className="pg-case__label">Loading</div>
          <Table columns={shortColumns} data={[]} loading minHeight={260} minWidth={520} />
        </div>
        <div>
          <div className="pg-case__label">Empty</div>
          <Table
            columns={shortColumns}
            data={[]}
            minHeight={260}
            minWidth={520}
            emptyMessage="No lanes yet"
            emptyHint="Add the first one to get started."
          />
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="pg-case__label">Long content — clipped by default, wrapping when asked</div>
        <Table
          columns={[
            { key: "code", header: "Code", width: "110px" },
            { key: "name", header: "Clipped", width: "minmax(160px, 1fr)" },
            { key: "name2", header: "Wrapping", width: "minmax(160px, 1fr)", wrap: true, render: (r) => r.name },
          ]}
          data={ROWS.slice(2, 5)}
          rowKey={(r) => r.id}
          minHeight={200}
          minWidth={560}
        />
      </div>

      <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 14, lineHeight: 1.6 }}>
        Narrow the window below 768px: the toolbar keeps one line, the add button becomes an icon,
        and the table scrolls sideways with a drawn rail under the card.
      </p>
    </Section>
  );
}
