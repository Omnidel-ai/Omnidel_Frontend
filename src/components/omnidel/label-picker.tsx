"use client";

import { useState, useEffect, useRef, Fragment, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { DEFAULT_LABEL_COLOR, LABEL_COLOR_PALETTE } from "@/lib/label-colors";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { TASK_LABEL_NAME_MAX, clampToMaxLength } from "@/lib/field-limits";
import { useTr } from "@/lib/client/language";

export interface Label { id: string; slug: string; label: string; color: string; sort_order?: number }

/** Max labels on the first wrap row (with status/priority when provided as `leading`). */
const LABELS_PER_FIRST_ROW = 3;

interface Props {
  assigned: Label[];
  available: Label[];
  canManage: boolean;
  onAdd: (label: Label) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
  onCreate?: (input: { label: string; color: string }) => Promise<Label | null>;
  onUpdate?: (id: string, input: { label: string; color: string }) => Promise<Label | null>;
  onDelete?: (id: string) => Promise<boolean>;
  /** Optional chips before labels (e.g. status + priority) on the same row. */
  leading?: ReactNode;
}

function labelBarTextColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return "var(--ink)";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "var(--ink)" : "#f4efdf";
}

function normalizeHexForInput(hex: string): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return DEFAULT_LABEL_COLOR;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h.toLowerCase()}`;
}

function displayHex(hex: string): string {
  return normalizeHexForInput(hex).toUpperCase();
}

type View = "list" | "create" | "edit";

export function LabelPicker({
  assigned, available, canManage, onAdd, onRemove, onCreate, onUpdate, onDelete, leading,
}: Props) {
  const tr = useTr();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Label | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(DEFAULT_LABEL_COLOR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /**
   * Portaled confirms — hold the target here so outside-click / clear races
   * never drop the id mid-action.
   *   remove = unassign from this task only
   *   delete = soft-delete master label from the project
   */
  const [pendingConfirm, setPendingConfirm] = useState<
    { kind: "remove" | "delete"; label: Label } | null
  >(null);
  const pendingConfirmRef = useRef<typeof pendingConfirm>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const assignedIds = new Set(assigned.map((a) => a.id));
  const q = search.trim().toLowerCase();
  const filtered = available.filter((l) => !q || l.label.toLowerCase().includes(q));

  useEffect(() => {
    pendingConfirmRef.current = pendingConfirm;
  }, [pendingConfirm]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      // ConfirmDialog is portaled to document.body — clicks on it must NOT close
      // the picker (that was the delete-no-op bug).
      if ((t as Element).closest?.("[data-confirm-dialog]")) return;
      // While any confirm is open, ignore outside clicks.
      if (pendingConfirmRef.current) return;
      if (wrapRef.current && !wrapRef.current.contains(t)) {
        setPickerOpen(false);
        setView("list");
        setSearch("");
        setEditTarget(null);
        setFormName("");
        setFormColor(DEFAULT_LABEL_COLOR);
        setError("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  function openCreate() {
    setView("create");
    setFormName("");
    setFormColor(DEFAULT_LABEL_COLOR);
    setError("");
  }

  function openEdit(lb: Label, e: MouseEvent) {
    e.stopPropagation();
    setEditTarget(lb);
    setFormName(lb.label);
    setFormColor(lb.color || DEFAULT_LABEL_COLOR);
    setView("edit");
    setError("");
  }

  async function toggleLabel(lb: Label) {
    if (!canManage || busy) return;
    // Unassign from this task → confirm first (same as chip ×).
    if (assignedIds.has(lb.id)) {
      setPendingConfirm({ kind: "remove", label: lb });
      return;
    }
    setBusy(true);
    try {
      await onAdd(lb);
    } finally {
      setBusy(false);
    }
  }

  function requestRemoveFromTask(lb: Label) {
    setPendingConfirm({ kind: "remove", label: lb });
  }

  async function handleCreate() {
    if (!onCreate || !formName.trim()) return;
    const name = clampToMaxLength(formName.trim(), TASK_LABEL_NAME_MAX);
    if (name.length < 1) return;
    setBusy(true);
    setError("");
    try {
      const created = await onCreate({ label: name, color: formColor });
      if (created) {
        setView("list");
        setFormName("");
        setFormColor(DEFAULT_LABEL_COLOR);
      } else {
        setError("Could not create label.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit() {
    if (!onUpdate || !editTarget || !formName.trim()) return;
    const name = clampToMaxLength(formName.trim(), TASK_LABEL_NAME_MAX);
    if (name.length < 1) return;
    setBusy(true);
    setError("");
    try {
      const updated = await onUpdate(editTarget.id, { label: name, color: formColor });
      if (updated) {
        setView("list");
        setEditTarget(null);
      } else {
        setError("Could not save label.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmAction() {
    if (!pendingConfirm) return;
    const { kind, label } = pendingConfirm;
    setBusy(true);
    setError("");
    try {
      if (kind === "remove") {
        await onRemove(label.id);
        setPendingConfirm(null);
        return;
      }
      // kind === "delete" — soft-delete master from project
      if (!onDelete) return;
      const ok = await onDelete(label.id);
      if (ok) {
        setPendingConfirm(null);
        setView("list");
        setEditTarget(null);
        setPickerOpen(true); // keep list open so user sees the label gone
      } else {
        setError("Could not delete label.");
        setPendingConfirm(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {leading}

      {assigned.map((lb, i) => (
        <Fragment key={lb.id}>
          {/* After the 3rd label, force remaining chips (+ Add) onto the next line. */}
          {i === LABELS_PER_FIRST_ROW && (
            <span
              aria-hidden
              style={{ flexBasis: "100%", width: 0, height: 0, overflow: "hidden" }}
            />
          )}
          <span
            title={lb.label}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 999,
              background: hexWithAlpha(lb.color || DEFAULT_LABEL_COLOR, 0.18),
              color: lb.color || DEFAULT_LABEL_COLOR,
              fontSize: 11, fontWeight: 600,
              fontFamily: "var(--mono)", letterSpacing: "0.04em",
              textTransform: "uppercase",
              border: `1px solid ${hexWithAlpha(lb.color || DEFAULT_LABEL_COLOR, 0.4)}`,
            }}
          >
            {lb.label}
            {canManage && (
              <button
                type="button"
                onClick={() => requestRemoveFromTask(lb)}
                style={{
                  border: "none", background: "transparent",
                  color: "inherit", cursor: "pointer", padding: 0,
                  fontSize: 13, lineHeight: 1,
                }}
                aria-label={`Remove ${lb.label}`}
              >×</button>
            )}
          </span>
        </Fragment>
      ))}

      {/* Always immediately after the last label (or after leading when none). */}
      {canManage && (
        <div ref={wrapRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setPickerOpen((o) => !o)} style={addBtnOutlineStyle}>
            {tr("+ Add label")}
          </button>

          {pickerOpen && (
            <div style={popoverStyle} role="dialog" aria-label={tr("Labels")}>
              {view === "list" && (
                <>
                  <div style={{ padding: "8px 10px 6px" }}>
                    <input
                      value={search}
                      onChange={(e) => setSearch(clampToMaxLength(e.target.value, TASK_LABEL_NAME_MAX))}
                      placeholder={tr("Search labels...")}
                      maxLength={TASK_LABEL_NAME_MAX}
                      style={searchInputStyle}
                      autoFocus
                    />
                  </div>

                  {/* Dot + name list (previous preferred style) */}
                  <div style={{ maxHeight: 260, overflowY: "auto", padding: "2px 0 6px" }}>
                    {filtered.length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--ink-mute)" }}>
                        {available.length === 0 ? tr("No labels yet") : tr("No matching labels")}
                      </div>
                    )}
                    {filtered.map((lb) => {
                      const on = assignedIds.has(lb.id);
                      return (
                        <div
                          key={lb.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "0 6px 0 0",
                            background: on ? "var(--surface-sunk)" : "transparent",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => void toggleLabel(lb)}
                            disabled={busy}
                            style={dotRowBtnStyle}
                            onMouseEnter={(e) => {
                              if (!on) e.currentTarget.style.background = "var(--surface-sunk)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                            title={on ? "Remove from card" : "Add to card"}
                          >
                            <span
                              style={{
                                width: 10, height: 10, borderRadius: "50%",
                                background: lb.color || DEFAULT_LABEL_COLOR,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{
                              flex: 1, color: "var(--ink-soft)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              fontWeight: on ? 600 : 400,
                            }}>
                              {lb.label}
                            </span>
                            {on && (
                              <span style={{
                                fontSize: 11, color: "var(--ink-mute)", flexShrink: 0,
                              }} aria-hidden>✓</span>
                            )}
                          </button>
                          {(onUpdate || onDelete) && (
                            <button
                              type="button"
                              onClick={(e) => openEdit(lb, e)}
                              style={editIconBtnStyle}
                              aria-label={`Edit ${lb.label}`}
                              title={tr("Edit label")}
                            >
                              <EditPencilIcon />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {onCreate && (
                    <div style={{ padding: "8px 10px 10px", borderTop: "1px solid var(--rule)" }}>
                      <button type="button" onClick={openCreate} style={createLabelBtnStyle}>
                        {tr("+ Create new label")}
                      </button>
                    </div>
                  )}
                </>
              )}

              {(view === "create" || view === "edit") && (
                <>
                  <div style={{
                    ...headerStyle,
                    display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                  }}>
                    <button
                      type="button"
                      onClick={() => { setView("list"); setError(""); }}
                      style={backBtnStyle}
                      aria-label={tr("Back")}
                    >←</button>
                    <span style={{ flex: 1, textAlign: "center" }}>
                      {view === "create" ? tr("Create label") : tr("Edit label")}
                    </span>
                    <span style={{ width: 20 }} />
                  </div>

                  <div style={{ padding: "4px 12px 12px", display: "grid", gap: 12 }}>
                    <div
                      style={{
                        minHeight: 32, borderRadius: "var(--r-sm)",
                        background: formColor || DEFAULT_LABEL_COLOR,
                        color: labelBarTextColor(formColor || DEFAULT_LABEL_COLOR),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 600, fontSize: 12, fontFamily: "var(--sans)",
                        padding: "4px 10px",
                      }}
                    >
                      {formName.trim() || tr("Label preview")}
                    </div>

                    <input
                      autoFocus
                      value={formName}
                      onChange={(e) => setFormName(clampToMaxLength(e.target.value, TASK_LABEL_NAME_MAX))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (view === "create") void handleCreate();
                          else void handleSaveEdit();
                        }
                        if (e.key === "Escape") setView("list");
                      }}
                      placeholder={tr("Label name")}
                      maxLength={TASK_LABEL_NAME_MAX}
                      style={searchInputStyle}
                    />

                    {/* OmniDel circular palette */}
                    <LabelColorSwatches value={formColor} onChange={setFormColor} />

                    {/* Color picker row: full chip + hex to the right */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="color"
                        value={normalizeHexForInput(formColor)}
                        onChange={(e) => setFormColor(e.target.value)}
                        title={tr("Color")}
                        aria-label={tr("Label color")}
                        style={colorInputWideStyle}
                      />
                      <input
                        type="text"
                        value={displayHex(formColor)}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                            const withHash = v.startsWith("#") ? v : `#${v}`;
                            if (/^#[0-9a-fA-F]{6}$/i.test(withHash)) setFormColor(withHash);
                            else if (/^#[0-9a-fA-F]{3}$/i.test(withHash)) setFormColor(withHash);
                          }
                        }}
                        spellCheck={false}
                        aria-label={tr("Hex color")}
                        style={hexInputStyle}
                      />
                    </div>

                    {error && (
                      <div style={{ fontSize: 12, color: "var(--crit)" }}>{error}</div>
                    )}

                    {/* Actions on one row: primary + cancel (+ delete on edit) */}
                    {view === "create" ? (
                      <div style={actionsRowStyle}>
                        <button
                          type="button"
                          onClick={() => void handleCreate()}
                          disabled={!formName.trim() || busy}
                          style={{
                            ...createLabelBtnInlineStyle,
                            opacity: !formName.trim() || busy ? 0.55 : 1,
                          }}
                        >
                          {busy ? "..." : tr("Create")}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setView("list"); setError(""); }}
                          disabled={busy}
                          style={cancelBtnSm}
                        >
                          {tr("Cancel")}
                        </button>
                      </div>
                    ) : (
                      <div style={actionsRowStyle}>
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit()}
                          disabled={!formName.trim() || busy}
                          style={{
                            ...createLabelBtnInlineStyle,
                            opacity: !formName.trim() || busy ? 0.55 : 1,
                          }}
                        >
                          {busy ? "..." : tr("Save")}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setView("list"); setError(""); }}
                          disabled={busy}
                          style={cancelBtnSm}
                        >
                          {tr("Cancel")}
                        </button>
                        {onDelete && editTarget && (
                          <button
                            type="button"
                            onClick={() => setPendingConfirm({ kind: "delete", label: editTarget })}
                            disabled={busy}
                            style={dangerBtnSm}
                          >
                            {tr("Delete")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      )}

      {/* Portaled confirm — outside wrapRef; outside-click ignores [data-confirm-dialog]. */}
      <ConfirmDialog
        open={pendingConfirm !== null}
        title={
          pendingConfirm?.kind === "remove"
            ? "Remove label?"
            : "Delete label?"
        }
        description={
          pendingConfirm?.kind === "remove"
            ? `Remove “${pendingConfirm.label.label}” from this task? The label stays available for other cards.`
            : pendingConfirm
              ? `Delete label “${pendingConfirm.label.label}”? It will be removed from all cards on this project.`
              : undefined
        }
        confirmLabel={pendingConfirm?.kind === "remove" ? "Remove" : "Delete"}
        cancelLabel={tr("Cancel")}
        confirmTone="danger"
        busy={busy}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return "var(--surface-sunk)";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function LabelColorSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {LABEL_COLOR_PALETTE.map((c) => {
        const selected = value.toLowerCase() === c.value.toLowerCase();
        return (
          <button
            key={c.value}
            type="button"
            title={c.name}
            aria-label={c.name}
            onClick={() => onChange(c.value)}
            style={{
              width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
              background: c.value,
              borderWidth: 2, borderStyle: "solid",
              borderColor: selected ? "var(--ink)" : "transparent",
              boxShadow: selected ? "0 0 0 2px var(--surface)" : "none",
              outline: "none", flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

function EditPencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

const addBtnOutlineStyle: CSSProperties = {
  padding: "4px 10px", fontSize: 11, fontWeight: 500,
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

/** Same green solid style as task modal “+ Add Comment” (full-width footer). */
const createLabelBtnStyle: CSSProperties = {
  width: "100%",
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--green-deep)",
  color: "#f4efdf",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};

/** Green primary for inline action rows (Save / Create next to Cancel / Delete). */
const createLabelBtnInlineStyle: CSSProperties = {
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--green-deep)",
  color: "#f4efdf",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  whiteSpace: "nowrap",
};

const actionsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "nowrap",
};

const popoverStyle: CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0,
  width: 280, background: "var(--surface)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)", zIndex: 1100,
  overflow: "hidden",
};
const headerStyle: CSSProperties = {
  padding: "10px 12px 6px", fontSize: 12, fontWeight: 600,
  color: "var(--ink-soft)", fontFamily: "var(--sans)",
};
const searchInputStyle: CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 12,
  background: "var(--page)", color: "var(--ink)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)", boxSizing: "border-box",
};
const dotRowBtnStyle: CSSProperties = {
  flex: 1, minWidth: 0,
  padding: "7px 8px 7px 12px", fontSize: 12, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 8,
  border: "none", background: "transparent",
  fontFamily: "var(--sans)", textAlign: "left",
};
const editIconBtnStyle: CSSProperties = {
  width: 28, height: 28, flexShrink: 0,
  border: "1px solid transparent", borderRadius: "var(--r-sm)",
  background: "transparent", color: "var(--ink-mute)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
const backBtnStyle: CSSProperties = {
  border: "none", background: "transparent", cursor: "pointer",
  color: "var(--ink-soft)", fontSize: 14, padding: "0 4px", lineHeight: 1,
};
const cancelBtnSm: CSSProperties = {
  padding: "7px 12px", fontSize: 12,
  background: "transparent", color: "var(--ink-mute)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};
/** Full-row color chip (taller, wider). */
const colorInputWideStyle: CSSProperties = {
  flex: 1, minWidth: 0, height: 36, padding: 2,
  background: "var(--page)", border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)", cursor: "pointer",
};
const hexInputStyle: CSSProperties = {
  width: 88, flexShrink: 0, height: 36, padding: "0 10px",
  fontSize: 12, fontFamily: "var(--mono)", letterSpacing: "0.04em",
  background: "var(--page)", color: "var(--ink)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  boxSizing: "border-box", textTransform: "uppercase",
};
const dangerBtnSm: CSSProperties = {
  padding: "7px 12px", fontSize: 12, fontWeight: 500,
  background: "var(--crit-wash)", color: "var(--crit)",
  border: "1px solid var(--crit)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};
