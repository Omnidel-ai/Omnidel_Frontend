"use client";

/**
 * Attaches a Daily MediaStreamTrack to a <video>. Nothing more.
 *
 * A track is not a `src` — it has to be wrapped in a MediaStream and assigned to
 * `srcObject`, and re-assigned whenever the track changes (Daily swaps it on
 * reconnect). Kept apart from the header so the header stays a layout component
 * and this stays the one place that touches media plumbing.
 */

import { useEffect, useRef, type CSSProperties } from "react";

export default function TavusVideoTile({
  track,
  style,
  objectPosition,
}: {
  track: MediaStreamTrack | null;
  style?: CSSProperties;
  objectPosition?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!track) {
      el.srcObject = null;
      return;
    }
    el.srcObject = new MediaStream([track]);
    // Muted ON PURPOSE, and it does not cost us the voice: the PAL's audio is a
    // SEPARATE track played by TavusReplicaAudio in the provider. Muting here is
    // what lets the video autoplay under browser policy, and it also prevents
    // double audio when several surfaces render the same feed.
    void el.play().catch(() => {
      /* a paused first frame is better than a thrown error */
    });
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: objectPosition ?? "center 30%",
        display: "block",
        background: "#14110c",
        ...style,
      }}
    />
  );
}
