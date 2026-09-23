import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  Table,
  TableAction,
  TableRowActions,
  type Column,
} from "../../components";
import type { DemoDetailPanel, DemoRow } from "../../data/types";
import { toColumn } from "./columns";
import { MasterForm } from "./MasterForm";

export interface DetailPanelProps {
  panel: DemoDetailPanel;
  /** The parent row whose children are being edited. */
  row: DemoRow;
  rowLabel: string;
  onClose: () => void;
  onChange: (items: DemoRow[]) => void;
}

/**
 * The child records hanging off one row — stage fields under a stage,
 * permissions under a role.
 *
 * In the application these are separate bespoke managers per parent. Here the
 * panel is another descriptor: `detail.columns` and `detail.fields` drive it,
 * so a master gains a child editor by describing one.
 */
export function DetailPanel({ panel, row, rowLabel, onClose, onChange }: DetailPanelProps) {
  const items = (Array.isArray(row[panel.itemsKey]) ? row[panel.itemsKey] : []) as DemoRow[];
  const [editing, setEditing] = useState<DemoRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<DemoRow | null>(null);

  // The child editor reuses MasterForm, which takes a master — so the panel
  // describes itself as one. Nothing else about it is master-shaped.
  const asMaster = {
    key: `${panel.itemsKey}-child`,
    label: panel.title,
    singular: panel.singular,
    module: "",
    section: "",
    columns: panel.columns,
    fields: panel.fields,
    rows: [],
  };

  const columns: Column<DemoRow>[] = [
    ...panel.columns.map(toColumn),
    {
      key: "__actions",
      header: "",
      width: "130px",
      align: "right",
      render: (item) => (
        <TableRowActions nowrap>
          <TableAction onClick={() => setEditing(item)}>Edit</TableAction>
          <TableAction tone="danger" onClick={() => setRemoving(item)}>
            Remove
          </TableAction>
        </TableRowActions>
      ),
    },
  ];

  function save(values: Record<string, unknown>) {
    if (editing) {
      onChange(items.map((i) => (i.id === editing.id ? ({ ...i, ...values } as DemoRow) : i)));
      setEditing(null);
      return;
    }
    onChange([...items, { ...values, id: `child-${Date.now()}`, is_active: true } as DemoRow]);
    setCreating(false);
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={panel.title.replace("{row}", rowLabel)}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => setCreating(true)}>+ Add {panel.singular.toLowerCase()}</Button>
          </>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            variant="empty"
            title={panel.emptyMessage ?? `No ${panel.singular.toLowerCase()} yet`}
            description={`Add the first ${panel.singular.toLowerCase()} with the button below.`}
          />
        ) : (
          <Table
            columns={columns}
            data={items}
            rowKey={(i) => i.id}
            minHeight={120}
            minWidth={420}
          />
        )}
      </Modal>

      {(creating || editing) && (
        <MasterForm
          key={editing?.id ?? "new-child"}
          open
          master={asMaster}
          row={editing}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}

      <ConfirmDialog
        open={removing != null}
        title={`Remove this ${panel.singular.toLowerCase()}?`}
        description={
          removing
            ? `“${String(removing[panel.columns[0].key] ?? removing.id)}” will no longer be captured at ${rowLabel}.`
            : ""
        }
        confirmLabel="Remove"
        confirmTone="danger"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) onChange(items.filter((i) => i.id !== removing.id));
          setRemoving(null);
        }}
      />
    </>
  );
}
