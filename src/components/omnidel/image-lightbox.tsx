"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTr } from "@/lib/client/language";

export interface LightboxImage {
  src: string;
  alt: string;
}

/**
 * Full-screen image preview. Dismiss via backdrop click, the Close button, or
 * Escape. When given multiple `images`, prev/next controls (and ←/→ keys) page
 * through them; pass a single `src`/`alt` for the classic one-image case.
 *
 * The keydown listener is registered in the CAPTURE phase and calls
 * stopPropagation, so Escape closes ONLY the lightbox — a parent modal's own
 * (bubble-phase) Escape handler never sees it and stays mounted underneath.
 */
export function ImageLightbox({
  src,
  alt,
  caption,
  images,
  index = 0,
  onIndexChange,
  onClose,
}: {
  src?: string;
  alt?: string;
  caption?: string;
  images?: LightboxImage[];
  index?: number;
  onIndexChange?: (next: number) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const list: LightboxImage[] =
    images && images.length > 0 ? images : src ? [{ src, alt: alt || "" }] : [];
  const safeIdx = Math.min(Math.max(index, 0), Math.max(0, list.length - 1));
  const current = list[safeIdx];
  const multi = list.length > 1;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (delta: number) => {
      if (!multi || !onIndexChange) return;
      onIndexChange((safeIdx + delta + list.length) % list.length);
    },
    [multi, onIndexChange, safeIdx, list.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        go(-1);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, go]);

  if (!current || !mounted) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr("Image preview")}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(35, 29, 20, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <button type="button" onClick={onClose} style={closeBtnStyle}>
        {tr("Close")}
      </button>

      {multi && (
        <button
          type="button"
          aria-label={tr("Previous image")}
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          style={{ ...navBtnStyle, left: 20 }}
        >
          ‹
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          maxWidth: "min(96vw, 1100px)",
        }}
      >
        {caption ? (
          <div
            style={{
              alignSelf: "stretch",
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--surface)",
              lineHeight: 1.45,
              textAlign: "left",
            }}
          >
            {caption}
          </div>
        ) : null}
        <img
          src={current.src}
          alt={current.alt}
          style={{
            maxWidth: "100%",
            maxHeight: caption ? "82vh" : "90vh",
            objectFit: "contain",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            cursor: "zoom-in",
          }}
        />
      </div>

      {multi && (
        <button
          type="button"
          aria-label={tr("Next image")}
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          style={{ ...navBtnStyle, right: 20 }}
        >
          ›
        </button>
      )}

      {multi && (
        <div style={counterStyle}>
          {safeIdx + 1} / {list.length}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}

const closeBtnStyle: CSSProperties = {
  position: "absolute",
  top: 20,
  right: 24,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  color: "var(--ink)",
};

const navBtnStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  lineHeight: 1,
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "50%",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  color: "var(--ink)",
};

const counterStyle: CSSProperties = {
  position: "absolute",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  padding: "4px 12px",
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "var(--surface)",
  background: "rgba(0,0,0,0.4)",
  borderRadius: "var(--r-sm)",
};
