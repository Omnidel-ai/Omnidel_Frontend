import { useCallback, useEffect, useState } from "react";
import { emitToast } from "../../components";
import type { DemoMaster, DemoRow } from "../../data/types";

export interface MasterRowsApi {
  rows: DemoRow[];
  loading: boolean;
  togglingId: string | null;
  create: (values: Record<string, unknown>) => void;
  update: (id: string, values: Record<string, unknown>) => void;
  setActive: (row: DemoRow, next: boolean) => void;
  setArchived: (row: DemoRow, archived: boolean) => void;
  setDefault: (row: DemoRow) => void;
  /** Swap the order field with `other`, which the caller picked as adjacent. */
  swapOrder: (row: DemoRow, other: DemoRow) => void;
  /** Replace a row's child list (the detail panel's records). */
  setChildren: (rowId: string, key: string, items: unknown[]) => void;
  reload: () => void;
}

/**
 * Row state and every write the master screen can make.
 *
 * This is the seam the real API goes behind: each function is one call site,
 * and today each one edits an in-memory array and raises a toast. The page
 * component never touches the array directly, so replacing this hook with one
 * that fetches changes nothing above it.
 */
export function useMasterRows(master: DemoMaster, label: (row: DemoRow) => string): MasterRowsApi {
  const [rows, setRows] = useState<DemoRow[]>(master.rows);
  // On the server the rows are already in hand, so there is nothing to wait
  // for; in the browser the screen opens through its skeleton, which is where
  // the read will go.
  const [loading, setLoading] = useState(() => typeof window !== "undefined");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Held briefly on mount and whenever the screen switches masters, so the
  // table's skeleton sits on the path a read would take.
  useEffect(() => {
    setRows(master.rows);
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
  }, [master]);

  const reload = useCallback(() => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 700);
  }, []);

  const create = useCallback(
    (values: Record<string, unknown>) => {
      const created = {
        ...values,
        id: `new-${Date.now()}`,
        is_active: values.is_active !== false,
        is_archived: false,
      } as DemoRow;
      setRows((rs) => [created, ...rs]);
      emitToast(`${master.singular} created`, "success");
    },
    [master.singular],
  );

  const update = useCallback(
    (id: string, values: Record<string, unknown>) => {
      setRows((rs) => rs.map((r) => (r.id === id ? ({ ...r, ...values } as DemoRow) : r)));
      emitToast(`${master.singular} updated`, "success");
    },
    [master.singular],
  );

  const setActive = useCallback(
    (row: DemoRow, next: boolean) => {
      setTogglingId(row.id);
      // A short delay so the busy state is real rather than theoretical — this
      // is where the write would go.
      window.setTimeout(() => {
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));
        setTogglingId(null);
        emitToast(`${label(row)} ${next ? "activated" : "deactivated"}`, "success");
      }, 320);
    },
    [label],
  );

  const setArchived = useCallback(
    (row: DemoRow, archived: boolean) => {
      setRows((rs) =>
        rs.map((r) =>
          r.id === row.id
            ? { ...r, is_archived: archived, is_active: archived ? false : r.is_active }
            : r,
        ),
      );
      emitToast(`${label(row)} ${archived ? "archived" : "restored"}`, archived ? "info" : "success");
    },
    [label],
  );

  const setDefault = useCallback(
    (row: DemoRow) => {
      const field = master.singleFlag?.field;
      if (!field) return;
      // Exactly one row may hold the flag, so setting it clears every other.
      setRows((rs) => rs.map((r) => ({ ...r, [field]: r.id === row.id })));
      emitToast(`${label(row)} is now the default`, "success");
    },
    [master.singleFlag, label],
  );

  const swapOrder = useCallback(
    (row: DemoRow, other: DemoRow) => {
      const field = master.reorder?.field;
      if (!field) return;
      const a = Number(row[field]);
      const b = Number(other[field]);
      if (a === b) {
        // The real screens hit this too: two rows sharing an order value have
        // nothing to swap, and silently doing nothing would look like a bug.
        emitToast("These two share the same order value — edit one to give it a distinct number.");
        return;
      }
      setRows((rs) =>
        rs.map((r) =>
          r.id === row.id ? { ...r, [field]: b } : r.id === other.id ? { ...r, [field]: a } : r,
        ),
      );
    },
    [master.reorder],
  );

  const setChildren = useCallback((rowId: string, key: string, items: unknown[]) => {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, [key]: items } : r)));
  }, []);

  return {
    rows,
    loading,
    togglingId,
    create,
    update,
    setActive,
    setArchived,
    setDefault,
    swapOrder,
    setChildren,
    reload,
  };
}
