import { useMemo, useState } from "react";
import { Button, Checkbox, CustomSelect, FormField, Input, Modal, Textarea } from "../../components";
import type { DemoField, DemoMaster, DemoRow } from "../../data/types";

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
 * Nine admin pages in the application each hand-roll this dialog against a
 * different table. Here the field list is data, so one component covers all of
 * them: adding a master is an entry in demo.json, not a new form.
 *
 * Validation is only what the descriptor states — `required`, and numbers must
 * parse. Anything domain-specific belongs to whoever owns the data.
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
    const next: Record<string, string> = {};
    for (const f of master.fields) {
      const raw = values[f.key];
      if (f.required && (raw === "" || raw === null || raw === undefined)) {
        next[f.key] = `${f.label} is required.`;
        continue;
      }
      if (f.type === "number" && raw !== "" && raw != null && Number.isNaN(Number(raw))) {
        next[f.key] = "Enter a number.";
      }
    }
    if (Object.keys(next).some((k) => next[k])) {
      setErrors(next);
      return;
    }
    const out: Record<string, unknown> = { ...values };
    for (const f of master.fields) {
      if (f.type === "number" && out[f.key] !== "" && out[f.key] != null) {
        out[f.key] = Number(out[f.key]);
      }
    }
    onSave(out);
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
        {master.fields.map((f) => {
          const locked = isEdit && f.readOnlyOnEdit;
          const value = values[f.key];

          if (f.type === "checkbox") {
            return (
              <Checkbox
                key={f.key}
                label={f.label}
                hint={f.hint}
                checked={Boolean(value)}
                onChange={(e) => set(f.key, e.target.checked)}
              />
            );
          }

          if (f.type === "select") {
            return (
              <FormField
                key={f.key}
                label={f.label}
                required={f.required}
                hint={f.hint}
                error={errors[f.key]}
              >
                <CustomSelect
                  value={String(value ?? "")}
                  onChange={(v) => set(f.key, v)}
                  options={f.options ?? []}
                  placeholder={f.placeholder ?? `Select ${f.label.toLowerCase()}`}
                  disabled={locked}
                  aria-label={f.label}
                  allowDeselect={!f.required}
                />
              </FormField>
            );
          }

          if (f.type === "textarea") {
            return (
              <Textarea
                key={f.key}
                label={f.label}
                required={f.required}
                hint={f.hint}
                error={errors[f.key]}
                placeholder={f.placeholder}
                value={String(value ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              />
            );
          }

          return (
            <Input
              key={f.key}
              label={f.label}
              required={f.required}
              hint={locked ? `${f.hint ?? ""}`.trim() || "Set at creation." : f.hint}
              error={errors[f.key]}
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              placeholder={f.placeholder}
              readOnly={locked}
              disabled={locked}
              value={String(value ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
            />
          );
        })}
      </div>
    </Modal>
  );
}

function defaultFor(f: DemoField): unknown {
  if (f.type === "checkbox") return f.key === "is_active";
  if (f.type === "number") return "";
  return "";
}
