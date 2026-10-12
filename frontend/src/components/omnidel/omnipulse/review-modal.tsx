"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import {
  EvidenceWorkspace,
  formatDateTime,
  formatScoreOutOfTen,
  resolveKarigarLabel,
  type EvidenceSubmission,
  type EvidenceTaskContext,
  type EvidenceTimeline,
  type LeftPane,
} from "@/components/omnidel/omnipulse/evidence-review";
import { useTr } from "@/lib/client/language";

const FEEDBACK_MAX = 200;

interface ReviewDetail {
  evaluation_id: string;
  task_id: string;
  task_title: string;
  task_description: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_on: string | null;
  status_label: string | null;
  assignees: { id: string; name: string }[];
  assigned_by_name: string | null;
  acharya_name: string | null;
  task_type_id?: string | null;
  task_type_slug?: string | null;
  task_type_name?: string | null;
  is_simple_task?: boolean;
  subtasks: EvidenceTaskContext["subtasks"];
  task_open_href: string | null;
  comments: EvidenceTaskContext["comments"];
  team_name: string | null;
  project_name: string | null;
  karigar_name: string | null;
  acharya_score: number;
  evaluated_at: string;
  notes: string | null;
  submission_text: string | null;
  submission_text_entries?: Array<{
    kind: string;
    label: string;
    text: string;
    created_on?: string;
    update_context?: string | null;
  }>;
  images: Array<{
    blob_url: string;
    blob_mime: string | null;
    kind: string;
    update_context?: string | null;
    attempt_id: string | null;
    subtask_id: string | null;
    subtask_title: string | null;
    captured_at: string | null;
  }>;
  timeline?: EvidenceTimeline | null;
}

interface ReviewModalProps {
  evaluationId: string;
  onCancel: () => void;
  onApproved: () => void;
}

function detailToTaskContext(detail: ReviewDetail): EvidenceTaskContext {
  return {
    title: detail.task_title,
    description: detail.task_description,
    acharya_name: detail.acharya_name,
    team_name: detail.team_name,
    project_name: detail.project_name,
    priority: detail.priority,
    due_date: detail.due_date,
    assigned_on: detail.assigned_on,
    status_label: detail.status_label,
    task_type_name: detail.task_type_name ?? null,
    is_simple_task: Boolean(detail.is_simple_task),
    assignees: detail.assignees,
    subtasks: detail.subtasks || [],
    comments: detail.comments || [],
    task_open_href: detail.task_open_href,
  };
}

function detailToSubmission(detail: ReviewDetail): EvidenceSubmission {
  const karigar = resolveKarigarLabel(detail.karigar_name, detail.assignees);
  return {
    id: detail.evaluation_id,
    user_id: "",
    user_name: karigar || "—",
    kinds: [...new Set(detail.images.map((i) => i.kind).filter(Boolean))],
    text_payload: detail.submission_text,
    text_entries: detail.submission_text_entries,
    images: detail.images.map((img) => ({
      blob_url: img.blob_url,
      blob_mime: img.blob_mime,
      kind: img.kind,
      update_context: img.update_context ?? null,
      subtask_id: img.subtask_id,
      subtask_title: img.subtask_title,
      attempt_id: img.attempt_id,
      captured_at: img.captured_at,
    })),
    created_on: detail.evaluated_at,
    evaluation: {
      approved: false,
      score: detail.acharya_score,
      notes: detail.notes,
      review_status: "pending_review",
      acharya_score: detail.acharya_score,
      final_score: null,
      reviewer_feedback: null,
      display_status: "Reviewing",
    },
  };
}

export function ReviewModal({
  evaluationId,
  onCancel,
  onApproved,
}: ReviewModalProps) {
  const tr = useTr();
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<"accept" | "revise">("accept");
  const [revisedOutOfTen, setRevisedOutOfTen] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);
  const [leftPane, setLeftPane] = useState<LeftPane>("submission");
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);

  useEffect(() => {
    function sync() {
      setIsNarrow(window.matchMedia("(max-width: 700px)").matches);
    }
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setDetail(null);
    setLeftPane("submission");
    fetchJson<{ item?: ReviewDetail }>(`/api/omnipulse/reviews/${evaluationId}`)
      .then((d) => {
        if (cancelled) return;
        const item = d.item || null;
        setDetail(item);
        if (item) {
          const simple = Boolean(item.is_simple_task);
          setMode(simple ? "revise" : "accept");
          setRevisedOutOfTen(simple ? 0 : Number((item.acharya_score * 10).toFixed(1)));
          const subs = item.timeline?.subtasks || item.subtasks || [];
          setSelectedSubtaskId(subs[0]?.id ?? null);
          if (simple) setLeftPane("submission");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof FetchError ? err.message : "Failed to load review.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [evaluationId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onCancel]);

  const task = useMemo(
    () => (detail ? detailToTaskContext(detail) : null),
    [detail],
  );
  const submissions = useMemo(
    () => (detail ? [detailToSubmission(detail)] : []),
    [detail],
  );
  const timeline = detail?.timeline ?? null;
  const karigarLabel = detail
    ? resolveKarigarLabel(detail.karigar_name, detail.assignees)
    : null;

  async function handleApprove() {
    if (!detail) return;
    setError("");
    setSubmitting(true);
    try {
      // Simple tasks skip Acharya scoring — manager must enter their own score.
      const accept = detail.is_simple_task ? false : mode === "accept";
      let revised_score: number | undefined;
      if (!accept) {
        if (!Number.isFinite(revisedOutOfTen) || revisedOutOfTen < 0 || revisedOutOfTen > 10) {
          setError("Your score must be between 0 and 10.");
          setSubmitting(false);
          return;
        }
        revised_score = Math.min(1, Math.max(0, revisedOutOfTen / 10));
      }
      await fetchJson(`/api/omnipulse/reviews/${evaluationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept_acharya: accept,
          revised_score: accept ? undefined : revised_score,
          feedback: feedback.trim() || null,
        }),
      });
      onApproved();
    } catch (err) {
      setError(err instanceof FetchError ? err.message : "Approve failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div style={shellStyle} onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <>
            <TopBar title={tr("Review")} meta="Fetching submission details…" onClose={onCancel} />
            <div style={loadingBodyStyle}>
              <div style={loadingPanelStyle} role="status" aria-live="polite">
                <span style={loadingDotStyle} aria-hidden />
                <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-soft)" }}>
                  {tr("Loading submission…")}
                </span>
              </div>
            </div>
          </>
        ) : loadError || !detail ? (
          <>
            <TopBar title={tr("Review")} onClose={onCancel} />
            <div style={loadingBodyStyle}>
              <div role="alert" style={errorStyle}>{loadError || tr("Review not found")}</div>
            </div>
          </>
        ) : (
          <>
            <TopBar
              title={detail.task_title}
              badge={detail.is_simple_task ? (detail.task_type_name?.trim() || "Simple task") : null}
              meta={[
                detail.team_name || "—",
                detail.project_name || "—",
                karigarLabel ? `Karigar · ${karigarLabel}` : null,
                formatDateTime(detail.evaluated_at),
              ].filter(Boolean).join(" · ")}
              onClose={onCancel}
              disabled={submitting}
            />

            <div
              style={{
                flex: "1 1 0%",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                padding: isNarrow ? "12px" : "14px 18px 14px",
              }}
            >
              <EvidenceWorkspace
                pane={leftPane}
                onPaneChange={setLeftPane}
                task={task}
                acharyaName={detail.acharya_name}
                submissions={submissions}
                selectedSubmissionId={detail.evaluation_id}
                selectedSubtaskId={selectedSubtaskId}
                onSubtaskChange={setSelectedSubtaskId}
                timeline={timeline}
                isNarrow={isNarrow}
                showSubmissionPicker={false}
                leftFooter={(
                  <div style={scoringBarStyle}>
                <div style={scoreActionRowStyle} role="group" aria-label={tr("Score choice")}>
                  {!detail.is_simple_task ? (
                    <>
                      <div style={scoreBadgeStyle}>
                        <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
                          {tr("Acharya score")}
                        </span>
                        <span style={{
                          fontFamily: "var(--mono)",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink)",
                          whiteSpace: "nowrap",
                        }}>
                          {formatScoreOutOfTen(detail.acharya_score)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMode("accept")}
                        style={mode === "accept" ? toggleActiveCompactStyle : toggleIdleCompactStyle}
                      >
                        {tr("Use Acharya")}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setMode("revise")}
                    style={mode === "revise" || detail.is_simple_task ? toggleActiveCompactStyle : toggleIdleCompactStyle}
                  >
                    {tr("Enter my score")}
                  </button>
                  {(mode === "revise" || detail.is_simple_task) && (
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={revisedOutOfTen}
                      onChange={(e) => setRevisedOutOfTen(Number(e.target.value))}
                      aria-label={tr("Your score (0–10)")}
                      style={scoreInputCompactStyle}
                    />
                  )}
                </div>

                <div style={{ marginTop: 10 }}>
                  <span style={fieldLabelStyle}>{tr("Feedback (optional)")}</span>
                  <div style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-end",
                    flexWrap: "wrap",
                  }}>
                    <textarea
                      value={feedback}
                      maxLength={FEEDBACK_MAX}
                      rows={isNarrow ? 3 : 2}
                      onChange={(e) => setFeedback(e.target.value.slice(0, FEEDBACK_MAX))}
                      style={feedbackTextareaStyle}
                      placeholder={tr("Optional note for the karigar")}
                    />
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={submitting}
                      style={{
                        ...primaryBtnStyle,
                        opacity: submitting ? 0.6 : 1,
                        cursor: submitting ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting ? "…" : tr("Approve")}
                    </button>
                  </div>
                  <div style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-mute)",
                    textAlign: "right",
                    marginTop: 4,
                  }}>
                    {feedback.length}/{FEEDBACK_MAX}
                  </div>
                </div>
                {error && (
                  <div role="alert" style={{ ...errorStyle, marginTop: 8 }}>{error}</div>
                )}
                  </div>
                )}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TopBar({
  title,
  badge,
  meta,
  onClose,
  disabled,
}: {
  title: string;
  badge?: string | null;
  meta?: string;
  onClose: () => void;
  disabled?: boolean;
}) {
  const tr = useTr();
  return (
    <div style={headerStyle}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 4,
        }}>
          {tr("Review")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <h3 id="review-modal-title" style={{ ...taskTitleStyle, margin: 0 }}>{title}</h3>
          {badge ? (
            <span
              title={badge}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 10px",
                borderRadius: 999,
                background: "var(--green-wash)",
                color: "var(--green-deep)",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "var(--mono)",
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        {meta ? <p style={metaStyle}>{meta}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        aria-label={tr("Close")}
        style={closeBtnStyle}
      >
        ×
      </button>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2500,
  background: "rgba(35, 29, 20, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 8,
  boxSizing: "border-box",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1380,
  height: "min(94dvh, 94vh)",
  maxHeight: "94dvh",
  display: "flex",
  flexDirection: "column",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
  boxSizing: "border-box",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 16px 10px",
  flexShrink: 0,
  borderBottom: "1px solid var(--rule)",
};

const metaStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 12,
  color: "var(--ink-mute)",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const closeBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--rule-strong)",
  background: "var(--surface-sunk)",
  color: "var(--ink-soft)",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  flexShrink: 0,
  fontFamily: "var(--sans)",
};

const loadingBodyStyle: CSSProperties = {
  padding: "0 22px 22px",
  flex: 1,
};

const taskTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 18,
  fontWeight: 600,
  color: "var(--ink)",
  lineHeight: 1.25,
  flexShrink: 0,
};

const scoringBarStyle: CSSProperties = {
  flex: "0 0 auto",
  borderTop: "1px solid var(--rule)",
  padding: "12px 0 0",
  marginTop: 12,
};

const scoreActionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
  minWidth: 0,
};

const scoreBadgeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 32,
  padding: "0 10px",
  boxSizing: "border-box",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  flex: "0 1 auto",
  minWidth: 0,
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  marginBottom: 6,
};

const toggleIdleCompactStyle: CSSProperties = {
  flex: "0 1 auto",
  minWidth: 0,
  height: 32,
  padding: "0 10px",
  fontSize: 11,
  fontWeight: 500,
  fontFamily: "var(--sans)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface-sunk)",
  color: "var(--ink)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  boxSizing: "border-box",
};

const toggleActiveCompactStyle: CSSProperties = {
  ...toggleIdleCompactStyle,
  border: "1px solid var(--green-deep)",
  background: "var(--green-deep)",
  color: "#f4efdf",
};

/** Match Enter my score / Use Acharya control height — avoid tall form-input. */
const scoreInputCompactStyle: CSSProperties = {
  width: 72,
  height: 32,
  minHeight: 32,
  maxHeight: 32,
  boxSizing: "border-box",
  padding: "0 8px",
  margin: 0,
  fontSize: 12,
  fontFamily: "var(--mono)",
  fontWeight: 600,
  color: "var(--ink)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  lineHeight: 1,
  appearance: "textfield",
  WebkitAppearance: "none",
  MozAppearance: "textfield",
};

const feedbackTextareaStyle: CSSProperties = {
  flex: "1 1 220px",
  minWidth: 0,
  minHeight: 64,
  height: 64,
  boxSizing: "border-box",
  padding: "8px 10px",
  margin: 0,
  resize: "none",
  fontSize: 13,
  fontFamily: "var(--sans)",
  color: "var(--ink)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  lineHeight: 1.35,
};

const primaryBtnStyle: CSSProperties = {
  padding: "0 18px",
  height: 34,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "var(--sans)",
  color: "#f4efdf",
  background: "var(--green-deep)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  minWidth: 96,
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};

const errorStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 0,
  padding: "8px 12px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--crit)",
  background: "var(--crit-wash)",
  borderRadius: "var(--r-sm)",
};

const loadingPanelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "18px 14px",
  marginTop: 4,
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
};

const loadingDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "var(--green-deep)",
  flexShrink: 0,
  boxShadow: "0 0 0 3px color-mix(in srgb, var(--green-deep) 18%, transparent)",
};
