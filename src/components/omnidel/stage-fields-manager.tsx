"use client";

import { useState, useEffect, useCallback } from "react";
import { PermissionGate } from "@/lib/client/permissions";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { useTr } from "@/lib/client/language";

// value auto-derived from the label when the user leaves it blank.
function slugifyOption(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// Keep in sync with mst_stage_fields.field_type CHECK + lead-stage-data.STAGE_FIELD_TYPES.
const FIELD_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency (₹)" },
  { value: "date", label: "Date" },
  { value: "bool", label: "Yes / No" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL / Link" },
  { value: "select", label: "Dropdown (single)" },
  { value: "multiselect", label: "Multi-select" },
  { value: "file", label: "Attachment / Upload" },
  { value: "image", label: "Image (single)" },
  { value: "images", label: "Images (multiple)" },
];

const TYPE_LABEL = (t: string) => FIELD_TYPES.find((f) => f.value === t)?.label ?? t;
const HAS_OPTIONS = (t: string) => t === "select" || t === "multiselect";

interface StageField {
  id: string;
  stage_slug: string;
  field_slug: string;
  label: string;
  field_type: string;
  is_required: boolean;
  validation: { options?: { value: string; label: string }[] };
  sort_order: number;
  is_locked: boolean;
  is_active: boolean;
}

export function StageFieldsManager({
  stageSlug,
  stageLabel,
  onClose,
  apiPrefix = "/api/admin/stage-fields",
}: {
  stageSlug: string;
  stageLabel: string;
  onClose: () => void;
  apiPrefix?: string;
}) {
  const tr = useTr();
  const [fields, setFields] = useState<StageField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editField, setEditField] = useState<StageField | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState("");

  const fetchFields = useCallback(() => {
    setLoading(true);
    fetch(`${apiPrefix}?stage=${encodeURIComponent(stageSlug)}`)
      .then((r) => r.json())
      .then((d) => { setFields(((d.items || []) as StageField[]).sort((a, b) => a.sort_order - b.sort_order)); setDirty(false); })
      .finally(() => setLoading(false));
  }, [stageSlug, apiPrefix]);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[idx], next[j]] = [next[j], next[idx]];
    setFields(next);
    setDirty(true);
  }

  async function saveOrder() {
    setSavingOrder(true);
    setError("");
    try {
      const res = await fetch(`${apiPrefix}/reorder`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_slug: stageSlug, ordered_ids: fields.map((f) => f.id) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to save order"); // keep dirty so the user can retry
        return;
      }
      setDirty(false);
      fetchFields();
    } catch {
      setError("Failed to save order — check your connection.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function toggle(f: StageField) {
    if (f.is_locked) return;
    setError("");
    try {
      const res = await fetch(`${apiPrefix}/${f.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !f.is_active }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to update field");
        return;
      }
      fetchFields();
    } catch {
      setError("Failed to update field — check your connection.");
    }
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(35,29,20,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", width: "min(760px, 96vw)", maxHeight: "88vh", overflowY: "auto", padding: 24, boxShadow: "var(--shadow-md)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 20 }}>{stageLabel}</h3>
          </div>
          <button onClick={onClose} aria-label={tr("Close")} style={{ background: "transparent", border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", color: "var(--ink-soft)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "4px 9px" }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 16 }}>
          {tr("Fields captured on this stage’s page. Add fields, rename labels, reorder, or deactivate — system fields are locked. Deactivated fields keep their saved data.")}
        </p>

        {error && (
          <div style={{ fontSize: 12, color: "var(--crit)", background: "var(--crit-wash)", border: "1px solid var(--crit)", borderRadius: "var(--r-sm)", padding: "8px 12px", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
          {dirty && (
            <PermissionGate permission="admin.config">
              <button className="btn-primary" onClick={saveOrder} disabled={savingOrder} style={{ padding: "6px 14px", fontSize: 12 }}>{savingOrder ? tr("Saving…") : tr("Save Order")}</button>
            </PermissionGate>
          )}
          <PermissionGate permission="admin.config">
            <button className="btn-primary" onClick={() => { setEditField(null); setShowForm(true); }} style={{ padding: "6px 14px", fontSize: 12 }}>{tr("+ Add Field")}</button>
          </PermissionGate>
        </div>

        {loading ? (
          <div style={{ color: "var(--ink-mute)", fontSize: 13, padding: 16 }}>{tr("Loading…")}</div>
        ) : fields.length === 0 ? (
          <div style={{ color: "var(--ink-mute)", fontSize: 13, padding: 16 }}>{tr("No fields yet. Add one with “+ Add Field”.")}</div>
        ) : (
          <div style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-sm)" }}>
            {fields.map((f, idx) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: idx < fields.length - 1 ? "1px solid var(--rule)" : "none", opacity: f.is_active ? 1 : 0.5 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", width: 18, textAlign: "center" }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                    {f.label}
                    {f.is_required && <span style={{ color: "var(--crit)", marginLeft: 4 }}>*</span>}
                    {f.is_locked && <span style={{ ...chip, marginLeft: 8 }}>system</span>}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>{TYPE_LABEL(f.field_type)} &middot; {f.field_slug}</div>
                </div>
                <PermissionGate permission="admin.config">
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {!f.is_locked && (
                      <>
                        <button className="arrow-btn" onClick={() => move(idx, -1)} disabled={idx === 0} title={tr("Move up")} style={arrowStyle(idx === 0)} aria-label={tr("Move up")}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                        </button>
                        <button className="arrow-btn" onClick={() => move(idx, 1)} disabled={idx === fields.length - 1} title={tr("Move down")} style={arrowStyle(idx === fields.length - 1)} aria-label={tr("Move down")}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                        <button onClick={() => toggle(f)} title={f.is_active ? "Deactivate" : "Activate"}
                          style={{ width: 30, height: 16, borderRadius: 8, border: "none", cursor: "pointer", background: f.is_active ? "var(--ok)" : "var(--crit)", position: "relative", padding: 0 }}>
                          <span style={{ position: "absolute", top: 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left .2s", left: f.is_active ? 16 : 2 }} />
                        </button>
                        <button style={miniBtn} onClick={() => { setEditField(f); setShowForm(true); }}>{tr("Edit")}</button>
                      </>
                    )}
                    {f.is_locked && <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>locked</span>}
                  </div>
                </PermissionGate>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <FieldForm
            stageSlug={stageSlug}
            apiPrefix={apiPrefix}
            item={editField}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); fetchFields(); }}
          />
        )}
      </div>
    </div>
  );
}

function FieldForm({
  stageSlug,
  item,
  onClose,
  onSaved,
  apiPrefix,
}: {
  stageSlug: string;
  item: StageField | null;
  onClose: () => void;
  onSaved: () => void;
  apiPrefix: string;
}) {
  const tr = useTr();
  const isEdit = !!item;
  const [label, setLabel] = useState(item?.label || "");
  const [fieldType, setFieldType] = useState(item?.field_type || "text");
  const [required, setRequired] = useState(item?.is_required ?? false);
  // Dropdown / multi-select choices as editable rows. Value auto-derives from
  // the label when left blank, so non-technical admins only type the label.
  const [optionRows, setOptionRows] = useState<{ label: string; value: string }[]>(
    (item?.validation?.options || []).map((o) => ({ label: o.label || o.value, value: o.value })),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setRow(i: number, patch: Partial<{ label: string; value: string }>) {
    setOptionRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  const addRow = () => setOptionRows((rows) => [...rows, { label: "", value: "" }]);
  const removeRow = (i: number) => setOptionRows((rows) => rows.filter((_, idx) => idx !== i));

  function parseOptions() {
    return optionRows
      .map((r) => ({ label: r.label.trim(), value: r.value.trim() || slugifyOption(r.label) }))
      .filter((r) => r.label && r.value);
  }

  async function save() {
    setError("");
    if (!label.trim()) { setError("Label is required"); return; }
    if (HAS_OPTIONS(fieldType) && parseOptions().length === 0) { setError("Add at least one option for this field"); return; }
    setSaving(true);
    const validation = HAS_OPTIONS(fieldType) ? { options: parseOptions() } : {};
    const body: Record<string, unknown> = { label: label.trim(), field_type: fieldType, is_required: required, validation };
    if (!isEdit) body.stage_slug = stageSlug;
    const url = isEdit ? `${apiPrefix}/${item.id}` : apiPrefix;
    const res = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Save failed"); return; }
    onSaved();
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(35,29,20,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", width: "min(460px, 94vw)", padding: 24, boxShadow: "var(--shadow-md)" }}>
        <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, marginBottom: 16 }}>{isEdit ? tr("Edit field") : tr("Add field")}</h3>
        {error && <div className="form-error">{error}</div>}
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label className="form-label">{tr("Label")}</label>
            <input className="form-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tr("e.g. Rough Area (sq ft)")} />
            {isEdit && <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>{tr("Key:")} {item!.field_slug} {tr("(fixed — only the label changes)")}</div>}
          </div>
          <div>
            <label className="form-label">{tr("Field type")}</label>
            <CustomSelect
              value={fieldType}
              onChange={setFieldType}
              options={FIELD_TYPES}
              placeholder={tr("Select field type…")}
            />
          </div>
          {HAS_OPTIONS(fieldType) && (
            <div>
              <label className="form-label">{tr("Options")}</label>
              <div style={{ display: "grid", gap: 8 }}>
                {optionRows.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{tr("No options yet — add the choices this dropdown should show.")}</div>
                )}
                {optionRows.map((row, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      className="form-input"
                      value={row.label}
                      onChange={(e) => setRow(i, { label: e.target.value })}
                      placeholder={`Option ${i + 1} (e.g. Walk-in)`}
                      style={{ flex: 1, minWidth: 0 }}
                      aria-label={`Option ${i + 1}`}
                    />
                    <button type="button" onClick={() => removeRow(i)} aria-label={`Remove option ${i + 1}`}
                      style={{ flex: "0 0 auto", width: 30, height: 30, borderRadius: "var(--r-sm)", border: "1px solid var(--rule-strong)", background: "var(--surface-sunk)", color: "var(--ink-soft)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addRow} style={{ justifySelf: "start", padding: "6px 12px", fontSize: 12 }}>{tr("+ Add option")}</button>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6 }}>{tr("These are the choices users pick from.")}</div>
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            {tr("Required to advance to the next stage")}
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button className="btn-secondary" onClick={onClose}>{tr("Cancel")}</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "…" : isEdit ? tr("Save") : tr("Add")}</button>
        </div>
      </div>
    </div>
  );
}

const chip: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 999, background: "var(--surface-sunk)", color: "var(--ink-mute)" };
const miniBtn: React.CSSProperties = { padding: "4px 8px", fontSize: 11, fontWeight: 500, background: "var(--surface-sunk)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)", cursor: "pointer", color: "var(--ink)", fontFamily: "var(--sans)" };
function arrowStyle(disabled: boolean): React.CSSProperties {
  return { width: 24, height: 22, fontSize: 12, background: "var(--surface-sunk)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)", cursor: disabled ? "not-allowed" : "pointer", color: "var(--ink-soft)", opacity: disabled ? 0.4 : 1 };
}
