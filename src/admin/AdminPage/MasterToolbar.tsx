import { Button, CustomSelect, TableAddButton, TableControls } from "../../components";
import type { DemoMaster } from "../../data/types";

export type View = "active" | "inactive" | "all" | "archived";

export const VIEW_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
  { value: "archived", label: "Archived" },
];

export interface MasterToolbarProps {
  master: DemoMaster;
  search: string;
  onSearch: (v: string) => void;
  view: View;
  onView: (v: View) => void;
  /** Values of the descriptor's extra filters, keyed by field. */
  filters: Record<string, string>;
  onFilter: (key: string, value: string) => void;
  onAdd: () => void;
  onExport?: () => void;
}

/**
 * The one toolbar every master screen uses: search, the view select, whatever
 * extra filters the descriptor declares, an optional export, and the add
 * button.
 *
 * A master with no `filters` and no `exportable` renders exactly what it did
 * before those parameters existed — the extras are additive, so the shared
 * layout stays one layout.
 */
export function MasterToolbar({
  master,
  search,
  onSearch,
  view,
  onView,
  filters,
  onFilter,
  onAdd,
  onExport,
}: MasterToolbarProps) {
  return (
    <div className="table-toolbar">
      <TableControls
        search={search}
        onSearch={onSearch}
        placeholder={master.searchPlaceholder ?? `Search ${master.label.toLowerCase()}…`}
        inlineOnMobile
      >
        <div className="picker-field">
          <CustomSelect
            value={view}
            onChange={(v) => onView(v as View)}
            options={VIEW_OPTIONS}
            aria-label="View"
            compact
          />
        </div>
        {(master.filters ?? []).map((f) => (
          <div className="picker-field" key={f.key}>
            <CustomSelect
              value={filters[f.key] ?? ""}
              onChange={(v) => onFilter(f.key, v)}
              options={f.options}
              placeholder={`Any ${f.label.toLowerCase()}`}
              aria-label={f.label}
              allowDeselect
              compact
            />
          </div>
        ))}
      </TableControls>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {master.exportable && onExport && (
          <Button variant="secondary" size="sm" onClick={onExport}>
            Download CSV
          </Button>
        )}
        <TableAddButton
          label={`+ Add ${master.singular.toLowerCase()}`}
          onClick={onAdd}
        />
      </div>
    </div>
  );
}
