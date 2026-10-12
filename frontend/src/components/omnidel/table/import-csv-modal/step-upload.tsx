"use client";

import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import type { DetectedMetadata } from "@/lib/omnipulse/csv-structure";
import { useTr } from "@/lib/client/language";

// Step 1 — file picker. Drag-and-drop zone plus a plain file input fallback
// (the hidden <input> is the accessible path; the zone is a convenience).
//
// `detectedMetadata` is optional (defaults to none shown) so this component
// keeps working for any caller that hasn't wired the prop through yet — the
// hook (use-csv-import.ts) already exposes `detectedMetadata` in its state.
export function StepUpload({
  fileName,
  rowCount,
  uploadError,
  onSelectFile,
  detectedMetadata = [],
  onDownloadTemplate,
  downloadingTemplate,
  downloadError,
}: {
  fileName: string | null;
  rowCount: number;
  uploadError: string;
  onSelectFile: (file: File) => void;
  detectedMetadata?: DetectedMetadata[];
  onDownloadTemplate: () => void;
  downloadingTemplate: boolean;
  downloadError: string;
}) {
  const tr = useTr();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onSelectFile(f);
  }

  return (
    <div>
      <p style={subtitleStyle}>
        {tr("Import tasks from any CSV or Excel (.xlsx) file — including the filled-in template. AI will automatically detect your columns.")}
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          ...dropZoneStyle,
          borderColor: dragging ? "var(--green-deep)" : "var(--rule-strong)",
          background: dragging ? "var(--surface-sunk)" : "var(--page)",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-mute)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 10 }}>
          {tr("Drag & drop a .csv or .xlsx file here")}
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 12 }}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          {tr("Browse file")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelectFile(f);
            // Reset so re-selecting the same file still fires onChange.
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
      </div>

      {/* Download the board-seeded template on demand (no longer auto-fired
          from the path-choice step). Sits directly under the drop area. */}
      <div style={templateRowStyle}>
        <span style={templateHintStyle}>{tr("Don’t have the board template yet?")}</span>
        <button
          type="button"
          className="btn-secondary"
          style={templateBtnStyle}
          disabled={downloadingTemplate}
          onClick={onDownloadTemplate}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <polyline points="7 10 12 15 17 10" />
            <path d="M4 19h16" />
          </svg>
          {downloadingTemplate ? tr("Downloading…") : tr("Download template")}
        </button>
      </div>

      {downloadError && <div style={errorStyle}>{downloadError}</div>}

      {fileName && !uploadError && (
        <div style={fileInfoStyle}>
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{fileName}</span>
          <span style={{ color: "var(--ink-mute)" }}>
            {" "}
            — {rowCount} row{rowCount === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {uploadError && <div style={errorStyle}>{uploadError}</div>}

      {!uploadError && detectedMetadata.length > 0 && (
        <div style={metadataWrapStyle}>
          <div style={metadataCaptionStyle}>
            {tr("Detected from the file — applied as suggested defaults:")}
          </div>
          <div style={metadataChipsStyle}>
            {detectedMetadata.map((m, i) => (
              <span key={`${m.label}-${i}`} style={metadataChipStyle}>
                <span style={{ fontWeight: 600 }}>{m.label}</span>
                {m.value && <>: {m.value}</>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
  lineHeight: 1.5,
  marginBottom: 18,
};
const dropZoneStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "32px 20px",
  borderWidth: 2,
  borderStyle: "dashed",
  borderRadius: "var(--r-md)",
  cursor: "pointer",
  transition: "border-color .14s ease, background .14s ease",
};
const templateRowStyle: CSSProperties = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
};
const templateHintStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--ink-mute)",
};
const templateBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12,
};
const fileInfoStyle: CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  background: "var(--surface-sunk)",
  borderRadius: "var(--r-sm)",
};
const errorStyle: CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  color: "var(--crit)",
  padding: "8px 12px",
  background: "var(--crit-wash, var(--surface-sunk))",
  borderRadius: "var(--r-sm)",
};
const metadataWrapStyle: CSSProperties = {
  marginTop: 14,
};
const metadataCaptionStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--ink-mute)",
  marginBottom: 8,
};
const metadataChipsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};
const metadataChipStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--ink)",
  padding: "5px 10px",
  background: "var(--surface-sunk)",
  borderRadius: "var(--r-full, 999px)",
};
