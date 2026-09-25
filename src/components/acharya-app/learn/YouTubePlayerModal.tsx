"use client";

import { useState } from "react";
import { LearnFullscreenSheet } from "@/components/learn/LearnFullscreenSheet";

interface Props {
  open: boolean;
  videoId: string | null;
  title: string;
  channel?: string;
  onClose: () => void;
}

export function YouTubePlayerModal({ open, videoId, title, channel, onClose }: Props) {
  const [embedFailed, setEmbedFailed] = useState(false);

  const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;

  function handleClose() {
    setEmbedFailed(false);
    onClose();
  }

  return (
    <LearnFullscreenSheet
      open={open && Boolean(videoId)}
      title={title}
      subtitle={channel}
      onClose={handleClose}
      zIndex={70}
    >
      {videoId && !embedFailed ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#000",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
          }}
        >
          <iframe
            key={videoId}
            title={title}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            onError={() => setEmbedFailed(true)}
          />
        </div>
      ) : (
        <div style={{ padding: "24px 8px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--ink-mute)", margin: "0 0 16px", lineHeight: 1.5 }}>
            This video cannot be played inside the app. The owner may have disabled embedding.
          </p>
          {watchUrl ? (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--green-deep)",
              }}
            >
              Open in YouTube app ↗
            </a>
          ) : null}
        </div>
      )}
      <p style={{ fontSize: 11, color: "var(--ink-faint)", margin: "14px 0 0", textAlign: "center" }}>
        Tap × to close — playback stops when you leave
      </p>
    </LearnFullscreenSheet>
  );
}
