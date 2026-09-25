"use client";

import Image from "next/image";
import { LearnFullscreenSheet } from "@/components/learn/LearnFullscreenSheet";
import { extractYouTubeId, youtubeThumbnailUrl } from "@/lib/youtube";

export interface VideoPickItem {
  title: string;
  youtubeUrl: string;
  channel?: string;
  thumbnail?: string;
}

interface Props {
  open: boolean;
  videos: VideoPickItem[];
  searchQuery?: string;
  fallbackSearchUrl?: string;
  onClose: () => void;
  onPlay: (video: { id: string; title: string; channel?: string }) => void;
}

function thumbFor(video: VideoPickItem): string | undefined {
  if (video.thumbnail) return video.thumbnail;
  const id = extractYouTubeId(video.youtubeUrl);
  return id ? youtubeThumbnailUrl(id) : undefined;
}

export function VideoPickListModal({
  open,
  videos,
  searchQuery,
  fallbackSearchUrl,
  onClose,
  onPlay,
}: Props) {
  return (
    <LearnFullscreenSheet
      open={open}
      title="Pick a tutorial"
      subtitle={searchQuery ? `Matched to: ${searchQuery}` : undefined}
      onClose={onClose}
    >
      {videos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 8px" }}>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "0 0 12px" }}>
            No suggested videos loaded yet.
          </p>
          {fallbackSearchUrl ? (
            <a
              href={fallbackSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 700, color: "var(--green-deep)" }}
            >
              Search on YouTube ↗
            </a>
          ) : null}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {videos.map((video, i) => {
            const id = extractYouTubeId(video.youtubeUrl);
            if (!id) return null;
            const thumb = thumbFor(video);
            return (
              <li key={`${video.youtubeUrl}-${i}`}>
                <button
                  type="button"
                  className="press"
                  onClick={() => onPlay({ id, title: video.title, channel: video.channel })}
                  style={{
                    display: "flex",
                    gap: 12,
                    width: "100%",
                    textAlign: "left",
                    padding: 0,
                    border: "1px solid var(--rule)",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface)",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 120,
                      flexShrink: 0,
                      aspectRatio: "16 / 9",
                      background: "#111",
                    }}
                  >
                    {thumb ? (
                      <Image src={thumb} alt="" fill unoptimized style={{ objectFit: "cover" }} />
                    ) : null}
                  </div>
                  <div style={{ padding: "10px 12px 10px 0", flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--ink)",
                        margin: "0 0 4px",
                        lineHeight: 1.35,
                      }}
                    >
                      {video.title}
                    </p>
                    {video.channel ? (
                      <p style={{ fontSize: 11, color: "var(--ink-mute)", margin: "0 0 6px" }}>{video.channel}</p>
                    ) : null}
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green-deep)" }}>Play here</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </LearnFullscreenSheet>
  );
}
