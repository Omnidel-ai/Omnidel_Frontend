"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  canRenderAcharyaAvatarUrl,
  toKarigarAvatarUrl,
} from "@/lib/acharya-avatar-url";

interface Props {
  slug?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  initial?: string | null;
  size?: number;
  shape?: "circle" | "rounded";
  alt?: string;
  decorative?: boolean;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
  textStyle?: CSSProperties;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level in-memory cache: avoids duplicate fetches for the same slug/name
// combo across card renders.  Keyed as `${slug}|${name}`.
// Entries are invalidated on image load error so the next mount re-fetches.
// ─────────────────────────────────────────────────────────────────────────────
const avatarCache = new Map<string, string | null>();

export function getAcharyaInitial(name?: string | null, fallback = "A"): string {
  return (name?.trim()?.[0] || fallback).toUpperCase();
}

export default function AcharyaAvatar({
  slug,
  name,
  imageUrl,
  initial,
  size = 28,
  shape = "circle",
  alt,
  decorative = true,
  style,
  imageStyle,
  textStyle,
}: Props) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    () => toKarigarAvatarUrl(imageUrl),
  );
  // Tracks whether the resolved image URL actually loaded — falls back to
  // initial-letter when the URL is broken/expired (prevents broken-image icons).
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolvedUrl(toKarigarAvatarUrl(imageUrl));
    setImgFailed(false); // reset failure state when the prop changes
  }, [imageUrl]);

  useEffect(() => {
    if (imageUrl || (!slug?.trim() && !name?.trim())) return;

    let cancelled = false;
    const cacheKey = `${slug?.trim().toLowerCase() || ""}|${name?.trim().toLowerCase() || ""}`;
    const key = slug?.trim().toLowerCase();
    const cached = avatarCache.get(cacheKey);
    if (cached !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolvedUrl(cached);
      return;
    }

    const params = new URLSearchParams();
    if (key) params.set("slug", key);
    if (name?.trim()) params.set("name", name.trim());

    void fetch(`/api/acharyas/avatar?${params.toString()}`, { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`avatar ${res.status}`);
        const data = (await res.json()) as { avatarUrl?: string | null };
        const url = toKarigarAvatarUrl(data.avatarUrl) || null;
        avatarCache.set(cacheKey, url);
        if (!cancelled) setResolvedUrl(url);
      })
      .catch(() => {
        avatarCache.set(cacheKey, null);
        if (!cancelled) setResolvedUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, slug, name]);

  const resolvedInitial = initial || getAcharyaInitial(name);
  const radius = shape === "circle" ? "50%" : 14;

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: "hidden",
    background: "var(--color-accent-soft)",
    color: "var(--color-accent-deep)",
    // Longhands so callers can override borderColor without mixing shorthand.
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--rule)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...style,
  };

  // Absolute public URLs, or same-origin karigar proxy for OmniDel private blobs.
  const renderUrl = canRenderAcharyaAvatarUrl(resolvedUrl) ? resolvedUrl : null;

  if (renderUrl && !imgFailed) {
    return (
      <span style={baseStyle} aria-hidden={decorative || undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={renderUrl}
          alt={decorative ? "" : alt || `${name || "Acharya"} avatar`}
          width={size}
          height={size}
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover", ...imageStyle }}
          onError={() => {
            // URL is broken or unreachable — fall back to initial letter.
            // Clears the cache entry so the next mount re-fetches.
            const cacheKey = `${slug?.trim().toLowerCase() || ""}|${name?.trim().toLowerCase() || ""}`;
            avatarCache.delete(cacheKey);
            setImgFailed(true);
          }}
        />
      </span>
    );
  }

  return (
    <span style={baseStyle} aria-hidden={decorative || undefined}>
      <span
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: Math.max(12, Math.round(size * 0.46)),
          lineHeight: 1,
          ...imageStyle,
          ...textStyle,
        }}
      >
        {resolvedInitial}
      </span>
    </span>
  );
}
