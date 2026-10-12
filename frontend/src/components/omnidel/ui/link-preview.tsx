"use client";

import { useEffect, useState, type CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// LinkPreview — Trello-style card under a comment, populated via the
// /api/link-preview proxy. Renders a skeleton while loading, hides itself if
// the preview is empty (no title + no image), and falls back to a hostname-
// only card when only the URL is available.
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewPayload {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  hostname: string;
  fetchedAt: number;
}

// Client-side cache so re-renders / multiple cards on the same URL don't
// trigger redundant fetches. Keyed by URL; survives until tab close.
const previewCache = new Map<string, PreviewPayload>();

export function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<PreviewPayload | null>(() => previewCache.get(url) || null);
  const [loading, setLoading] = useState(!previewCache.has(url));
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (previewCache.has(url)) {
      setData(previewCache.get(url) || null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setErrored(false);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("preview failed"))))
      .then((d) => {
        if (!alive) return;
        const payload: PreviewPayload = d.item;
        previewCache.set(url, payload);
        setData(payload);
      })
      .catch(() => { if (alive) setErrored(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [url]);

  // Hide entirely when nothing useful surfaced and there's no image — the
  // markdown link itself is enough.
  const hasContent = !!(data && (data.title || data.description || data.image));
  if (errored && !hasContent) return null;

  if (loading) {
    return (
      <div style={cardStyle} aria-busy="true">
        <div style={{ ...thumbStyle, background: "var(--surface-sunk)" }} />
        <div style={bodyStyle}>
          <div style={{ ...skeletonLine, width: "60%" }} />
          <div style={{ ...skeletonLine, width: "90%" }} />
          <div style={{ ...skeletonLine, width: "30%", marginTop: 6 }} />
        </div>
      </div>
    );
  }

  if (!data) return null;
  const fallbackHost = data.hostname || tryHostname(data.url);

  return (
    <a
      href={data.finalUrl || data.url}
      target="_blank"
      rel="noreferrer noopener"
      style={cardStyle}
    >
      {data.image ? (
        // Falling back to <img> instead of next/image — the preview source is
        // unknown (any external host) and next/image's domain allowlist would
        // reject most of them. Lazy-load + decoupled error handler so a 404
        // doesn't break the layout.
        <img
          src={data.image}
          alt=""
          style={thumbStyle}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div style={{ ...thumbStyle, background: "var(--surface-sunk)" }} />
      )}
      <div style={bodyStyle}>
        <div style={titleStyle}>{data.title || fallbackHost}</div>
        {data.description && (
          <div style={descStyle}>{data.description}</div>
        )}
        <div style={hostStyle}>{(data.siteName ? `${data.siteName} · ` : "") + fallbackHost}</div>
      </div>
    </a>
  );
}

function tryHostname(raw: string): string {
  try { return new URL(raw).hostname; } catch { return raw; }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 8,
  padding: 8,
  background: "var(--surface-sunk)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  textDecoration: "none",
  color: "inherit",
  alignItems: "stretch",
  minWidth: 0,
};

const thumbStyle: CSSProperties = {
  width: 64, height: 64, flexShrink: 0,
  objectFit: "cover",
  borderRadius: "var(--r-sm)",
  background: "var(--rule)",
};

const bodyStyle: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 2,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600,
  color: "var(--ink)",
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const descStyle: CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 12,
  color: "var(--ink-soft)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const hostStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10,
  color: "var(--ink-mute)",
  textTransform: "lowercase",
};

const skeletonLine: CSSProperties = {
  height: 10,
  background: "var(--rule)",
  borderRadius: 3,
  marginBottom: 4,
};
