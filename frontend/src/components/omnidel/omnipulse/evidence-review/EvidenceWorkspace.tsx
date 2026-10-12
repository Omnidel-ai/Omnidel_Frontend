"use client";

import { useMemo, type ReactNode } from "react";
import { EvidenceGallery, resolveGalleryImages } from "./EvidenceGallery";
import { PaneToggle } from "./PaneToggle";
import { SubmissionPane } from "./SubmissionPane";
import { SubmissionPicker } from "./SubmissionPicker";
import { SubtaskTimelinePane } from "./SubtaskTimelinePane";
import { TaskDetailsPane } from "./TaskDetailsPane";
import type {
  EvidenceComment,
  EvidenceSubmission,
  EvidenceTaskContext,
  EvidenceTimeline,
  LeftPane,
} from "./types";

type GallerySource = {
  blob_url: string;
  kind?: string;
  update_context?: string | null;
  subtask_id?: string | null;
  subtask_title?: string | null;
};

function isImageAttachment(type: string | null | undefined, url: string): boolean {
  return (
    (type || "").startsWith("image/") ||
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)
  );
}

function imagesFromComments(comments: EvidenceComment[] | undefined): GallerySource[] {
  const out: GallerySource[] = [];
  for (const c of comments || []) {
    for (const a of c.attachments || []) {
      if (!a?.url || !isImageAttachment(a.type, a.url)) continue;
      out.push({
        blob_url: a.url,
        kind: "Comment",
        update_context: null,
        subtask_id: null,
        subtask_title: c.author_name ? `Comment · ${c.author_name}` : "Comment",
      });
    }
  }
  return out;
}

function imagesFromSubmissions(pool: EvidenceSubmission[]): GallerySource[] {
  return pool.flatMap((s) =>
    (s.images || []).map((img) => ({
      blob_url: img.blob_url,
      kind: img.kind || s.kinds?.[0] || "image",
      update_context: img.update_context ?? null,
      subtask_id: img.subtask_id ?? s.checklist_item_id ?? null,
      subtask_title: img.subtask_title ?? s.subtask_title ?? null,
    })),
  );
}

function imagesFromTimeline(
  timeline: EvidenceTimeline | null,
  subtaskId?: string | null,
): GallerySource[] {
  const subs = timeline?.subtasks || [];
  const scoped = subtaskId ? subs.filter((s) => s.id === subtaskId) : subs;
  const fromEvents: GallerySource[] = scoped.flatMap((sub) =>
    (sub.events || []).flatMap((e) =>
      e.images.map((img) => ({
        blob_url: img.url,
        kind: e.type,
        update_context: null,
        subtask_id: sub.id,
        subtask_title: sub.title,
      })),
    ),
  );
  if (subtaskId) return fromEvents;

  const completion = timeline?.task_completion;
  if (completion?.images?.length) {
    for (const img of completion.images) {
      fromEvents.push({
        blob_url: img.url,
        kind: completion.type || "task_completed",
        update_context: null,
        subtask_id: null,
        subtask_title: "Task completion",
      });
    }
  }
  return fromEvents;
}

export function EvidenceWorkspace({
  pane,
  onPaneChange,
  task,
  acharyaName,
  submissions,
  selectedSubmissionId,
  onSubmissionChange,
  selectedSubtaskId,
  onSubtaskChange,
  timeline,
  isNarrow,
  showPaneToggle = true,
  showSubmissionPicker = true,
  galleryImages,
  /** Renders under the left pane (e.g. review Approve bar) so the gallery keeps the full right column. */
  leftFooter,
}: {
  pane: LeftPane;
  onPaneChange: (pane: LeftPane) => void;
  task: EvidenceTaskContext | null;
  acharyaName?: string | null;
  submissions: EvidenceSubmission[];
  selectedSubmissionId: string | null;
  onSubmissionChange?: (id: string) => void;
  selectedSubtaskId: string | null;
  onSubtaskChange?: (id: string) => void;
  timeline: EvidenceTimeline | null;
  isNarrow: boolean;
  showPaneToggle?: boolean;
  showSubmissionPicker?: boolean;
  /** Override gallery images (e.g. filtered by subtask). */
  galleryImages?: ReturnType<typeof resolveGalleryImages>;
  leftFooter?: ReactNode;
}) {
  const submission =
    submissions.find((s) => s.id === selectedSubmissionId) || submissions[0] || null;

  const images = useMemo(() => {
    if (galleryImages) return galleryImages;

    // Task details: every comment image + all submission / subtask session images.
    if (pane === "task") {
      return resolveGalleryImages([
        ...imagesFromComments(task?.comments),
        ...imagesFromSubmissions(submissions),
        ...imagesFromTimeline(timeline),
      ]);
    }

    // Subtasks: session images for the selected subtask only.
    if (pane === "subtasks") {
      if (selectedSubtaskId) {
        const fromEvents = imagesFromTimeline(timeline, selectedSubtaskId);
        if (fromEvents.length > 0) return resolveGalleryImages(fromEvents);

        const flat = imagesFromSubmissions(submissions);
        const anyLinked = flat.some((img) => !!img.subtask_id);
        if (anyLinked) {
          return resolveGalleryImages(
            flat.filter((img) => img.subtask_id === selectedSubtaskId),
          );
        }
      }
      return resolveGalleryImages(imagesFromSubmissions(submissions));
    }

    // Submission: images for that submission, plus linked subtask session images.
    const fromSubmission = imagesFromSubmissions(submission ? [submission] : []);
    const linkedSubtaskId = submission?.checklist_item_id ?? null;
    const fromLinked = linkedSubtaskId
      ? imagesFromTimeline(timeline, linkedSubtaskId)
      : [];
    const merged = resolveGalleryImages([...fromSubmission, ...fromLinked]);
    if (merged.length > 0) return merged;
    // Fallback so the right column isn't empty when proof lives only on comments/timeline.
    return resolveGalleryImages([
      ...imagesFromSubmissions(submissions),
      ...imagesFromTimeline(timeline),
    ]);
  }, [
    galleryImages,
    pane,
    selectedSubtaskId,
    timeline,
    submissions,
    submission,
    task?.comments,
  ]);

  const showToolbar = showPaneToggle || (showSubmissionPicker && submissions.length > 1);

  return (
    <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isNarrow
            ? "1fr"
            : "minmax(0, 0.95fr) 1px minmax(320px, 1.15fr)",
          gap: isNarrow ? 16 : 0,
          alignItems: "stretch",
          height: isNarrow ? "auto" : "100%",
          maxHeight: isNarrow ? "none" : "100%",
          minHeight: 0,
          overflow: isNarrow ? "visible" : "hidden",
          flex: "1 1 auto",
        }}
      >
        <section
          style={{
            minWidth: 0,
            minHeight: 0,
            height: isNarrow ? "auto" : "100%",
            maxHeight: isNarrow ? "none" : "100%",
            paddingRight: isNarrow ? 0 : 24,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {showToolbar ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
                flex: "0 0 auto",
                flexWrap: "wrap",
              }}
            >
              {showPaneToggle ? (
                <PaneToggle
                  value={pane}
                  onChange={onPaneChange}
                  hideSubtasks={Boolean(task?.is_simple_task)}
                />
              ) : (
                <div />
              )}
              {showSubmissionPicker && onSubmissionChange ? (
                <SubmissionPicker
                  submissions={submissions}
                  selectedId={selectedSubmissionId}
                  onChange={onSubmissionChange}
                />
              ) : null}
            </div>
          ) : null}

          <div
            className="themed-scroll-y"
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: isNarrow ? "visible" : "auto",
              overflowX: "hidden",
              display: "flex",
              flexDirection: "column",
              paddingRight: 2,
            }}
          >
            {pane === "task" ? (
              <TaskDetailsPane
                task={task}
                acharyaName={acharyaName}
                submitterName={submission?.user_name}
              />
            ) : pane === "subtasks" && !task?.is_simple_task ? (
              <SubtaskTimelinePane
                timeline={timeline}
                fallbackSubtasks={task?.subtasks || []}
                selectedSubtaskId={selectedSubtaskId}
                onSubtaskChange={onSubtaskChange}
                acharyaName={task?.acharya_name || acharyaName}
                projectName={task?.project_name}
              />
            ) : (
              <SubmissionPane
                submission={submission}
                acharyaName={acharyaName}
                showScoreSplit
                isSimpleTask={Boolean(task?.is_simple_task)}
                taskTypeName={task?.task_type_name ?? null}
              />
            )}
          </div>

          {leftFooter && !isNarrow ? (
            <div style={{ flex: "0 0 auto", minWidth: 0 }}>{leftFooter}</div>
          ) : null}
        </section>

        {!isNarrow && (
          <div aria-hidden style={{ width: 1, alignSelf: "stretch", background: "var(--rule)" }} />
        )}

        <section
          style={{
            minWidth: 0,
            minHeight: 0,
            height: isNarrow ? "auto" : "100%",
            maxHeight: isNarrow ? "none" : "100%",
            paddingLeft: isNarrow ? 0 : 24,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <EvidenceGallery images={images} isNarrow={isNarrow} />
        </section>
      </div>

      {leftFooter && isNarrow ? (
        <div style={{ flex: "0 0 auto", minWidth: 0 }}>{leftFooter}</div>
      ) : null}
    </div>
  );
}
