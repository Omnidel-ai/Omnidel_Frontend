"use client";

import { type CSSProperties } from "react";
import { useTr } from "@/lib/client/language";

// Step 0 — path choice. Three cards:
//   1. Download template & fill  — goes to the upload step, where a
//      "Download template" button (below the drop area) fetches a board-seeded
//      template on demand. The download no longer auto-fires on card click.
//   2. Custom template  — bring your own spreadsheet as-is; goes straight to
//      the upload step, where analyzeAndAdvance routes any non-template file
//      through the AI column-inference path (extractTasksFromRecords).
//   3. Paste anything / AI will format it — advances to the free-form paste
//      step (AI extraction wired in a later task).
export function StepChoose({
  onChooseTemplate,
  onChooseUpload,
  onChoosePaste,
}: {
  onChooseTemplate: () => void;
  onChooseUpload: () => void;
  onChoosePaste: () => void;
}) {
  const tr = useTr();
  return (
    <div>
      <p style={subtitleStyle}>{tr("Choose how you’d like to bring in your tasks.")}</p>

      <div style={cardsWrapStyle}>
        <button
          type="button"
          className="btn-secondary"
          style={choiceCardStyle}
          onClick={onChooseTemplate}
        >
          <ChoiceIcon>
            <path d="M12 3v12" />
            <polyline points="7 10 12 15 17 10" />
            <path d="M4 19h16" />
          </ChoiceIcon>
          <div style={choiceTitleStyle}>{tr("Download template & fill")}</div>
          <div style={choiceSubStyle}>
            {tr("Get an Excel template with dropdowns for this board’s columns, statuses, labels, members, task types, and more — download it on the next step, fill it in, and upload it back.")}
          </div>
        </button>

        <button
          type="button"
          className="btn-secondary"
          style={choiceCardStyle}
          onClick={onChooseUpload}
        >
          <ChoiceIcon>
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0Z" />
            <path d="M20 3v4" />
            <path d="M22 5h-4" />
            <path d="M4 17v2" />
            <path d="M5 18H3" />
          </ChoiceIcon>
          <div style={choiceTitleStyle}>{tr("Custom template")}</div>
          <div style={choiceSubStyle}>
            {tr("Already have your own spreadsheet? Upload it as-is — AI reads your columns and maps them to this board automatically.")}
          </div>
        </button>

        <button
          type="button"
          className="btn-secondary"
          style={choiceCardStyle}
          onClick={onChoosePaste}
        >
          <ChoiceIcon>
            <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z" />
            <path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
            <line x1="8" y1="11" x2="16" y2="11" />
            <line x1="8" y1="15" x2="13" y2="15" />
          </ChoiceIcon>
          <div style={choiceTitleStyle}>{tr("Paste anything")}</div>
          <div style={choiceSubStyle}>
            {tr("Paste notes, a task list, or any text — AI will format it into tasks for you.")}
          </div>
        </button>
      </div>
    </div>
  );
}

function ChoiceIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--green-deep)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
  lineHeight: 1.5,
  marginBottom: 18,
};
const cardsWrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};
const choiceCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 6,
  textAlign: "left",
  padding: "16px 14px",
  borderRadius: "var(--r-md)",
  height: "100%",
  cursor: "pointer",
};
const choiceTitleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 15,
  color: "var(--ink)",
  marginTop: 4,
};
const choiceSubStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--ink-soft)",
  lineHeight: 1.5,
};
