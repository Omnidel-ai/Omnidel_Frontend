"use client";

import { type CSSProperties } from "react";
import type { ImportResult, ImportResultV2 } from "./types";
import { useTr } from "@/lib/client/language";

// Normalized shape both result variants render through — the legacy
// per-row-fetch path (ImportResult) and the grid → bulk-import path
// (ImportResultV2, which additionally distinguishes "ambiguous" assignees
// from plain "unresolved" ones, per spec §5).
interface NormalizedOutcome {
  created: number;
  total: number;
  skippedNoTitle: number;
  unresolved: string[];
  ambiguous: string[];
  // Tasks placed with low confidence by the board-aware column assignment.
  // Only the legacy (upload→mapping) path reports this after import; the grid
  // path surfaces low-confidence rows in-grid before insert, so it stays 0.
  lowConfidence: number;
  // Lists created from the wizard's confirm-lists step. Only the grid→bulk-
  // import path can populate this; the legacy path never creates lists.
  listsCreated: string[];
  failures: { title: string; message: string }[];
  // Created, but some detail (status / label / subtask) didn't apply. These are
  // included in `created` — never add them to the failed count.
  partial: { title: string; message: string }[];
  // Rows that produced no task. Derived per-path in normalize() because the two
  // paths scope `total` differently, and NOT read off failures.length, which the
  // legacy path caps at MAX_FAILURES_SHOWN.
  failed: number;
}

function normalize(result: ImportResult | ImportResultV2): NormalizedOutcome {
  if ("unresolvedAssignees" in result) {
    // Legacy path: `total` is already only the titled tasks it attempted, so
    // skippedNoTitle is NOT part of it and must not be subtracted again.
    return {
      failed: Math.max(0, result.total - result.created),
      created: result.created,
      total: result.total,
      skippedNoTitle: result.skippedNoTitle,
      unresolved: result.unresolvedAssignees,
      ambiguous: [],
      lowConfidence: result.lowConfidence,
      listsCreated: [],
      failures: result.failures,
      partial: [],
    };
  }
  // Grid/bulk path: the server counts EVERY submitted row in `total`, including
  // the ones it skipped for having no title — so those come out before what's
  // left can be called a failure.
  return {
    failed: Math.max(0, result.total - result.created - result.skippedNoTitle),
    created: result.created,
    total: result.total,
    skippedNoTitle: result.skippedNoTitle,
    unresolved: result.unresolved,
    ambiguous: result.ambiguous,
    lowConfidence: 0,
    listsCreated: result.listsCreated,
    failures: result.failures,
    partial: result.partial ?? [],
  };
}

// Step 3 — outcome screen. While importing, shows a progress bar + counter.
// When done, shows a success summary (with skip/unresolved/ambiguous notes)
// or, if every task failed, an error state with the first failure message.
// `result` is the legacy per-row-fetch outcome (upload→mapping path);
// `gridResult` is the grid→bulk-import outcome (template/paste→grid path).
// Exactly one of the two is set for any given run.
export function StepResult({
  importing,
  progress,
  result,
  gridResult,
}: {
  importing: boolean;
  progress: { done: number; total: number };
  result: ImportResult | null;
  gridResult?: ImportResultV2 | null;
}) {
  const tr = useTr();
  const outcome = gridResult ? normalize(gridResult) : result ? normalize(result) : null;

  if (importing || !outcome) {
    const total = progress.total || 1;
    const pct = Math.round((progress.done / total) * 100);
    return (
      <div style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>
          {tr("Importing")} {progress.done} of {progress.total} {tr("tasks…")}
        </div>
        <div style={barTrackStyle}>
          <div style={{ ...barFillStyle, width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // A run is a hard failure only when nothing at all was created.
  const allFailed = outcome.created === 0 && outcome.total > 0;

  if (allFailed) {
    return (
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <StatusIcon ok={false} />
        <div style={titleStyle}>{tr("Import failed")}</div>
        <div style={detailStyle}>
          {outcome.failures[0]?.message || tr("No tasks could be created.")}
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <StatusIcon ok />
      <div style={titleStyle}>
        {outcome.created} task{outcome.created === 1 ? "" : "s"} {tr("imported successfully")}
      </div>
      <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
        {outcome.listsCreated.length > 0 && (
          <div style={detailStyle}>
            {tr("Created")} {outcome.listsCreated.length} list{outcome.listsCreated.length === 1 ? "" : "s"}:{" "}
            {outcome.listsCreated.join(", ")}
          </div>
        )}
        {outcome.skippedNoTitle > 0 && (
          <div style={detailStyle}>
            {outcome.skippedNoTitle} row{outcome.skippedNoTitle === 1 ? "" : "s"} {tr("skipped — no task title found")}
          </div>
        )}
        {outcome.failed > 0 && (
          <div style={detailStyle}>
            {outcome.failed} task{outcome.failed === 1 ? "" : "s"} {tr("could not be created")}
            {outcome.failures[0]?.message ? ` — ${outcome.failures[0].message}` : ""}
          </div>
        )}
        {outcome.partial.length > 0 && (
          <div style={detailStyle}>
            {outcome.partial.length} task{outcome.partial.length === 1 ? "" : "s"} {tr("imported, but some details (status, labels, or subtasks) couldn’t be applied — worth a quick check on the board")}
          </div>
        )}
        {outcome.lowConfidence > 0 && (
          <div style={detailStyle}>
            {outcome.lowConfidence} task{outcome.lowConfidence === 1 ? "" : "s"} {tr("matched a column with low confidence — worth a quick check on the board")}
          </div>
        )}
        {outcome.ambiguous.length > 0 && (
          <div style={detailStyle}>
            {outcome.ambiguous.length} assignee
            {outcome.ambiguous.length === 1 ? "" : "s"} {tr("matched more than one project member and were left unassigned")}
          </div>
        )}
        {outcome.unresolved.length > 0 && (
          <div style={detailStyle}>
            {outcome.unresolved.length} assignee
            {outcome.unresolved.length === 1 ? "" : "s"} {tr("didn’t match a project member and were left unassigned")}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ ok }: { ok: boolean }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        margin: "0 auto 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ok ? "var(--ok-wash, var(--surface-sunk))" : "var(--crit-wash, var(--surface-sunk))",
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke={ok ? "var(--green-deep)" : "var(--crit)"}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ok ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        )}
      </svg>
    </div>
  );
}

const barTrackStyle: CSSProperties = {
  height: 8,
  borderRadius: 999,
  background: "var(--surface-sunk)",
  overflow: "hidden",
};
const barFillStyle: CSSProperties = {
  height: "100%",
  background: "var(--green-deep)",
  borderRadius: 999,
  transition: "width .2s ease",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 18,
  color: "var(--ink)",
};
const detailStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
};
