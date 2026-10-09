"use client";

import { useMemo, useState } from "react";
import { blobViewUrl } from "@/lib/client/blob-url";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { ImageLightbox } from "@/components/omnidel/image-lightbox";
import { workEventSortRank } from "@/lib/omnipulse/work-event-classify";
import { MetaRow } from "./MetaRow";
import { SortDirButton, type SortDir } from "./SortDirButton";
import {
  formatDuration,
  formatShortDate,
  formatSubtaskBreaks,
  formatSubtaskSessions,
} from "./format";
import {
  evidenceLabelStyle,
  evidencePaneFillStyle,
  evidenceValueBoxStyle,
  type EvidenceSubtask,
  type EvidenceSubtaskTimeline,
  type EvidenceTimeline,
  type EvidenceWorkEvent,
} from "./types";
import { useTr } from "@/lib/client/language";

function eventAccent(type: EvidenceWorkEvent["type"]): { bg: string; fg: string } {
  switch (type) {
    case "break_started":
    case "break_resumed":
      return { bg: "var(--ochre-wash)", fg: "var(--ochre)" };
    case "session_completed":
      return { bg: "var(--ok-wash)", fg: "var(--ok)" };
    case "subtask_completed":
    case "task_completed":
      return { bg: "var(--green-wash, var(--ok-wash))", fg: "var(--green-deep)" };
    default:
      return { bg: "var(--surface)", fg: "var(--ink-soft)" };
  }
}

function TimelineEventRow({
  event,
  onPreview,
}: {
  event: EvidenceWorkEvent;
  onPreview?: (images: Array<{ src: string; alt: string }>, index: number) => void;
}) {
  const tr = useTr();
  const accent = eventAccent(event.type);
  const metaBits: string[] = [formatShortDate(event.occurred_at)];
  if (event.segment_index != null) metaBits.push(`Session ${event.segment_index}`);
  const dur = formatDuration(event.duration_seconds);
  if (dur) metaBits.push(`Duration ${dur}`);
  const rem = formatDuration(event.remaining_seconds);
  if (rem && event.type === "break_started") metaBits.push(`${rem} left`);

  const previewImages = (event.images || [])
    .map((img) => {
      const src = blobViewUrl(img.url);
      if (!src) return null;
      return { src, alt: event.label || "Evidence" };
    })
    .filter((x): x is { src: string; alt: string } => Boolean(x));

  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--rule)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          className="tag"
          style={{
            alignSelf: "flex-start",
            marginBottom: 0,
            background: accent.bg,
            color: accent.fg,
          }}
        >
          {event.label}
        </span>
        <span style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-mute)",
          textAlign: "right",
          flexShrink: 0,
        }}>
          {metaBits.join(" · ")}
        </span>
      </div>
      {event.text?.trim() ? (
        <div style={{
          fontSize: 13,
          fontFamily: "var(--sans)",
          color: "var(--ink-soft)",
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
        }}>
          {event.text.trim()}
        </div>
      ) : null}
      {previewImages.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {previewImages.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => onPreview?.(previewImages, i)}
              title={tr("Preview image")}
              aria-label={tr("Preview image")}
              style={{
                padding: 0,
                width: 64,
                height: 64,
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--rule)",
                overflow: "hidden",
                background: "var(--surface)",
                display: "block",
                cursor: "zoom-in",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.alt}
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SubtaskTimelinePane({
  timeline,
  fallbackSubtasks = [],
  selectedSubtaskId,
  onSubtaskChange,
  acharyaName,
  projectName,
}: {
  timeline: EvidenceTimeline | null;
  fallbackSubtasks?: EvidenceSubtask[];
  selectedSubtaskId: string | null;
  onSubtaskChange?: (id: string) => void;
  acharyaName?: string | null;
  projectName?: string | null;
}) {
  const tr = useTr();
  const subs: EvidenceSubtaskTimeline[] = timeline?.subtasks?.length
    ? timeline.subtasks
    : fallbackSubtasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      is_done: s.is_done,
      session_count: Math.max(1, Number(s.session_count) || 1),
      sessions_completed: Math.max(0, Number(s.sessions_completed) || 0),
      break_allowance_per_segment: Array.isArray(s.break_allowance_per_segment)
        ? s.break_allowance_per_segment
        : [],
      events: [],
    }));

  const [timelineSort, setTimelineSort] = useState<SortDir>("desc");
  const [lightbox, setLightbox] = useState<{
    images: Array<{ src: string; alt: string }>;
    index: number;
  } | null>(null);

  const active = subs.find((s) => s.id === selectedSubtaskId) || subs[0] || null;
  const completion = timeline?.task_completion;

  const sortedEvents = useMemo(() => {
    const list = [...(active?.events || [])];
    const dir = timelineSort === "desc" ? -1 : 1;
    list.sort((a, b) => {
      const ta = Date.parse(a.occurred_at) || 0;
      const tb = Date.parse(b.occurred_at) || 0;
      if (ta !== tb) return (ta - tb) * dir;
      const rank = workEventSortRank(a.type) - workEventSortRank(b.type);
      if (rank !== 0) return rank * dir;
      return a.id.localeCompare(b.id) * dir;
    });
    return list;
  }, [active?.events, timelineSort]);

  const openPreview = (images: Array<{ src: string; alt: string }>, index: number) => {
    setLightbox({ images, index });
  };

  if (subs.length === 0) {
    return (
      <div style={{ ...evidencePaneFillStyle, flex: "0 0 auto", minHeight: "auto", height: "auto" }}>
        <div style={{ ...evidenceValueBoxStyle, color: "var(--ink-mute)" }}>
          {tr("No subtasks on this task")}
          {completion ? (
            <div style={{ marginTop: 12 }}>
              <TimelineEventRow event={completion} onPreview={openPreview} />
            </div>
          ) : null}
        </div>
        {lightbox && (
          <ImageLightbox
            images={lightbox.images}
            index={lightbox.index}
            onIndexChange={(i) => setLightbox((prev) => prev ? { ...prev, index: i } : prev)}
            onClose={() => setLightbox(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ ...evidencePaneFillStyle, flex: "0 0 auto", minHeight: "auto", height: "auto" }}>
      <section style={{ marginBottom: 16, flex: "0 0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div style={{ ...evidenceLabelStyle, marginBottom: 0 }}>{tr("Subtask")}</div>
          {subs.length > 1 && onSubtaskChange && (
            <div style={{ minWidth: 160, maxWidth: 240, flex: "0 1 auto" }}>
              <CustomSelect
                compact
                value={active?.id || ""}
                onChange={onSubtaskChange}
                options={subs.map((s, i) => ({
                  value: s.id,
                  label: `${i + 1}. ${s.title}${s.is_done ? " (done)" : ""}`,
                }))}
              />
            </div>
          )}
        </div>
        <div style={{ ...evidenceValueBoxStyle, fontWeight: 600, lineHeight: 1.4 }}>
          {active?.title || "—"}
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
          <MetaRow label={tr("Status")} value={active?.is_done ? "Done" : "Open"} />
          <MetaRow
            label={tr("Progress")}
            value={`${subs.filter((s) => s.is_done).length}/${subs.length} done`}
          />
          <MetaRow label={tr("Sessions")} value={formatSubtaskSessions(active)} />
          <MetaRow label={tr("Breaks")} value={formatSubtaskBreaks(active)} />
          <MetaRow label={tr("Acharya")} value={acharyaName || "—"} />
          <MetaRow label={tr("Project")} value={projectName || "—"} />
        </div>
      </section>

      <section style={{ flex: "0 0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div style={{ ...evidenceLabelStyle, marginBottom: 0 }}>{tr("Timeline")}</div>
          {sortedEvents.length > 0 ? (
            <SortDirButton
              dir={timelineSort}
              onToggle={() => setTimelineSort((d) => (d === "desc" ? "asc" : "desc"))}
            />
          ) : null}
        </div>
        <div style={{
          ...evidenceValueBoxStyle,
          padding: "4px 12px",
          height: "auto",
          minHeight: 0,
        }}>
          {sortedEvents.length === 0 ? (
            <span style={{ color: "var(--ink-mute)", fontSize: 13 }}>
              {tr("No session activity recorded for this subtask")}
            </span>
          ) : (
            sortedEvents.map((e) => (
              <TimelineEventRow key={e.id} event={e} onPreview={openPreview} />
            ))
          )}
        </div>
      </section>

      {completion ? (
        <section style={{ flex: "0 0 auto", marginTop: 16 }}>
          <div style={evidenceLabelStyle}>{tr("Task completion")}</div>
          <div style={{ ...evidenceValueBoxStyle, padding: "4px 12px" }}>
            <TimelineEventRow event={completion} onPreview={openPreview} />
          </div>
        </section>
      ) : null}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndexChange={(i) => setLightbox((prev) => prev ? { ...prev, index: i } : prev)}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
