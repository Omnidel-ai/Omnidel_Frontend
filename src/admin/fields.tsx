import {
  Checkbox,
  CustomSelect,
  FormField,
  Input,
  MultiSelect,
  Textarea,
} from "../components";
import type { DemoField } from "../data/types";

/**
 * One descriptor field → one control.
 *
 * Shared by every form in the workspace: the master create/edit dialog, the
 * child-record panel and the settings pages. A new field type is added here
 * once and appears in all three.
 */
export function FieldControl({
  field,
  value,
  onChange,
  error,
  locked = false,
}: {
  field: DemoField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  /** Immutable in this context — a code set at creation, say. */
  locked?: boolean;
}) {
  const f = field;

  if (f.type === "checkbox") {
    return (
      <Checkbox
        label={f.label}
        hint={f.hint}
        checked={Boolean(value)}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (f.type === "multiselect") {
    return (
      <FormField label={f.label} required={f.required} hint={f.hint} error={error}>
        <MultiSelect
          options={f.options ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          placeholder={f.placeholder ?? `Select ${f.label.toLowerCase()}`}
          disabled={locked}
        />
      </FormField>
    );
  }

  if (f.type === "color") {
    return (
      <FormField label={f.label} required={f.required} hint={f.hint} error={error}>
        <ColorPicker value={String(value ?? "")} onChange={onChange} />
      </FormField>
    );
  }

  if (f.type === "select") {
    return (
      <FormField label={f.label} required={f.required} hint={f.hint} error={error}>
        <CustomSelect
          value={String(value ?? "")}
          onChange={onChange}
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
        label={f.label}
        required={f.required}
        hint={f.hint}
        error={error}
        placeholder={f.placeholder}
        disabled={locked}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      label={f.label}
      required={f.required}
      hint={locked ? (f.hint ?? "Set at creation.") : f.hint}
      error={error}
      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
      placeholder={f.placeholder}
      readOnly={locked}
      disabled={locked}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Starting value for a field with nothing stored against it. */
export function defaultFor(f: DemoField): unknown {
  if (f.type === "checkbox") return f.key === "is_active";
  if (f.type === "multiselect") return [];
  return "";
}

/**
 * Validate a draft against the descriptor.
 *
 * Only what the descriptor states — `required`, and numbers must parse.
 * Anything domain-specific belongs to whoever owns the data.
 */
export function validate(fields: DemoField[], values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = values[f.key];
    if (f.type === "multiselect") {
      if (f.required && (!Array.isArray(raw) || raw.length === 0)) {
        errors[f.key] = `Pick at least one ${f.label.toLowerCase()}.`;
      }
      continue;
    }
    if (f.required && (raw === "" || raw === null || raw === undefined)) {
      errors[f.key] = `${f.label} is required.`;
      continue;
    }
    if (f.type === "number" && raw !== "" && raw != null && Number.isNaN(Number(raw))) {
      errors[f.key] = "Enter a number.";
    }
  }
  return errors;
}

/** Numbers arrive from inputs as strings; store them as numbers. */
export function coerce(fields: DemoField[], values: Record<string, unknown>): Record<string, unknown> {
  const out = { ...values };
  for (const f of fields) {
    if (f.type === "number" && out[f.key] !== "" && out[f.key] != null) {
      out[f.key] = Number(out[f.key]);
    }
  }
  return out;
}

/** Swatches from the palette, plus whatever value the record already carries. */
const SWATCHES = [
  "#254a33",
  "#376a46",
  "#a74a2d",
  "#a5711a",
  "#8b3320",
  "#3b6f49",
  "#6a5acd",
  "#0f7b6c",
  "#8b7d60",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const swatches = value && !SWATCHES.includes(value) ? [value, ...SWATCHES] : SWATCHES;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {swatches.map((c) => {
          const active = c === value;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={c}
              aria-pressed={active}
              title={c}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                background: c,
                border: `2px solid ${active ? "var(--ink)" : "var(--rule-strong)"}`,
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#254a33"
        aria-label="Hex value"
        className="form-input"
        style={{ width: 110, fontFamily: "var(--mono)", fontSize: 12 }}
      />
    </div>
  );
}
