"use client";

import { type CSSProperties } from "react";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { BOARD_FIELD_OPTIONS, type BoardField, type ColumnMapping } from "./types";
import { useTr } from "@/lib/client/language";

// Step 2 — AI mapping preview + editable table. Each CSV column is shown with a
// dropdown to (re)assign its board field. A loading state covers the AI call.
export function StepMapping({
  analyzing,
  headers,
  mapping,
  duplicateFields,
  boardName,
  importableCount,
  onChangeField,
}: {
  analyzing: boolean;
  headers: string[];
  mapping: ColumnMapping;
  duplicateFields: BoardField[];
  boardName: string;
  importableCount: number;
  onChangeField: (header: string, field: BoardField) => void;
}) {
  const tr = useTr();
  if (analyzing) {
    return (
      <div style={loadingWrapStyle}>
        <div style={spinnerStyle} aria-hidden="true" />
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{tr("Analyzing your CSV…")}</div>
      </div>
    );
  }

  const fieldLabel = (f: BoardField) =>
    BOARD_FIELD_OPTIONS.find((o) => o.value === f)?.label ?? f;

  return (
    <div>
      <p style={subtitleStyle}>
        {tr("Review how each column maps to a board field. Change anything that looks wrong before importing.")}
      </p>

      <div style={tableHeadStyle}>
        <span>{tr("Your column")}</span>
        <span />
        <span>{tr("Board field")}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {headers.map((h) => (
          <div key={h} style={rowStyle}>
            <span style={colNameStyle} title={h}>
              {h}
            </span>
            <span style={{ color: "var(--ink-mute)", textAlign: "center" }}>→</span>
            <div>
              <CustomSelect
                value={mapping[h] ?? "skip"}
                onChange={(v) => onChangeField(h, v as BoardField)}
                options={BOARD_FIELD_OPTIONS}
              />
            </div>
          </div>
        ))}
      </div>

      {duplicateFields.length > 0 && (
        <div style={warnStyle}>
          {duplicateFields.map((f) => (
            <div key={f}>
              {fieldLabel(f)} {tr("is mapped to more than one column. Only the last value will be used.")}
            </div>
          ))}
        </div>
      )}

      <div style={countNoteStyle}>
        {tr("Found")} {importableCount} task{importableCount === 1 ? "" : "s"} for{" "}
        <strong style={{ color: "var(--ink)" }}>{boardName}</strong> {tr("— you’ll review them next")}
      </div>
    </div>
  );
}

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
  lineHeight: 1.5,
  marginBottom: 16,
};
const tableHeadStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 28px 1fr",
  gap: 10,
  alignItems: "center",
  padding: "0 0 8px",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  borderBottom: "1px solid var(--rule)",
};
const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 28px 1fr",
  gap: 10,
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid var(--rule)",
};
const colNameStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink)",
  fontFamily: "var(--sans)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const warnStyle: CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  color: "var(--ochre)",
  background: "var(--ochre-wash)",
  padding: "8px 12px",
  borderRadius: "var(--r-sm)",
  display: "grid",
  gap: 4,
};
const countNoteStyle: CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  color: "var(--ink-soft)",
};
const loadingWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  padding: "48px 20px",
};
const spinnerStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "3px solid var(--rule)",
  borderTopColor: "var(--green-deep)",
  animation: "spin 0.8s linear infinite",
};
