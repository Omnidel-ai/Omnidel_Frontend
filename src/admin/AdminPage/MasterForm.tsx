import { useMemo, useState } from "react";
import { Button, Modal } from "../../components";
import type { DemoMaster, DemoRow } from "../../data/types";
import { FieldControl, coerce, defaultFor, validate } from "../fields";

export interface MasterFormProps {
  master: DemoMaster;
  /** null → create. A row → edit that row. */
  row: DemoRow | null;
  open: boolean;
  onCancel: () => void;
  onSave: (values: Record<string, unknown>) => void;
}

/**
 * Create/edit dialog built from a master's `fields`.
 *
 * Fourteen admin pages in the application each hand-roll this dialog against a
 * different table. Here the field list is data, so one component covers all of
 * them — and the controls themselves come from `fields.tsx`, which the settings
 * pages and the child-record panel share.
 */
export function MasterForm({ master, row, open, onCancel, onSave }: MasterFormProps) {
  const isEdit = row != null;

  const initial = useMemo(() => {
    const v: Record<string, unknown> = {};
    for (const f of master.fields) {
      v[f.key] = row ? (row[f.key] ?? defaultFor(f)) : defaultFor(f);
    }
    return v;
  }, [master, row]);

  // Keyed remount (see AdminPage) gives each open a fresh draft, so no effect
  // is needed to reset this when `row` changes.
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  function submit() {
    const next = validate(master.fields, values);
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSave(coerce(master.fields, values));
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="lg"
      title={isEdit ? `Edit ${master.singular.toLowerCase()}` : `New ${master.singular.toLowerCase()}`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={submit}>{isEdit ? "Save" : "Create"}</Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {master.fields.map((f) => (
          <FieldControl
            key={f.key}
            field={f}
            value={values[f.key]}
            error={errors[f.key]}
            locked={isEdit && f.readOnlyOnEdit}
            onChange={(v) => set(f.key, v)}
          />
        ))}
      </div>
    </Modal>
  );
}
