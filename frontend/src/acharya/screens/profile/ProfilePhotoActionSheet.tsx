"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";

interface Props {
  open: boolean;
  lang: Lang;
  hasPhoto: boolean;
  busy?: boolean;
  onClose: () => void;
  onPreview: () => void;
  onRemove: () => void;
  onTakePhoto: () => void;
  onChooseGallery: () => void;
}

/**
 * Bottom sheet — avatar tap options: Preview, Remove, Take photo, Choose from gallery.
 */
export function ProfilePhotoActionSheet({
  open,
  lang,
  hasPhoto,
  busy = false,
  onClose,
  onPreview,
  onRemove,
  onTakePhoto,
  onChooseGallery,
}: Props) {
  const s = t(lang);
  if (!open) return null;

  return (
    <div
      style={rootStyle}
      aria-modal="true"
      role="dialog"
      aria-label={s.photoOptions}
    >
      <button
        type="button"
        aria-label={s.cancel}
        onClick={onClose}
        disabled={busy}
        className="fade-in"
        style={scrimStyle}
      />
      <div className="slide-up" style={sheetStyle}>
        <div style={handleWrapStyle}>
          <div style={handleStyle} />
        </div>
        <div style={headerStyle}>
          <p style={eyebrowStyle}>{s.photoSection}</p>
          <h2 style={titleStyle}>{s.photoOptions}</h2>
        </div>
        <div style={actionsStyle}>
          {hasPhoto ? (
            <>
              <ActionRow
                label={s.previewPhoto}
                onClick={onPreview}
                disabled={busy}
                icon={<EyeIcon />}
              />
              <ActionRow
                label={s.removePhoto}
                onClick={onRemove}
                disabled={busy}
                tone="danger"
                icon={<TrashIcon />}
              />
            </>
          ) : null}
          <ActionRow
            label={s.takePhoto}
            onClick={onTakePhoto}
            disabled={busy}
            tone="primary"
            icon={<CameraIcon />}
          />
          <ActionRow
            label={s.chooseFromGallery}
            onClick={onChooseGallery}
            disabled={busy}
            icon={<GalleryIcon />}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="press"
          style={cancelButtonStyle}
        >
          {s.cancel}
        </button>
      </div>
    </div>
  );
}

function ActionRow({
  label, onClick, disabled, tone = "default", icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
  icon: ReactNode;
}) {
  const isPrimary = tone === "primary";
  const isDanger = tone === "danger";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        ...actionRowStyle,
        ...(isPrimary ? actionRowPrimaryStyle : null),
        ...(isDanger ? actionRowDangerStyle : null),
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span style={{
        ...actionIconWrapStyle,
        ...(isPrimary ? actionIconPrimaryStyle : null),
        ...(isDanger ? actionIconDangerStyle : null),
      }}>
        {icon}
      </span>
      <span style={{
        ...actionLabelStyle,
        ...(isPrimary ? actionLabelPrimaryStyle : null),
        ...(isDanger ? actionLabelDangerStyle : null),
      }}>
        {label}
      </span>
    </button>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

const rootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
};

const scrimStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(35, 29, 20, 0.52)",
  border: "none",
  cursor: "pointer",
  backdropFilter: "blur(3px)",
  WebkitBackdropFilter: "blur(3px)",
};

const sheetStyle: CSSProperties = {
  position: "relative",
  background: "var(--surface)",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  borderTop: "1px solid var(--rule)",
  paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
  boxShadow: "var(--shadow-lg)",
};

const handleWrapStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  paddingTop: 12,
  paddingBottom: 6,
};

const handleStyle: CSSProperties = {
  width: 40,
  height: 4,
  borderRadius: 9999,
  background: "var(--rule-strong)",
};

const headerStyle: CSSProperties = {
  padding: "6px 20px 14px",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--ochre)",
  margin: 0,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 19,
  fontWeight: 400,
  color: "var(--ink)",
  margin: "5px 0 0",
  lineHeight: 1.25,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "0 16px 12px",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  padding: "14px 14px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface-sunk)",
  textAlign: "left",
};

const actionRowPrimaryStyle: CSSProperties = {
  background: "var(--green-wash)",
  borderColor: "color-mix(in srgb, var(--green-deep) 25%, var(--rule))",
};

const actionRowDangerStyle: CSSProperties = {
  background: "var(--crit-wash)",
  borderColor: "color-mix(in srgb, var(--crit) 20%, var(--rule))",
};

const actionIconWrapStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: "var(--surface)",
  color: "var(--ink-soft)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
};

const actionIconPrimaryStyle: CSSProperties = {
  background: "var(--green-deep)",
  color: "#f4efdf",
  borderColor: "var(--green-deep)",
};

const actionIconDangerStyle: CSSProperties = {
  color: "var(--crit)",
  borderColor: "color-mix(in srgb, var(--crit) 30%, var(--rule))",
};

const actionLabelStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ink)",
  fontFamily: "var(--font-sans)",
};

const actionLabelPrimaryStyle: CSSProperties = {
  color: "var(--green-deep)",
};

const actionLabelDangerStyle: CSSProperties = {
  color: "var(--crit)",
};

const cancelButtonStyle: CSSProperties = {
  display: "block",
  width: "calc(100% - 32px)",
  margin: "0 16px",
  padding: "14px 16px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "transparent",
  color: "var(--ink-mute)",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
