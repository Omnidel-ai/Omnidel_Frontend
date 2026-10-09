"use client";

import { type CSSProperties } from "react";
import { useTr } from "@/lib/client/language";

// Step — free-form paste. The user pastes arbitrary text (notes, a task
// list, anything) and hits Continue, which sends the text to the AI
// extraction endpoint (POST .../import-extract) and lands on the editable
// grid step (Task 9).
export function StepPaste({
  pasteText,
  onChangeText,
  extracting,
  extractError,
}: {
  pasteText: string;
  onChangeText: (value: string) => void;
  extracting: boolean;
  extractError: string;
}) {
  const tr = useTr();
  return (
    <div>
      <p style={subtitleStyle}>
        {tr("Paste anything — notes, a task list, an email thread. AI will pull out the tasks for you on the next step.")}
      </p>
      <textarea
        value={pasteText}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder={tr("Paste your text here…")}
        rows={10}
        className="form-textarea"
        style={textareaStyle}
        aria-label={tr("Paste text to extract tasks from")}
        disabled={extracting}
      />
      {extracting && (
        <div style={statusStyle}>{tr("AI is reading your text and pulling out tasks…")}</div>
      )}
      {extractError && !extracting && <div style={errorStyle}>{extractError}</div>}
    </div>
  );
}

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
  lineHeight: 1.5,
  marginBottom: 16,
};
const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 200,
  resize: "vertical",
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.5,
};
const statusStyle: CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  color: "var(--ink-soft)",
};
const errorStyle: CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  color: "var(--crit)",
  padding: "8px 12px",
  background: "var(--crit-wash, var(--surface-sunk))",
  borderRadius: "var(--r-sm)",
};
