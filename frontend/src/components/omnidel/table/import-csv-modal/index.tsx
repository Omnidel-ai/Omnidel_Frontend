"use client";

import { useEffect, type CSSProperties } from "react";
import { useCSVImport } from "./use-csv-import";
import { StepChoose } from "./step-choose";
import { StepPaste } from "./step-paste";
import { StepUpload } from "./step-upload";
import { StepMapping } from "./step-mapping";
import { StepConfirmLists } from "./step-confirm-lists";
import { PreviewGrid } from "./preview-grid";
import { StepResult } from "./step-result";
import type { ImportList, ImportUser } from "./types";
import { useTr } from "@/lib/client/language";

// ============================================================================
// ImportCSVModal — wizard for importing tasks from a CSV into a board.
//   0. Choose  — pick a path: download a board-seeded template, or paste
//      free-form text for AI to format (see step-choose.tsx)
//   1. Upload  — pick / drop a .csv file (parsed + validated client-side).
//      Template headers (from Task 4's download) skip straight to the
//      editable grid; any other CSV falls back to the legacy AI-mapping flow.
//   1b. Paste  — free-form textarea → POST .../import-extract (AI) → grid
//   1c. Grid   — editable preview (PreviewGrid) backed by board masters;
//      "Insert" POSTs to .../import (bulk create) and lands on Result
//   2. Mapping — legacy AI-suggested column→field mapping (non-template CSVs)
//   3. Result  — progress bar, then a success / failure summary
//
// The template/paste → grid → insert path (primary flow, Task 9) writes
// through POST /api/omnipulse/boards/[id]/import. The legacy mapping path
// (non-template CSV uploads) still writes through the original per-row
// POST /api/omnipulse/tasks loop in use-csv-import.ts — kept working rather
// than replaced, per the task brief. On success the parent's onImported()
// refreshes the board either way.
// ============================================================================
export function ImportCSVModal({
  open,
  onClose,
  onImported,
  boardId,
  boardName,
  lists,
  users,
}: {
  open: boolean;
  onClose: () => void;
  // Called once after a run that created at least one task, so the board can
  // refresh its task list.
  onImported: () => void;
  boardId: string;
  boardName: string;
  lists: ImportList[];
  users: ImportUser[];
}) {
  const tr = useTr();
  const csv = useCSVImport({ boardId, lists, users });
  const {
    step,
    file,
    parsed,
    rowCount,
    uploadError,
    downloadingTemplate,
    downloadError,
    pasteText,
    extracting,
    extractError,
    gridRows,
    gridAssignments,
    assigning,
    masters,
    mastersLoading,
    mastersError,
    analyzing,
    mapping,
    duplicateFields,
    importing,
    progress,
    result,
    gridResult,
    importableCount,
    confirmListNames,
    listsToCreate,
    downloadTemplate,
    chooseTemplate,
    choosePaste,
    chooseUpload,
    setPasteText,
    continueFromPaste,
    selectFile,
    analyzeAndAdvance,
    continueFromMapping,
    setColumnField,
    runGridImport,
    confirmCreateLists,
    skipListCreation,
    reset,
    backToMapping,
    backToChoose,
  } = csv;

  // Fresh state every time the modal opens.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Esc closes (except mid-import, where a half-finished run shouldn't be
  // abandoned silently).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !importing) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, importing, onClose]);

  if (!open) return null;

  const createdAny = (!!result && result.created > 0) || (!!gridResult && gridResult.created > 0);
  const allFailed =
    (!!result && result.created === 0 && result.total > 0) ||
    (!!gridResult && gridResult.created === 0 && gridResult.total > 0);

  function handleDone() {
    if (createdAny) onImported();
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) onClose();
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        className="modal-card"
        style={step === "grid" ? gridCardStyle : step === "choose" ? chooseCardStyle : cardStyle}
      >
        {/* Header */}
        <div style={headerRowStyle}>
          <h3 style={{ fontFamily: "var(--serif)", margin: 0 }}>{tr("Import CSV")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("Close")}
            disabled={importing}
            style={closeBtnStyle}
          >
            ×
          </button>
        </div>

        {/* Step body */}
        {step === "choose" && (
          <StepChoose
            onChooseTemplate={chooseTemplate}
            onChooseUpload={chooseUpload}
            onChoosePaste={choosePaste}
          />
        )}
        {step === "paste" && (
          <StepPaste
            pasteText={pasteText}
            onChangeText={setPasteText}
            extracting={extracting}
            extractError={extractError}
          />
        )}
        {step === "upload" && (
          <StepUpload
            fileName={file?.name ?? null}
            rowCount={rowCount}
            uploadError={uploadError}
            onSelectFile={selectFile}
            detectedMetadata={csv.detectedMetadata}
            onDownloadTemplate={() => void downloadTemplate()}
            downloadingTemplate={downloadingTemplate}
            downloadError={downloadError}
          />
        )}
        {step === "confirmLists" && <StepConfirmLists unmatchedListNames={confirmListNames} />}
        {step === "grid" && (
          <>
            {(mastersLoading || assigning) && (
              <div style={{ fontSize: 13, color: "var(--ink-soft)", padding: "16px 0" }}>
                {assigning && !mastersLoading ? tr("Matching tasks to columns…") : tr("Loading board data…")}
              </div>
            )}
            {!mastersLoading && !assigning && mastersError && (
              <div style={gridErrorStyle}>{mastersError}</div>
            )}
            {!mastersLoading && !assigning && !mastersError && masters && (
              <PreviewGrid
                rows={gridRows}
                masters={masters}
                assignments={gridAssignments}
                listsBeingCreated={listsToCreate}
                busy={importing}
                onInsert={(rows) => void runGridImport(rows)}
              />
            )}
          </>
        )}
        {step === "mapping" && (
          <StepMapping
            analyzing={analyzing}
            headers={parsed?.headers ?? []}
            mapping={mapping}
            duplicateFields={duplicateFields}
            boardName={boardName}
            importableCount={importableCount}
            onChangeField={setColumnField}
          />
        )}
        {step === "result" && (
          <StepResult
            importing={importing}
            progress={progress}
            result={result}
            gridResult={gridResult}
          />
        )}

        {/* Footer */}
        <div style={footerStyle}>
          {step === "choose" && (
            <button type="button" className="btn-secondary" onClick={onClose}>
              {tr("Cancel")}
            </button>
          )}

          {step === "upload" && (
            <>
              <button type="button" className="btn-secondary" onClick={backToChoose}>
                {tr("Back")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!parsed || !!uploadError}
                onClick={() => void analyzeAndAdvance()}
              >
                {tr("Next →")}
              </button>
            </>
          )}

          {step === "paste" && (
            <>
              <button type="button" className="btn-secondary" onClick={backToChoose} disabled={extracting}>
                {tr("Back")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!pasteText.trim() || extracting}
                onClick={() => void continueFromPaste()}
              >
                {extracting ? tr("Extracting…") : tr("Continue →")}
              </button>
            </>
          )}

          {step === "confirmLists" && (
            <>
              <button type="button" className="btn-secondary" onClick={backToChoose}>
                {tr("Back")}
              </button>
              <button type="button" className="btn-secondary" onClick={() => void skipListCreation()}>
                {tr("Import without lists")}
              </button>
              <button type="button" className="btn-primary" onClick={() => void confirmCreateLists()}>
                {tr("Create & import →")}
              </button>
            </>
          )}

          {step === "grid" && (
            <button type="button" className="btn-secondary" onClick={backToChoose} disabled={importing}>
              {tr("Back")}
            </button>
          )}

          {step === "mapping" && (
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={analyzing}
                onClick={reset}
              >
                {tr("Back")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={analyzing || importableCount === 0}
                onClick={() => void continueFromMapping()}
              >
                {tr("Continue with")} {importableCount} task{importableCount === 1 ? "" : "s"} →
              </button>
            </>
          )}

          {step === "result" && !importing && (
            <>
              {allFailed && !gridResult && (
                <button type="button" className="btn-secondary" onClick={backToMapping}>
                  {tr("Try again")}
                </button>
              )}
              <button type="button" className="btn-primary" onClick={handleDone}>
                {allFailed ? tr("Close") : tr("Done")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  width: 560,
  maxWidth: "100%",
};
// The choose step now shows three path cards side by side; 560px would cramp
// them (~175px each). Widen just this step so each card keeps a readable width.
const chooseCardStyle: CSSProperties = {
  width: "min(760px, calc(100vw - 48px))",
  maxWidth: "100%",
};
// The grid step needs room for ~11 columns of dropdowns/inputs — 560px
// (the default wizard width) would force horizontal scrolling on nearly
// every cell. Widened only for this step; other steps keep the compact
// width. See the file-level comment for the dropdown-clipping note.
const gridCardStyle: CSSProperties = {
  width: "min(1240px, calc(100vw - 48px))",
  maxWidth: "100%",
};
const gridErrorStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: "var(--crit)",
  padding: "8px 12px",
  background: "var(--crit-wash, var(--surface-sunk))",
  borderRadius: "var(--r-sm)",
};
const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};
const closeBtnStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "var(--r-sm)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--ink-soft)",
  fontSize: 20,
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 20,
};
