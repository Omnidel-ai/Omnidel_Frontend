"use client";

import { MetaRow } from "./MetaRow";
import { SubmissionTextBlock } from "./SubmissionTextBlock";
import {
  formatScoreOutOfTen,
  formatShortDate,
  kindLabel,
} from "./format";
import {
  evidenceLabelStyle,
  evidencePaneFillStyle,
  evidenceValueBoxStyle,
  type EvidenceSubmission,
} from "./types";
import { useTr } from "@/lib/client/language";

export function SubmissionPane({
  submission,
  acharyaName,
  /** When set, show Acharya score separately from final reviewed score. */
  showScoreSplit = true,
  isSimpleTask = false,
  taskTypeName = null,
}: {
  submission: EvidenceSubmission | null;
  acharyaName?: string | null;
  showScoreSplit?: boolean;
  isSimpleTask?: boolean;
  taskTypeName?: string | null;
}) {
  const tr = useTr();
  if (!submission) {
    return (
      <div style={evidencePaneFillStyle}>
        <div style={{ ...evidenceValueBoxStyle, color: "var(--ink-mute)" }}>
          {tr("No submission selected")}
        </div>
      </div>
    );
  }

  const displayStatus = submission.evaluation?.display_status
    || (submission.evaluation?.approved
      ? "Approved"
      : submission.evaluation
        ? "Reviewing"
        : null);
  const kindsLabel = submission.kinds
    .map((k) => kindLabel(k))
    .join(" · ");
  const acharyaScore = submission.evaluation?.acharya_score
    ?? (showScoreSplit ? submission.evaluation?.score : null)
    ?? null;
  const finalScore = submission.evaluation?.final_score
    ?? (submission.evaluation?.approved ? submission.evaluation?.score : null)
    ?? null;
  const reviewerFeedback = submission.evaluation?.reviewer_feedback?.trim() || null;
  const approvedBy = submission.evaluation?.reviewed_by_name?.trim() || null;
  const approvedAt = submission.evaluation?.reviewed_at
    ? formatShortDate(submission.evaluation.reviewed_at)
    : null;
  const typeLabel = isSimpleTask
    ? (taskTypeName?.trim() || "Simple task")
    : (taskTypeName?.trim() || null);

  return (
    <div style={{ ...evidencePaneFillStyle, flex: "0 0 auto", minHeight: "auto", height: "auto" }}>
      <section style={{ marginBottom: 16, flex: "0 0 auto" }}>
        <div style={evidenceLabelStyle}>{tr("Details")}</div>
        <div style={{
          ...evidenceValueBoxStyle,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          columnGap: 14,
          rowGap: 10,
        }}>
          <MetaRow
            label={tr("Submitted by")}
            value={submission.user_name || "—"}
            sub={kindsLabel
              ? `${kindsLabel} · ${new Date(submission.created_on).toLocaleString("en-IN")}`
              : new Date(submission.created_on).toLocaleString("en-IN")}
          />
          <MetaRow label={tr("Status")} value={displayStatus || "—"} />
          <MetaRow label={tr("Acharya")} value={acharyaName || "—"} />
          {typeLabel ? (
            <MetaRow label={tr("Task type")} value={typeLabel} />
          ) : null}
          {showScoreSplit ? (
            <>
              <MetaRow
                label={tr("Acharya score")}
                value={
                  isSimpleTask
                    ? "—"
                    : (acharyaScore != null ? formatScoreOutOfTen(acharyaScore) : "—")
                }
              />
              <MetaRow
                label={tr("Final score")}
                value={finalScore != null ? formatScoreOutOfTen(finalScore) : "—"}
              />
            </>
          ) : (
            <MetaRow
              label={tr("Score")}
              value={
                isSimpleTask
                  ? (finalScore != null ? formatScoreOutOfTen(finalScore) : "—")
                  : (
                    (finalScore ?? acharyaScore) != null
                      ? formatScoreOutOfTen(finalScore ?? acharyaScore)
                      : "—"
                  )
              }
            />
          )}
          <MetaRow label={tr("Approved by")} value={approvedBy || "—"} />
          <MetaRow label={tr("Approved time")} value={approvedAt || "—"} />
        </div>
      </section>

      <section style={{ marginBottom: 16, flex: "0 0 auto" }}>
        <div style={evidenceLabelStyle}>{tr("Submission")}</div>
        <div style={evidenceValueBoxStyle}>
          <SubmissionTextBlock
            entries={submission.text_entries}
            fallback={submission.text_payload}
          />
        </div>
      </section>

      <section style={{ marginBottom: reviewerFeedback ? 16 : 0, flex: "0 0 auto" }}>
        <div style={evidenceLabelStyle}>{tr("Acharya notes")}</div>
        <div
          style={{
            ...evidenceValueBoxStyle,
            height: "auto",
            minHeight: 0,
            whiteSpace: "pre-wrap",
            lineHeight: 1.55,
            fontStyle: submission.evaluation?.notes ? "italic" : "normal",
            color: submission.evaluation?.notes ? "var(--ink-soft)" : "var(--ink-mute)",
          }}
        >
          {submission.evaluation?.notes?.trim() || tr("No notes yet")}
        </div>
      </section>

      {reviewerFeedback && (
        <section style={{ flex: "0 0 auto" }}>
          <div style={evidenceLabelStyle}>{tr("Reviewer feedback")}</div>
          <div
            style={{
              ...evidenceValueBoxStyle,
              height: "auto",
              minHeight: 0,
              whiteSpace: "pre-wrap",
              lineHeight: 1.55,
              color: "var(--ink-soft)",
            }}
          >
            {reviewerFeedback}
          </div>
        </section>
      )}
    </div>
  );
}
