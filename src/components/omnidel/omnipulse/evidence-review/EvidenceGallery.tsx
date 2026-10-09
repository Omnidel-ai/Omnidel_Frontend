"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ImageLightbox } from "@/components/omnidel/image-lightbox";
import { blobViewUrl } from "@/lib/client/blob-url";
import { kindLabel } from "./format";
import { evidenceLabelStyle } from "./types";
import { useTr } from "@/lib/client/language";

export interface GalleryImage {
  blob_url: string;
  src: string;
  kind: string;
  update_context?: string | null;
  alt: string;
  subtask_id: string | null;
  subtask_title: string | null;
}

export function EvidenceGallery({
  images,
  isNarrow,
  emptyLabel = "No images submitted",
}: {
  images: GalleryImage[];
  isNarrow: boolean;
  emptyLabel?: string;
}) {
  const tr = useTr();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());

  const imageKey = images.map((i) => i.blob_url).join("|");

  useEffect(() => {
    setCarouselIndex(0);
    setFailedSrcs(new Set());
  }, [imageKey]);

  useEffect(() => {
    if (carouselIndex >= images.length && images.length > 0) {
      setCarouselIndex(0);
    }
  }, [images.length, carouselIndex]);

  const activeImage = images[carouselIndex] || null;
  const imageTitle = activeImage?.subtask_title || activeImage?.alt || "Evidence";
  const activeFailed = activeImage ? failedSrcs.has(activeImage.src) : false;

  const setCarouselTo = (next: number) => {
    if (next === carouselIndex) return;
    setCarouselIndex(next);
  };

  const markFailed = (src: string) => {
    setFailedSrcs((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
      overflow: "hidden",
    }}>
      <div style={{ flex: "0 0 auto", marginBottom: 6 }}>
        <div style={{ ...evidenceLabelStyle, marginBottom: 0 }}>
          {tr("Images (")}{images.length})
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          flex: "1 1 0%",
          minHeight: isNarrow ? 200 : 220,
          marginBottom: 8,
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--rule)",
          background: "var(--surface-sunk)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {activeImage ? (
          <>
            <div style={{
              flex: "0 0 auto",
              padding: "6px 10px",
              borderBottom: "1px solid var(--rule)",
              background: "var(--surface)",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink)",
                fontFamily: "var(--sans)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {imageTitle}
              </span>
              <span style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-mute)",
                flexShrink: 0,
              }}>
                {kindLabel(activeImage.kind, activeImage.update_context)}
                {images.length > 1 ? ` · ${carouselIndex + 1}/${images.length}` : ""}
              </span>
            </div>
            {activeFailed ? (
              <ImageLoadError
                src={activeImage.src}
                layout="main"
              />
            ) : (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                title={tr("Click to preview")}
                aria-label={tr("Open image preview")}
                style={{
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "zoom-in",
                  flex: "1 1 0%",
                  minHeight: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeImage.src}
                  alt={imageTitle}
                  onError={() => markFailed(activeImage.src)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </button>
            )}
          </>
        ) : (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink-mute)",
            fontSize: 13,
            fontFamily: "var(--sans)",
          }}>
            {emptyLabel}
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label={tr("Previous image")}
              onClick={() => setCarouselTo((carouselIndex - 1 + images.length) % images.length)}
              style={{ ...carouselArrowStyle(false), left: 10 }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={tr("Next image")}
              onClick={() => setCarouselTo((carouselIndex + 1) % images.length)}
              style={{ ...carouselArrowStyle(false), right: 10 }}
            >
              ›
            </button>
          </>
        )}
      </div>

      {images.length > 0 && (
        <div
          className="themed-scroll-x"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
            flex: "0 0 auto",
          }}
        >
          {images.map((img, index) => {
            const isActive = index === carouselIndex;
            const thumbLabel = img.subtask_title || kindLabel(img.kind, img.update_context);
            const thumbFailed = failedSrcs.has(img.src);
            return (
              <button
                key={img.blob_url}
                type="button"
                onClick={() => setCarouselTo(index)}
                title={thumbLabel}
                aria-label={`${thumbLabel}, image ${index + 1}`}
                aria-pressed={isActive}
                style={{
                  width: 68,
                  flexShrink: 0,
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{
                  width: "100%",
                  height: 56,
                  borderRadius: "var(--r-sm)",
                  border: `2px solid ${isActive ? "var(--green-deep)" : "var(--rule)"}`,
                  overflow: "hidden",
                  background: "var(--surface-sunk)",
                  boxShadow: isActive ? "0 0 0 2px var(--green-wash)" : "none",
                }}>
                  {thumbFailed ? (
                    <ImageLoadError src={img.src} layout="thumb" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img.src}
                      alt=""
                      onError={() => markFailed(img.src)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
                <div style={{
                  marginTop: 3,
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.02em",
                  color: isActive ? "var(--green-deep)" : "var(--ink-mute)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}>
                  {thumbLabel}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {lightboxOpen && images.length > 0 && !activeFailed && (
        <ImageLightbox
          images={images.map((img) => ({ src: img.src, alt: img.alt }))}
          index={Math.min(carouselIndex, images.length - 1)}
          onIndexChange={setCarouselIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

export function resolveGalleryImages(
  images: Array<{
    blob_url: string;
    kind?: string;
    update_context?: string | null;
    subtask_id?: string | null;
    subtask_title?: string | null;
  }>,
): GalleryImage[] {
  const out: GalleryImage[] = [];
  for (const img of images) {
    const src = blobViewUrl(img.blob_url);
    if (!src) continue;
    if (out.some((x) => x.blob_url === img.blob_url)) continue;
    const title = img.subtask_title?.trim() || "Task (no subtask)";
    out.push({
      blob_url: img.blob_url,
      src,
      kind: img.kind || "image",
      update_context: img.update_context ?? null,
      alt: title,
      subtask_id: img.subtask_id ?? null,
      subtask_title: title,
    });
  }
  return out;
}

function ImageLoadError({
  src,
  layout,
}: {
  src: string;
  layout: "main" | "thumb";
}) {
  const tr = useTr();
  if (layout === "thumb") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-mute)",
          background: "var(--surface-sunk)",
        }}
        aria-label={tr("Image failed to load")}
      >
        !
      </div>
    );
  }

  return (
    <div
      style={{
        flex: "1 1 0%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 16,
        textAlign: "center",
      }}
      role="status"
    >
      <div style={{
        fontFamily: "var(--sans)",
        fontSize: 13,
        color: "var(--ink-soft)",
      }}>
        {tr("Couldn't load image")}
      </div>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--green-deep)",
          textDecoration: "underline",
        }}
      >
        {tr("Open proxy URL")}
      </a>
    </div>
  );
}

function carouselArrowStyle(disabled: boolean): CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid var(--rule-strong)",
    background: "color-mix(in srgb, var(--surface) 88%, transparent)",
    color: "var(--green-deep)",
    fontSize: 22,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0 : 1,
    pointerEvents: disabled ? "none" : "auto",
    padding: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
  };
}
