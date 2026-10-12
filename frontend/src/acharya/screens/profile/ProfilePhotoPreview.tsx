"use client";

import type { CSSProperties } from "react";
import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";

interface Props {
  open: boolean;
  lang: Lang;
  photoUrl: string;
  alt: string;
  onClose: () => void;
}

/** Full-screen lightbox for the current profile portrait. */
export function ProfilePhotoPreview({ open, lang, photoUrl, alt, onClose }: Props) {
  const s = t(lang);
  if (!open) return null;

  return (
    <div
      style={rootStyle}
      aria-modal="true"
      role="dialog"
      aria-label={s.previewPhoto}
    >
      <button
        type="button"
        aria-label={s.cancel}
        onClick={onClose}
        className="fade-in"
        style={scrimStyle}
      />
      <button
        type="button"
        aria-label={s.cancel}
        onClick={onClose}
        className="press fade-in"
        style={closeButtonStyle}
      >
        <CloseIcon />
      </button>
      <div className="fade-in" style={frameStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={alt} style={imageStyle} />
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

const rootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 70,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const scrimStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(35, 29, 20, 0.88)",
  border: "none",
  cursor: "pointer",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: "max(env(safe-area-inset-top), 16px)",
  right: 16,
  zIndex: 2,
  width: 40,
  height: 40,
  borderRadius: "50%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "color-mix(in srgb, #f4efdf 25%, transparent)",
  background: "color-mix(in srgb, var(--ink) 35%, transparent)",
  color: "#f4efdf",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const frameStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: "min(92vw, 420px)",
  maxHeight: "min(78vh, 560px)",
  borderRadius: "var(--r-md)",
  overflow: "hidden",
  boxShadow: "var(--shadow-lg)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "color-mix(in srgb, #f4efdf 15%, transparent)",
};

const imageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  maxHeight: "min(78vh, 560px)",
  objectFit: "contain",
  background: "var(--surface-sunk)",
};
