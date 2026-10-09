"use client";

import { useState } from "react";

export function WorkerAvatar({
  photoUrl,
  name,
  size = 28,
}: {
  photoUrl: string | null;
  name: string | null;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();
  const letterStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    background: "var(--green-wash)",
    color: "var(--green-deep)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: Math.max(10, Math.round(size * 0.42)),
    fontWeight: 600,
  };

  if (!photoUrl || imgFailed) {
    return <span style={letterStyle}>{initial}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt=""
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      onError={() => setImgFailed(true)}
    />
  );
}
