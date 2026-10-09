"use client";

import { useMemo, useState } from "react";
import { ImageLightbox } from "@/components/omnidel/image-lightbox";
import { CommentMedia } from "./CommentMedia";
import { MetaRow } from "./MetaRow";
import { SortDirButton, type SortDir } from "./SortDirButton";
import { formatDueDate, formatShortDate, resolveKarigarLabel } from "./format";
import {
  evidenceLabelStyle,
  evidencePaneFillStyle,
  evidenceValueBoxStyle,
  type EvidenceTaskContext,
} from "./types";
import { useTr } from "@/lib/client/language";

export function TaskDetailsPane({
  task,
  acharyaName,
  submitterName,
}: {
  task: EvidenceTaskContext | null;
  acharyaName?: string | null;
  /** Submission author — shown separately from task assignees. */
  submitterName?: string | null;
}) {
  const tr = useTr();
  const [commentLightbox, setCommentLightbox] = useState<{
    images: Array<{ src: string; alt: string }>;
    index: number;
  } | null>(null);
  const [commentSort, setCommentSort] = useState<SortDir>("desc");

  const karigar = resolveKarigarLabel(submitterName, task?.assignees);

  const sortedComments = useMemo(() => {
    const list = [...(task?.comments || [])];
    list.sort((a, b) => {
      const ta = Date.parse(a.created_on) || 0;
      const tb = Date.parse(b.created_on) || 0;
      return commentSort === "desc" ? tb - ta : ta - tb;
    });
    return list;
  }, [task?.comments, commentSort]);

  return (
    <div style={{ ...evidencePaneFillStyle, flex: "0 0 auto", minHeight: "auto", height: "auto" }}>
      <section style={{ marginBottom: 16, flex: "0 0 auto" }}>
        <div style={evidenceLabelStyle}>{tr("Task description")}</div>
        <div style={{ ...evidenceValueBoxStyle, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
          {task?.description?.trim() || (
            <span style={{ color: "var(--ink-mute)" }}>{tr("No description")}</span>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 16, flex: "0 0 auto" }}>
        <div style={evidenceLabelStyle}>{tr("Details")}</div>
        <div style={{
          ...evidenceValueBoxStyle,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          columnGap: 14,
          rowGap: 10,
        }}>
          <MetaRow label={tr("Submitted by")} value={karigar || "—"} />
          <MetaRow
            label={tr("Assignees")}
            value={
              task?.assignees?.length
                ? task.assignees.map((a) => a.name).join(", ")
                : "—"
            }
          />
          <MetaRow label={tr("Acharya")} value={task?.acharya_name || acharyaName || "—"} />
          <MetaRow
            label={tr("Task type")}
            value={
              task?.is_simple_task
                ? (task.task_type_name?.trim() || "Simple task")
                : (task?.task_type_name?.trim() || "—")
            }
          />
          <MetaRow label={tr("Team")} value={task?.team_name || "—"} />
          <MetaRow label={tr("Project")} value={task?.project_name || "—"} />
          <MetaRow label={tr("Due date")} value={task?.due_date ? formatDueDate(task.due_date) : "—"} />
          <MetaRow
            label={tr("Assigned date")}
            value={task?.assigned_on ? formatDueDate(task.assigned_on) : "—"}
          />
          <MetaRow label={tr("Priority")} value={task?.priority || "—"} />
          <MetaRow label={tr("Status")} value={task?.status_label || "—"} />
        </div>
      </section>

      {(task?.subtasks?.length ?? 0) > 0 && (
        <section style={{ marginBottom: 16, flex: "0 0 auto" }}>
          <div style={evidenceLabelStyle}>
            {tr("Subtasks (")}{task!.subtasks.filter((s) => s.is_done).length}/{task!.subtasks.length})
          </div>
          <div style={{ ...evidenceValueBoxStyle, padding: "6px 10px" }}>
            {task!.subtasks.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 0",
                  fontSize: 12,
                  fontFamily: "var(--sans)",
                  color: s.is_done ? "var(--ink-mute)" : "var(--ink-soft)",
                }}
              >
                <span aria-hidden style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  border: `1px solid ${s.is_done ? "var(--green-deep)" : "var(--rule-strong)"}`,
                  background: s.is_done ? "var(--green-deep)" : "transparent",
                  flexShrink: 0,
                }} />
                <span style={{
                  textDecoration: s.is_done ? "line-through" : "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ flex: "0 0 auto", marginBottom: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div style={{ ...evidenceLabelStyle, marginBottom: 0 }}>
            {tr("Comments (")}{sortedComments.length})
          </div>
          {sortedComments.length > 0 ? (
            <SortDirButton
              dir={commentSort}
              onToggle={() => setCommentSort((d) => (d === "desc" ? "asc" : "desc"))}
            />
          ) : null}
        </div>
        <div
          style={{
            ...evidenceValueBoxStyle,
            padding: "8px 10px",
            height: "auto",
            minHeight: 0,
          }}
        >
          {!sortedComments.length ? (
            <span style={{ color: "var(--ink-mute)", fontSize: 13, fontFamily: "var(--sans)" }}>
              {tr("No comments yet")}
            </span>
          ) : (
            sortedComments.map((c, idx) => (
              <div
                key={c.id}
                style={{
                  padding: "8px 0",
                  borderBottom: idx < sortedComments.length - 1 ? "1px solid var(--rule)" : "none",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 4,
                }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ink)",
                    fontFamily: "var(--sans)",
                  }}>
                    {c.author_name}
                    {c.edited_at ? (
                      <span style={{
                        marginLeft: 6,
                        fontWeight: 400,
                        fontStyle: "italic",
                        color: "var(--ink-mute)",
                        fontSize: 11,
                      }}>
                        {tr("(edited)")}
                      </span>
                    ) : null}
                  </span>
                  <span style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-mute)",
                    flexShrink: 0,
                  }}>
                    {formatShortDate(c.created_on)}
                  </span>
                </div>
                <CommentMedia
                  attachments={c.attachments || []}
                  onPreview={(images, index) => setCommentLightbox({ images, index })}
                />
                {c.content?.trim() ? (
                  <p style={{
                    margin: "6px 0 0",
                    fontSize: 12,
                    fontFamily: "var(--sans)",
                    color: "var(--ink-soft)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}>
                    {c.content}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      {task?.task_open_href && (
        <a
          href={task.task_open_href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            fontSize: 12,
            fontFamily: "var(--sans)",
            fontWeight: 500,
            color: "var(--green-deep)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            flex: "0 0 auto",
            marginTop: 12,
            position: "relative",
          }}
        >
          {tr("Open full task on board ↗")}
        </a>
      )}

      {commentLightbox && (
        <ImageLightbox
          images={commentLightbox.images}
          index={commentLightbox.index}
          onIndexChange={(i) => setCommentLightbox((prev) => prev ? { ...prev, index: i } : prev)}
          onClose={() => setCommentLightbox(null)}
        />
      )}
    </div>
  );
}
