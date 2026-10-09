"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { DatePicker } from "@/components/omnidel/date-picker";
import { PermissionGate } from "@/lib/client/permissions";
import { ImageLightbox } from "@/components/omnidel/image-lightbox";
import { uploadPipelineFile } from "@/lib/client/upload-blob-file";
import {
  imageEntriesFromValue,
  imageValuesForSave,
  type PipelineImageEntry,
} from "@/lib/pipeline-image-value";
import { useTr } from "@/lib/client/language";

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirrors StageFieldRow / StageDataRow from the service layer.
// Redeclared here so the client bundle does not import server-only modules.
// ─────────────────────────────────────────────────────────────────────────────

type FieldType =
  | "text"
  | "number"
  | "date"
  | "bool"
  | "select"
  | "multiselect"
  | "master_ref"
  | "file"
  | "phone"
  | "email"
  | "url"
  | "currency"
  | "image"
  | "images";

interface StageField {
  id: string;
  stage_slug: string;
  field_slug: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  validation: {
    min?: number;
    max?: number;
    regex?: string;
    options?: Array<{ value: string; label: string }>;
  };
  master_table: string | null;
  sort_order: number;
  is_listable: boolean;
}

interface StageDataRow {
  id: string;
  lead_id: string;
  stage_slug: string;
  values: Record<string, unknown>;
  is_current: boolean;
}

type FieldValue = string | number | boolean | string[] | PipelineImageEntry[] | null;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export type StageFieldsFormProps = {
  leadId: string;
  stage: string;
  /** API base like /api/omnimart/pipeline or /api/omnimart/operations */
  apiBase?: string;
  /** Called after a successful partial save (Save Data). */
  onSaved?: () => void | Promise<void>;
  /** Called after Save & Next Stage succeeds. Falls back to onSaved when omitted. */
  onAdvanced?: () => void | Promise<void>;
  /** When true this is the final pipeline stage — hide "Save & Next Stage". */
  isLastStage?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Spinner — lightweight, no dependency
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={{
        animation: "spin 0.7s linear infinite",
        display: "inline-block",
        verticalAlign: "middle",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" strokeWidth="2" stroke="var(--rule-strong)" />
      <path
        d="M7 1.5A5.5 5.5 0 0 1 12.5 7"
        stroke="#f4efdf"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MultiSelect — inline, built from the tag-picker CSS classes in globals.css
// ─────────────────────────────────────────────────────────────────────────────

function MultiSelectField({
  id,
  label,
  options,
  value,
  onChange,
  required,
  animDelay,
}: {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  required: boolean;
  animDelay: number;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function toggle(v: string) {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  }

  const labelText = required ? `${label} *` : label;

  return (
    <div
      ref={wrapRef}
      style={{
        ...fieldRowStyle,
        animationDelay: `${animDelay}ms`,
        // Each row's reveal animation leaves a transform → its own stacking
        // context, which would trap the open dropdown beneath the next field.
        // Lift the whole row while open so the dropdown paints above siblings.
        position: "relative",
        zIndex: open ? 40 : undefined,
      }}
      className="stage-field-row"
    >
      <label
        htmlFor={id}
        style={labelStyle}
      >
        {labelText}
      </label>

      <div className="tag-picker-wrap">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="tag-picker-trigger"
          style={{ fontFamily: "var(--sans)" }}
        >
          {value.length === 0
            ? tr("Select options...")
            : `${value.length} selected`}
        </button>

        {open && (
          <div
            className="tag-picker-dropdown"
            role="listbox"
            aria-multiselectable="true"
          >
            {options.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={checked}
                  className="tag-picker-option"
                  onClick={() => toggle(opt.value)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <span>{opt.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="tag-list" style={{ marginTop: 8 }}>
          {value.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span key={v} className="tag-item">
                {opt?.label ?? v}
                <button
                  type="button"
                  className="tag-item-remove"
                  aria-label={`Remove ${opt?.label ?? v}`}
                  onClick={() => toggle(v)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BoolToggle
// ─────────────────────────────────────────────────────────────────────────────

function BoolToggle({
  id,
  label,
  value,
  onChange,
  required,
  animDelay,
}: {
  id: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  required: boolean;
  animDelay: number;
}) {
  const tr = useTr();
  const labelText = required ? `${label} *` : label;

  return (
    <div style={{ ...fieldRowStyle, animationDelay: `${animDelay}ms` }} className="stage-field-row">
      <label htmlFor={id} style={labelStyle}>
        {labelText}
      </label>
      <label
        htmlFor={id}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          padding: "9px 12px",
          background: "var(--surface-sunk)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "var(--rule)",
          borderRadius: "var(--r-sm)",
          width: "100%",
          userSelect: "none",
        }}
      >
        {/* Toggle track */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 36,
            height: 20,
            borderRadius: 999,
            background: value ? "var(--green-deep)" : "var(--rule-strong)",
            position: "relative",
            transition: "background 160ms cubic-bezier(0.23,1,0.32,1)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: value ? 19 : 3,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#f4efdf",
              transition: "left 160ms cubic-bezier(0.23,1,0.32,1)",
            }}
          />
        </span>
        <input
          id={id}
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        />
        <span style={{ fontSize: 13, color: "var(--ink)" }}>
          {value ? tr("Yes") : tr("No")}
        </span>
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FileFieldInput — real upload to Vercel Blob (private) via uploadPipelineFile.
// Stores the returned blob URL as the field value; views through the signed
// /api/uploads/view proxy. Click-to-pick or drag & drop.
// ─────────────────────────────────────────────────────────────────────────────

const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*";

function fileNameFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "file");
    return last.replace(/^\d+-/, ""); // strip the timestamp prefix uploadPipelineFile adds
  } catch {
    return "Attached file";
  }
}

function FileFieldInput({
  id,
  label,
  value,
  onChange,
  required,
  animDelay,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
  animDelay: number;
}) {
  const tr = useTr();
  const labelText = required ? `${label} *` : label;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const up = await uploadPipelineFile(file);
      onChange(up.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      style={{ ...fieldRowStyle, animationDelay: `${animDelay}ms`, gridColumn: "1 / -1", minWidth: 0, maxWidth: "100%" }}
      className="stage-field-row"
    >
      <label htmlFor={id} style={labelStyle}>
        {labelText}
      </label>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={FILE_ACCEPT}
        onChange={(e) => handleFiles(e.target.files)}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />

      {value ? (
        <div style={uploadedChipStyle}>
          <span aria-hidden="true" style={fileBadgeStyle}>{tr("FILE")}</span>
          <a
            href={`/api/uploads/view?url=${encodeURIComponent(value)}`}
            target="_blank"
            rel="noreferrer"
            title={fileNameFromUrl(value)}
            style={fileNameLinkStyle}
          >
            {fileNameFromUrl(value)}
          </a>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} style={fileGhostBtnStyle}>
            {uploading ? tr("Uploading…") : tr("Replace")}
          </button>
          <button type="button" onClick={() => onChange("")} aria-label={tr("Remove file")} style={fileGhostBtnStyle}>
            {tr("Remove")}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            disabled={uploading}
            aria-describedby={`${id}-note`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "9px 12px", textAlign: "center", fontSize: 13,
              background: dragOver ? "var(--green-wash)" : "var(--surface-sunk)",
              borderWidth: 1, borderStyle: "dashed", borderColor: dragOver ? "var(--green-deep)" : "var(--rule-strong)",
              borderRadius: "var(--r-sm)", cursor: uploading ? "wait" : "pointer", color: "var(--ink-soft)",
              fontFamily: "var(--sans)", transition: "background 160ms ease-out, border-color 160ms ease-out",
            }}
          >
            {uploading ? (
              <><Spinner /><span>{tr("Uploading…")}</span></>
            ) : (
              <>
                <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>↥</span>
                <span style={{ fontWeight: 500, color: "var(--ink)" }}>{tr("Click to upload or drag & drop")}</span>
              </>
            )}
          </button>
          <p id={`${id}-note`} style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>
            {tr("PDF, Word, Excel, CSV or image · up to 50 MB")}
          </p>
        </>
      )}

      {error && <p style={{ fontSize: 11, color: "var(--crit)", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

const uploadedChipStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden",
  flexWrap: "wrap",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
};
const fileBadgeStyle: CSSProperties = {
  flex: "0 0 auto", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em",
  padding: "3px 6px", borderRadius: 4, background: "var(--green-wash)", color: "var(--green-deep)",
};
const fileNameLinkStyle: CSSProperties = {
  flex: "1 1 120px",
  minWidth: 0,
  maxWidth: "100%",
  fontSize: 13,
  color: "var(--ink)",
  textDecorationLine: "underline",
  textDecorationColor: "var(--rule-strong)",
  textUnderlineOffset: 3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const fileGhostBtnStyle: CSSProperties = {
  flex: "0 0 auto", padding: "4px 10px", fontSize: 11, fontWeight: 500, fontFamily: "var(--sans)",
  background: "var(--surface)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  color: "var(--ink-soft)", cursor: "pointer",
};

// ─────────────────────────────────────────────────────────────────────────────
// ImageFieldInput — image-only upload with thumbnail previews. Single mode
// (field_type "image") keeps one image and replaces on re-pick; multiple mode
// (field_type "images") accumulates a gallery. Always works on a string[] of
// blob URLs; the parent maps single mode to a scalar. Views go through the
// signed /api/uploads/view proxy (blobs are private).
// ─────────────────────────────────────────────────────────────────────────────

function imageViewUrl(url: string): string {
  return `/api/uploads/view?url=${encodeURIComponent(url)}`;
}

function ImageFieldInput({
  id,
  label,
  multiple,
  urls,
  onChange,
  required,
  animDelay,
}: {
  id: string;
  label: string;
  multiple: boolean;
  urls: PipelineImageEntry[];
  onChange: (entries: PipelineImageEntry[]) => void;
  required: boolean;
  animDelay: number;
}) {
  const tr = useTr();
  const labelText = required ? `${label} *` : label;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    // Snapshot before any await — resetting input.value later would empty a
    // live FileList mid-upload (see failures/2026-06-19-filelist-cleared-before-upload).
    const picked = files ? Array.from(files) : [];
    if (picked.length === 0) return;
    const images = picked.filter((f) => f.type.startsWith("image/"));
    const toUpload = multiple ? images : images.slice(0, 1);
    if (toUpload.length === 0) {
      setError("Only image files can be uploaded.");
      return;
    }
    const skipped = picked.length - images.length;
    setError(skipped > 0 ? `${skipped} non-image file${skipped === 1 ? "" : "s"} skipped.` : "");
    setUploading(true);
    try {
      // Upload concurrently — wall-clock is the slowest single file, not the sum.
      const results = await Promise.all(toUpload.map((f) => uploadPipelineFile(f)));
      const uploaded: PipelineImageEntry[] = results.map((r) => ({
        url: r.url,
        size: r.size,
        type: r.type,
      }));
      onChange(multiple ? [...urls, ...uploaded] : [uploaded[0]]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(idx: number) {
    onChange(urls.filter((_, i) => i !== idx));
  }
  const showPicker = multiple || urls.length === 0;

  return (
    <div
      style={{ ...fieldRowStyle, animationDelay: `${animDelay}ms`, gridColumn: "1 / -1", minWidth: 0, maxWidth: "100%" }}
      className="stage-field-row"
    >
      <label htmlFor={id} style={labelStyle}>{labelText}</label>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />

      {urls.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginBottom: showPicker ? 8 : 0 }}>
          {urls.map((entry, i) => (
            <div key={`${entry.url}-${i}`} style={{ position: "relative", borderRadius: "var(--r-sm)", overflow: "hidden", border: "1px solid var(--rule)", background: "var(--surface-sunk)" }}>
              <button
                type="button"
                onClick={() => setLightbox({ src: imageViewUrl(entry.url), alt: `${label} ${i + 1}` })}
                title={`View ${label} ${i + 1}`}
                style={{ display: "block", width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageViewUrl(entry.url)} alt={`${label} ${i + 1}`} style={{ display: "block", width: "100%", height: 80, objectFit: "cover" }} />
              </button>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove image ${i + 1}`}
                style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
              {!multiple && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  style={{ ...fileGhostBtnStyle, position: "absolute", bottom: 4, left: 4, padding: "2px 8px" }}
                >
                  {uploading ? "…" : tr("Replace")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            disabled={uploading}
            aria-describedby={`${id}-note`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "9px 12px", textAlign: "center", fontSize: 13,
              background: dragOver ? "var(--green-wash)" : "var(--surface-sunk)",
              borderWidth: 1, borderStyle: "dashed", borderColor: dragOver ? "var(--green-deep)" : "var(--rule-strong)",
              borderRadius: "var(--r-sm)", cursor: uploading ? "wait" : "pointer", color: "var(--ink-soft)",
              fontFamily: "var(--sans)", transition: "background 160ms ease-out, border-color 160ms ease-out",
            }}
          >
            {uploading ? (
              <><Spinner /><span>{tr("Uploading…")}</span></>
            ) : (
              <>
                <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>↥</span>
                <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                  {multiple ? tr("Click to upload images or drag & drop") : tr("Click to upload an image or drag & drop")}
                </span>
              </>
            )}
          </button>
          <p id={`${id}-note`} style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>
            {multiple ? tr("JPG, PNG, WebP or GIF · select several · up to 50 MB each") : tr("JPG, PNG, WebP or GIF · up to 50 MB")}
          </p>
        </>
      )}

      {error && <p style={{ fontSize: 11, color: "var(--crit)", marginTop: 4 }}>{error}</p>}

      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StageFieldsForm — the main export
// ─────────────────────────────────────────────────────────────────────────────

export function StageFieldsForm({ leadId, stage, apiBase = "/api/omnimart/pipeline", onSaved, onAdvanced, isLastStage }: StageFieldsFormProps) {
  const tr = useTr();
  const [fields, setFields] = useState<StageField[]>([]);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch fields + current data ──────────────────────────────────────────

  const fetchStageData = useCallback(() => {
    setLoadState("loading");
    setSaveError("");
    setSaveSuccess(false);

    fetch(`${apiBase}/${leadId}/stage-data?stage=${encodeURIComponent(stage)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<{ fields: StageField[]; data: StageDataRow | null }>;
      })
      .then(({ fields: flds, data }) => {
        const sorted = [...flds].sort((a, b) => a.sort_order - b.sort_order);
        setFields(sorted);

        // Pre-fill from saved values; default missing to empty.
        const initial: Record<string, FieldValue> = {};
        for (const f of sorted) {
          const saved = data?.values[f.field_slug];
          if (saved !== undefined && saved !== null) {
            if (f.field_type === "multiselect") {
              initial[f.field_slug] = Array.isArray(saved) ? (saved as string[]) : [];
            } else if (f.field_type === "image" || f.field_type === "images") {
              initial[f.field_slug] = imageEntriesFromValue(saved);
            } else if (f.field_type === "bool") {
              initial[f.field_slug] = Boolean(saved);
            } else if (f.field_type === "number") {
              initial[f.field_slug] = String(saved);
            } else {
              initial[f.field_slug] = String(saved);
            }
          } else {
            // Default empty by type
            if (f.field_type === "multiselect" || f.field_type === "image" || f.field_type === "images") initial[f.field_slug] = [];
            else if (f.field_type === "bool") initial[f.field_slug] = false;
            else initial[f.field_slug] = "";
          }
        }
        setValues(initial);
        setLoadState("ready");
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        setLoadState("error");
      });
  }, [leadId, stage, apiBase]);

  useEffect(() => {
    fetchStageData();
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [fetchStageData]);

  // ── Field change helpers ──────────────────────────────────────────────────

  function setField(slug: string, v: FieldValue) {
    setSaveError("");
    setSaveSuccess(false);
    setValues((prev) => ({ ...prev, [slug]: v }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const isEmptyValue = (v: FieldValue) =>
    v === "" || v === null || v === undefined || (Array.isArray(v) && v.length === 0);

  // Build the values payload — omit empty strings for optional fields; always
  // include required fields so the server can gate on them.
  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.field_slug];
      if (f.field_type === "images") {
        const entries = Array.isArray(v) ? (v as PipelineImageEntry[]) : [];
        const saved = imageValuesForSave(entries);
        if (saved.length > 0 || f.is_required) payload[f.field_slug] = saved;
        continue;
      }
      if (f.field_type === "image") {
        const entries = Array.isArray(v) ? (v as PipelineImageEntry[]) : imageEntriesFromValue(v);
        const saved = entries.length > 0 ? imageValuesForSave(entries)[0] : null;
        if ((saved != null && saved !== "") || f.is_required) payload[f.field_slug] = saved;
        continue;
      }
      if (!isEmptyValue(v) || f.is_required) payload[f.field_slug] = v ?? null;
    }
    return payload;
  }

  async function persist(): Promise<boolean> {
    const res = await fetch(`${apiBase}/${leadId}/stage-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, values: buildPayload() }),
      cache: "no-store",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSaveError(j.error ?? `Save failed (HTTP ${res.status})`);
      return false;
    }
    return true;
  }

  // Partial save — no required-field gate (data may still be pending).
  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      if (!(await persist())) return;
      setSaveSuccess(true);
      successTimer.current = setTimeout(() => setSaveSuccess(false), 3000);
      await onSaved?.();
    } catch {
      setSaveError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Save + advance — requires ALL configured fields filled (client guard; the
  // server's advanceStage also asserts stage completion).
  async function handleSaveAndNext() {
    setSaveError("");
    setSaveSuccess(false);
    const missing = fields.filter((f) => f.is_required && isEmptyValue(values[f.field_slug]));
    if (missing.length > 0) {
      setSaveError(`Fill all required fields before moving on: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    setAdvancing(true);
    try {
      if (!(await persist())) return;
      const adv = await fetch(`${apiBase}/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "advance" }),
        cache: "no-store",
      });
      if (!adv.ok) {
        const j = await adv.json().catch(() => ({}));
        setSaveError(j.error ?? `Could not advance stage (HTTP ${adv.status})`);
        return;
      }
      if (onAdvanced) await onAdvanced();
      else await onSaved?.();
    } catch {
      setSaveError("Network error — please try again.");
    } finally {
      setAdvancing(false);
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (loadState === "loading" || loadState === "idle") {
    return (
      <div style={skeletonWrapStyle} aria-busy="true" aria-label={tr("Loading stage fields")}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...skeletonBarStyle, width: i === 0 ? "60%" : i === 1 ? "80%" : "70%", animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div style={{ fontSize: 13, color: "var(--crit)", padding: "8px 0" }}>
        {tr("Failed to load stage fields:")} {loadError}
        <button
          onClick={fetchStageData}
          style={retryBtnStyle}
        >
          {tr("Retry")}
        </button>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>
        {tr("No configured fields for this stage.")}
      </p>
    );
  }

  return (
    <PermissionGate
      permission="pipeline.update"
      fallback={<ReadonlyStageView fields={fields} values={values} />}
    >
      <>
        {/* Staggered field entrance */}
        <style>{staggeredRevealCss}</style>

        <div
          className="stage-fields-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: "20px 24px",
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
          }}
          role="form"
          aria-label={`Stage fields for ${stage}`}
        >
          {fields.map((field, idx) => {
            const delay = idx * 45; // 45ms stagger, Emil spec 30-60ms
            const fieldId = `sf-${field.field_slug}`;
            const fieldVal = values[field.field_slug];

            switch (field.field_type) {
              case "text":
                return (
                  <TextOrNumberField
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    inputType="text"
                    value={String(fieldVal ?? "")}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                    pattern={field.validation.regex}
                  />
                );

              case "number":
                return (
                  <TextOrNumberField
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    inputType="number"
                    value={String(fieldVal ?? "")}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                    min={field.validation.min}
                    max={field.validation.max}
                  />
                );

              case "date":
                return (
                  <DateField
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    value={String(fieldVal ?? "")}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                  />
                );

              case "phone":
              case "email":
              case "url":
                return (
                  <TextOrNumberField
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    inputType={field.field_type === "phone" ? "tel" : field.field_type}
                    value={String(fieldVal ?? "")}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                    placeholder={field.field_type === "email" ? "name@example.com" : field.field_type === "url" ? "https://…" : "Phone number"}
                  />
                );

              case "currency":
                return (
                  <TextOrNumberField
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    inputType="number"
                    value={String(fieldVal ?? "")}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                    min={0}
                    placeholder={tr("₹ amount")}
                  />
                );

              case "bool":
                return (
                  <BoolToggle
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    value={Boolean(fieldVal)}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                  />
                );

              case "select":
                return (
                  <SelectField
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    options={field.validation.options ?? []}
                    value={String(fieldVal ?? "")}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                  />
                );

              case "multiselect":
                return (
                  <MultiSelectField
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    options={field.validation.options ?? []}
                    value={Array.isArray(fieldVal) ? (fieldVal as string[]) : []}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                  />
                );

              case "master_ref":
                return (
                  <MasterRefField
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    masterTable={field.master_table}
                    apiBase={apiBase}
                    value={String(fieldVal ?? "")}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                  />
                );

              case "file":
                return (
                  <FileFieldInput
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    value={String(fieldVal ?? "")}
                    onChange={(v) => setField(field.field_slug, v)}
                    required={field.is_required}
                    animDelay={delay}
                  />
                );

              case "image": {
                const imageEntries = Array.isArray(fieldVal)
                  ? (fieldVal as PipelineImageEntry[])
                  : imageEntriesFromValue(fieldVal);
                return (
                  <ImageFieldInput
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    multiple={false}
                    urls={imageEntries}
                    onChange={(entries) => setField(field.field_slug, entries)}
                    required={field.is_required}
                    animDelay={delay}
                  />
                );
              }

              case "images":
                return (
                  <ImageFieldInput
                    key={field.id}
                    id={fieldId}
                    label={field.label}
                    multiple
                    urls={Array.isArray(fieldVal) ? (fieldVal as PipelineImageEntry[]) : []}
                    onChange={(entries) => setField(field.field_slug, entries)}
                    required={field.is_required}
                    animDelay={delay}
                  />
                );

              default:
                return null;
            }
          })}
        </div>

        {/* Error / success feedback */}
        {saveError && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: "8px 12px",
              background: "var(--crit-wash)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "var(--crit)",
              borderRadius: "var(--r-sm)",
              fontSize: 13,
              color: "var(--crit)",
            }}
          >
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div
            role="status"
            style={{
              marginTop: 16,
              padding: "8px 12px",
              background: "var(--ok-wash)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "var(--ok)",
              borderRadius: "var(--r-sm)",
              fontSize: 13,
              color: "var(--ok)",
              transition: "opacity 300ms ease-out",
            }}
          >
            {tr("Stage data saved.")}
          </div>
        )}

        {/* Actions: partial Save, and (unless last stage) Save + advance */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || advancing}
            aria-busy={saving}
            className="sf-save-btn"
            style={secondarySaveBtnStyle(saving || advancing)}
          >
            {saving ? (
              <>
                <Spinner />
                <span style={{ marginLeft: 6 }}>{tr("Saving...")}</span>
              </>
            ) : (
              tr("Save Data")
            )}
          </button>
          {!isLastStage && (
            <button
              type="button"
              onClick={handleSaveAndNext}
              disabled={saving || advancing}
              aria-busy={advancing}
              className="sf-save-btn"
              style={saveBtnStyle(saving || advancing)}
            >
              {advancing ? (
                <>
                  <Spinner />
                  <span style={{ marginLeft: 6 }}>{tr("Moving on...")}</span>
                </>
              ) : (
                tr("Save & Next Stage")
              )}
            </button>
          )}
        </div>
      </>
    </PermissionGate>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReadonlyStageView — shown when user lacks pipeline.update
// ─────────────────────────────────────────────────────────────────────────────

function ReadonlyStageView({
  fields,
  values,
}: {
  fields: StageField[];
  values: Record<string, FieldValue>;
}) {
  const tr = useTr();
  if (fields.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
        {tr("No configured fields for this stage.")}
      </p>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px 24px" }}>
      {fields.map((f) => {
        const v = values[f.field_slug];
        let display = "—";
        if (v !== null && v !== undefined && v !== "") {
          if (Array.isArray(v)) display = v.join(", ") || "—";
          else if (typeof v === "boolean") display = v ? "Yes" : "No";
          else display = String(v);
        }
        return (
          <div key={f.id}>
            <div style={labelStyle}>{f.label}</div>
            <div style={{ fontSize: 14, color: "var(--ink)", wordBreak: "break-word" }}>{display}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TextOrNumberField
// ─────────────────────────────────────────────────────────────────────────────

function TextOrNumberField({
  id,
  label,
  inputType,
  value,
  onChange,
  required,
  animDelay,
  min,
  max,
  pattern,
  placeholder,
  note,
}: {
  id: string;
  label: string;
  inputType: string;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
  animDelay: number;
  min?: number;
  max?: number;
  pattern?: string;
  placeholder?: string;
  note?: string;
}) {
  const labelText = required ? `${label} *` : label;

  return (
    <div
      style={{ ...fieldRowStyle, animationDelay: `${animDelay}ms` }}
      className="stage-field-row"
    >
      <label htmlFor={id} style={labelStyle}>
        {labelText}
      </label>
      <input
        id={id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        max={max}
        pattern={pattern}
        placeholder={placeholder}
        className="form-input"
        style={{ fontFamily: "var(--sans)" }}
      />
      {note && (
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-faint)",
            marginTop: 4,
            fontFamily: "var(--mono)",
            letterSpacing: "0.04em",
          }}
        >
          {note}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DateField — OmniDel DatePicker (same calendar as pipeline / tasks), not the
// browser-native white date popup that `<input type="date">` opens.
// ─────────────────────────────────────────────────────────────────────────────

function DateField({
  id,
  label,
  value,
  onChange,
  required,
  animDelay,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
  animDelay: number;
}) {
  const tr = useTr();
  const labelText = required ? `${label} *` : label;

  return (
    <div
      style={{ ...fieldRowStyle, animationDelay: `${animDelay}ms` }}
      className="stage-field-row"
    >
      <div id={id} style={labelStyle} aria-hidden="true">
        {labelText}
      </div>
      <div aria-labelledby={id}>
        <DatePicker
          value={value}
          onChange={onChange}
          placeholder="dd-mm-yyyy"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MasterRefField — dropdown over the referenced master table.
//
// Replaces the old "paste a UUID from gunakul.mst_users" text input. Options
// come from `<apiBase>/master-ref-options?table=<master_table>`, which decides
// server-side which rows are eligible (for the ops-owner field: members of the
// Sales and Operations teams). The stored value is still the row id, so nothing
// about saving or validation changes.
// ─────────────────────────────────────────────────────────────────────────────

function MasterRefField({
  id,
  label,
  masterTable,
  apiBase,
  value,
  onChange,
  required,
  animDelay,
}: {
  id: string;
  label: string;
  masterTable: string | null;
  apiBase: string;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
  animDelay: number;
}) {
  const tr = useTr();
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const labelText = required ? `${label} *` : label;

  useEffect(() => {
    if (!masterTable) {
      setState("ready");
      return;
    }
    let cancelled = false;
    setState("loading");
    fetch(`${apiBase}/master-ref-options?table=${encodeURIComponent(masterTable)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ items: Array<{ value: string; label: string }> }>;
      })
      .then((d) => {
        if (cancelled) return;
        setOptions(d.items || []);
        setState("ready");
      })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [apiBase, masterTable]);

  // A value saved before this field became a dropdown (or a row that has since
  // left the eligible set) would otherwise render as a blank trigger — keep it
  // visible and selected rather than silently dropping it on the next save.
  const shownOptions = value && !options.some((o) => o.value === value)
    ? [{ value, label: `${value.slice(0, 8)}… (not in the current list)` }, ...options]
    : options;

  return (
    <div style={{ ...fieldRowStyle, animationDelay: `${animDelay}ms` }} className="stage-field-row">
      <div id={id} style={labelStyle} aria-hidden="true">{labelText}</div>
      <div aria-labelledby={id}>
        <CustomSelect
          value={value}
          onChange={onChange}
          options={shownOptions}
          allowDeselect={!required}
          placeholder={
            state === "loading" ? "Loading…"
              : state === "error" ? "Could not load options"
              : shownOptions.length === 0 ? "No one available"
              : "Select..."
          }
        />
      </div>
      {state === "error" && (
        <p style={{ fontSize: 11, color: "var(--crit)", marginTop: 4 }}>
          {tr("Couldn't load the list. Reopen this form to try again.")}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectField — wraps CustomSelect, adds label + animation
// ─────────────────────────────────────────────────────────────────────────────

function SelectField({
  id,
  label,
  options,
  value,
  onChange,
  required,
  animDelay,
}: {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
  animDelay: number;
}) {
  const tr = useTr();
  const labelText = required ? `${label} *` : label;

  return (
    <div
      style={{ ...fieldRowStyle, animationDelay: `${animDelay}ms` }}
      className="stage-field-row"
    >
      {/* CustomSelect doesn't accept an id prop for the label association;
          we fall back to wrapping with aria-label on the trigger. */}
      <div id={id} style={labelStyle} aria-hidden="true">
        {labelText}
      </div>
      <div aria-labelledby={id}>
        <CustomSelect
          value={value}
          onChange={onChange}
          options={options}
          placeholder={tr("Select...")}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Style constants (Emil polish — inline style objects, CSS variable tokens)
// ─────────────────────────────────────────────────────────────────────────────

const labelStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  marginBottom: 6,
};

// Each field row fades + lifts in on page load (Emil staggered reveal)
// Fallback: animation-delay. @starting-style not used — broad compat.
const fieldRowStyle: CSSProperties = {
  animationName: "sfReveal",
  animationDuration: "220ms",
  animationTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
  animationFillMode: "both",
};

const skeletonWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "4px 0",
};

const skeletonBarStyle: CSSProperties = {
  height: 14,
  borderRadius: "var(--r-sm)",
  background: "var(--surface-sunk)",
  animationName: "pulse-shimmer",
  animationDuration: "1.4s",
  animationTimingFunction: "linear",
  animationIterationCount: "infinite",
  animationFillMode: "both",
};

const retryBtnStyle: CSSProperties = {
  marginLeft: 12,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 500,
  background: "var(--surface)",
  color: "var(--ink-soft)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};

function saveBtnStyle(saving: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "9px 20px",
    fontSize: 13,
    fontWeight: 500,
    background: "var(--green-deep)",
    color: "#f4efdf",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--green-deep)",
    borderRadius: "var(--r-sm)",
    cursor: saving ? "not-allowed" : "pointer",
    fontFamily: "var(--sans)",
    opacity: saving ? 0.7 : 1,
    // Emil polish: transform on :active via CSS class below; touch devices skip
    transition: "opacity 160ms ease-out, transform 160ms cubic-bezier(0.23,1,0.32,1)",
    outline: "none",
  };
}

function secondarySaveBtnStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "9px 20px",
    fontSize: 13,
    fontWeight: 500,
    background: "var(--surface)",
    color: "var(--ink-soft)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--rule-strong)",
    borderRadius: "var(--r-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--sans)",
    opacity: disabled ? 0.7 : 1,
    transition: "opacity 160ms ease-out, transform 160ms cubic-bezier(0.23,1,0.32,1)",
    outline: "none",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Injected CSS — stagger keyframe + save-button press + focus ring
// Emil: animate only transform/opacity; respect prefers-reduced-motion
// ─────────────────────────────────────────────────────────────────────────────

const staggeredRevealCss = `
@keyframes sfReveal {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.stage-field-row {
  min-width: 0;
  max-width: 100%;
}
@media (max-width: 767px) {
  .stage-fields-grid {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 16px !important;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stage-field-row { animation: none !important; opacity: 1 !important; }
  .sf-save-btn:active { transform: none !important; }
}
@media (hover: hover) and (pointer: fine) {
  .sf-save-btn:active { transform: scale(0.97); }
}
.sf-save-btn:focus-visible {
  outline: 2px solid var(--green-deep);
  outline-offset: 2px;
}
.form-input:focus-visible {
  outline: none;
  border-color: var(--green-deep);
  box-shadow: 0 0 0 2px var(--green-wash);
}
`;
