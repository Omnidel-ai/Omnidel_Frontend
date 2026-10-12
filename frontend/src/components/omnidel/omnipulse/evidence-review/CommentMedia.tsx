"use client";

import { blobViewUrl } from "@/lib/client/blob-url";
import type { EvidenceCommentAttachment } from "./types";

export function CommentMedia({
  attachments,
  onPreview,
}: {
  attachments: EvidenceCommentAttachment[];
  onPreview: (images: Array<{ src: string; alt: string }>, index: number) => void;
}) {
  const images: Array<{ src: string; alt: string; name: string }> = [];
  const files: Array<{ url: string; name: string; type: string }> = [];
  const seen = new Set<string>();

  for (const a of attachments || []) {
    if (!a?.url || seen.has(a.url)) continue;
    seen.add(a.url);
    const src = blobViewUrl(a.url);
    if (!src) continue;
    const isImage = (a.type || "").startsWith("image/") || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(a.url);
    if (isImage) {
      images.push({ src, alt: a.name || "attachment", name: a.name || "image" });
    } else {
      files.push({ url: src, name: a.name || "attachment", type: a.type || "" });
    }
  }

  if (images.length === 0 && files.length === 0) return null;

  return (
    <div style={{ marginTop: 6 }}>
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => onPreview(images.map((x) => ({ src: x.src, alt: x.alt })), i)}
              title={img.name}
              aria-label={`Preview ${img.name}`}
              style={{
                padding: 0,
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-sm)",
                overflow: "hidden",
                background: "var(--surface)",
                cursor: "zoom-in",
                width: 72,
                height: 72,
                flexShrink: 0,
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
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: images.length ? 6 : 0 }}>
          {files.map((f) => (
            <a
              key={f.url}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 8px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--rule)",
                background: "var(--surface)",
                fontSize: 11,
                fontFamily: "var(--sans)",
                color: "var(--ink-soft)",
                textDecoration: "none",
                overflow: "hidden",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
