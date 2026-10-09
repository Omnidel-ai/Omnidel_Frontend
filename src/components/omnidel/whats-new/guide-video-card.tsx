"use client";

import type { CSSProperties } from "react";
import { formatDurationLabel, type GuideVideoDto } from "@/lib/guide-schema";
import { useTr } from "@/lib/client/language";

function formatAddedDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GuideVideoCard({
  video,
  watched,
  onOpen,
  onEdit,
  onDelete,
}: {
  video: GuideVideoDto;
  watched: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const tr = useTr();
  const duration = formatDurationLabel(video.durationSec);
  const addedDate = formatAddedDate(video.addedOn);
  const playlists =
    video.playlists?.length
      ? video.playlists
      : video.playlistId
        ? [{ id: video.playlistId, title: "Playlist" }]
        : [];
  const areas =
    video.areas?.length
      ? video.areas
      : video.areaTitle
        ? [{ id: video.areaId ?? video.areaTitle, title: video.areaTitle }]
        : [];
  const summary = video.summary?.trim() || "";
  const facts = [duration, addedDate ? `Added ${addedDate}` : null].filter(Boolean);

  return (
    <div style={shell}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Play ${video.title}`}
        style={playBtn}
      >
        <div style={thumbWrap}>
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnailUrl} alt="" style={thumbImg} />
          ) : (
            <div style={thumbFallback}>{tr("No preview")}</div>
          )}
          {duration ? <span style={durationChip}>{duration}</span> : null}
        </div>
        <div style={cardBody}>
          <div style={titleRow}>
            <div style={cardTitle}>{video.title}</div>
            {watched ? <span style={watchedChip}>{tr("Watched")}</span> : null}
          </div>
          {playlists.length > 0 || areas.length > 0 ? (
            <div style={tagRow}>
              {playlists.map((p) => (
                <span key={`p-${p.id}`} style={playlistChip}>{p.title}</span>
              ))}
              {areas.map((a) => (
                <span key={`a-${a.id}`} style={areaChip}>{a.title}</span>
              ))}
            </div>
          ) : null}
          {facts.length > 0 ? <div style={cardMeta}>{facts.join(" · ")}</div> : null}
          {summary ? <div style={cardSummary}>{summary}</div> : null}
        </div>
      </button>
      {onEdit || onDelete ? (
        <div style={cardActions}>
          {onEdit ? (
            <button type="button" style={editLink} onClick={onEdit}>
              {tr("Edit details")}
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" style={deleteLink} onClick={onDelete}>
              {tr("Delete")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const shell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  textAlign: "left",
  padding: 10,
  gap: 8,
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-md)",
  background: "var(--surface)",
  color: "inherit",
  minWidth: 0,
};

const playBtn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  textAlign: "left",
  padding: 0,
  gap: 12,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "inherit",
  minWidth: 0,
  font: "inherit",
};

const thumbWrap: CSSProperties = {
  position: "relative",
  aspectRatio: "16 / 9",
  background: "var(--surface-sunk)",
  overflow: "hidden",
  borderRadius: "var(--r-sm)",
  flexShrink: 0,
};

const thumbImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const thumbFallback: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  fontFamily: "var(--mono)",
  fontSize: 12,
  color: "var(--ink-mute)",
};

const durationChip: CSSProperties = {
  position: "absolute",
  right: 6,
  bottom: 6,
  fontFamily: "var(--mono)",
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: "var(--r-sm)",
  background: "var(--ink)",
  color: "var(--surface)",
};

const cardBody: CSSProperties = {
  padding: "2px 2px 4px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const titleRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 8,
};

const cardTitle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 16,
  fontWeight: 650,
  color: "var(--ink)",
  lineHeight: 1.35,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  minWidth: 0,
  flex: 1,
};

const watchedChip: CSSProperties = {
  flexShrink: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: "var(--r-sm)",
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  border: "1px solid var(--green-soft)",
};

const tagRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const playlistChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: "var(--r-sm)",
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  border: "1px solid var(--green-soft)",
};

const areaChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 500,
  padding: "3px 8px",
  borderRadius: "var(--r-sm)",
  background: "var(--surface-sunk)",
  color: "var(--ink-soft)",
  border: "1px solid var(--rule)",
};

const cardMeta: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-soft)",
  overflowWrap: "anywhere",
};

const cardSummary: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 400,
  color: "var(--ink-soft)",
  lineHeight: 1.4,
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 2px",
};

const editLink: CSSProperties = {
  alignSelf: "flex-start",
  padding: "2px 0 0",
  border: "none",
  background: "transparent",
  color: "var(--green-deep)",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const deleteLink: CSSProperties = {
  ...editLink,
  color: "var(--crit)",
};
