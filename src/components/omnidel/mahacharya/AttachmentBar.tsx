"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { emitToast } from "@/components/omnidel/toaster";
import { useTr } from "@/lib/client/language";

export type UiAttachment = {
  id: string;
  filename: string;
  mime?: string | null;
  /** Present after upload; absent on attachments parsed from chat history. */
  extract_status?: "ok" | "truncated";
  /** Server preview path for images, or a temporary blob: URL. */
  previewUrl?: string | null;
};

export const MAX_DOCS = 10;
const ACCEPT =
  ".pdf,.docx,.txt,.md,.csv,.json,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json,image/jpeg,image/png,image/webp";

const EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv", "json", "jpg", "jpeg", "png", "webp"]);

const SUPPORTED_HINT = "Use PDF, DOCX, TXT, MD, CSV, JSON, JPG, PNG, or WEBP.";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

function isAllowedDocFile(file: File): boolean {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return EXTENSIONS.has(ext);
}

export function isImageAttachment(a: Pick<UiAttachment, "mime" | "filename" | "previewUrl">): boolean {
  const mime = (a.mime || "").split(";")[0].trim().toLowerCase();
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" || mime === "image/jpg") {
    return true;
  }
  const ext = (a.filename.split(".").pop() || "").toLowerCase();
  return IMAGE_EXTS.has(ext);
}

export function filterAllowedDocFiles(files: File[]): File[] {
  return files.filter(isAllowedDocFile);
}

export function partitionDocFiles(files: File[]): { allowed: File[]; rejected: File[] } {
  const allowed: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (isAllowedDocFile(file)) allowed.push(file);
    else rejected.push(file);
  }
  return { allowed, rejected };
}

export function toastUnsupportedFiles(rejected: File[]): void {
  if (rejected.length === 0) return;
  const names = rejected.map((f) => f.name).join(", ");
  emitToast(
    rejected.length === 1
      ? `Unsupported file: ${names}. ${SUPPORTED_HINT}`
      : `Unsupported files: ${names}. ${SUPPORTED_HINT}`,
  );
}

export function toastDocLimitReached(): void {
  emitToast(`You can attach at most ${MAX_DOCS} documents at a time in this chat. Remove one first.`);
}

export const DOC_CHUNK_BYTES = 512 * 1024;

export type UploadedDocMeta = UiAttachment;

/**
 * Upload a document in chunks to the server, then finalize so extracted text
 * is stored in DB before chat can use it. Chat always reads attachments from
 * the server — never from client memory alone.
 */
export async function uploadDocInChunks(
  file: File,
  conversationId: string | null | undefined,
): Promise<{ item: UploadedDocMeta; conversationId: string }> {
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.max(1, Math.ceil(file.size / DOC_CHUNK_BYTES));

  for (let i = 0; i < totalChunks; i++) {
    const start = i * DOC_CHUNK_BYTES;
    const end = Math.min(start + DOC_CHUNK_BYTES, file.size);
    const chunkBlob = file.slice(start, end);
    const fd = new FormData();
    fd.append("phase", "chunk");
    fd.append("uploadId", uploadId);
    fd.append("chunkIndex", String(i));
    fd.append("totalChunks", String(totalChunks));
    fd.append("chunk", chunkBlob, `chunk-${i}`);
    const res = await fetch("/api/mahacharya/attachments/chunk", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Chunk upload failed");
  }

  const complete = new FormData();
  complete.append("phase", "complete");
  complete.append("uploadId", uploadId);
  complete.append("totalChunks", String(totalChunks));
  complete.append("filename", file.name || "document");
  complete.append("sizeBytes", String(file.size));
  complete.append("mime", file.type || "");
  if (conversationId) complete.append("conversationId", conversationId);

  const res = await fetch("/api/mahacharya/attachments/chunk", { method: "POST", body: complete });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Upload failed");
  if (!j.item || !j.conversationId) throw new Error("Upload failed");
  return { item: j.item as UploadedDocMeta, conversationId: j.conversationId as string };
}

/** Paperclip button — height matches the single-line composer row (Send / textarea). */
export function AttachButton({
  disabled,
  full,
  onPickFiles,
  currentCount,
}: {
  disabled: boolean;
  full: boolean;
  currentCount: number;
  onPickFiles: (files: File[]) => void;
}) {
  const tr = useTr();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          const { allowed, rejected } = partitionDocFiles(picked);
          toastUnsupportedFiles(rejected);
          if (full) {
            toastDocLimitReached();
            e.target.value = "";
            return;
          }
          const room = MAX_DOCS - currentCount;
          if (allowed.length > room) {
            if (room <= 0) toastDocLimitReached();
            else emitToast(`Only ${room} more document${room === 1 ? "" : "s"} can be added.`);
          }
          const batch = allowed.slice(0, room);
          if (batch.length) onPickFiles(batch);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title={full ? `Limit of ${MAX_DOCS} documents reached` : "Attach documents (or drag and drop)"}
        aria-label={tr("Attach documents")}
        disabled={disabled || full}
        onClick={() => inputRef.current?.click()}
        style={{
          ...attachButtonStyle,
          opacity: disabled || full ? 0.5 : 1,
          cursor: disabled || full ? "not-allowed" : "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
    </>
  );
}

function fileExtLabel(filename: string): string {
  const ext = (filename.split(".").pop() || "file").toUpperCase();
  return ext.slice(0, 4);
}

/** ChatGPT-style attachment row: image thumbnails + file tiles, with lightbox. */
export function AttachmentChipList({
  attachments,
  disabled,
  onRemove,
}: {
  attachments: UiAttachment[];
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  const tr = useTr();
  const [preview, setPreview] = useState<UiAttachment | null>(null);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  if (attachments.length === 0) return null;

  const previewSrc =
    preview && isImageAttachment(preview)
      ? preview.previewUrl || `/api/mahacharya/attachments/${preview.id}`
      : null;

  return (
    <>
      <div style={thumbRailStyle}>
        <div className="themed-scroll-x" style={thumbRowStyle}>
          {attachments.map((a) => {
            const image = isImageAttachment(a);
            const src = a.previewUrl || (image ? `/api/mahacharya/attachments/${a.id}` : null);
            return (
              <div key={a.id} style={thumbWrapStyle}>
                {image && src ? (
                  <button
                    type="button"
                    style={thumbBtnStyle}
                    title={a.filename}
                    aria-label={`Preview ${a.filename}`}
                    onClick={() => setPreview(a)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={a.filename} style={thumbImgStyle} />
                  </button>
                ) : (
                  <div style={fileTileStyle} title={a.filename}>
                    <span style={fileExtStyle}>{fileExtLabel(a.filename)}</span>
                    <span style={fileNameStyle}>{a.filename}</span>
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${a.filename}`}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(a.id);
                    if (preview?.id === a.id) setPreview(null);
                  }}
                  style={{
                    ...thumbRemoveStyle,
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        <span style={countStyle}>
          {attachments.length}/{MAX_DOCS}
        </span>
      </div>

      {previewSrc && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal
              aria-label={`Preview ${preview?.filename ?? "image"}`}
              style={lightboxOverlayStyle}
              onClick={() => setPreview(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt={preview?.filename ?? ""}
                style={lightboxImgStyle}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                aria-label={tr("Close preview")}
                onClick={() => setPreview(null)}
                style={lightboxCloseStyle}
              >
                ×
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function AttachmentUploadingBanner({ show }: { show: boolean }) {
  const tr = useTr();
  if (!show) return null;
  return (
    <div style={uploadingBannerStyle} aria-live="polite">
      {tr("Uploading document…")}
    </div>
  );
}

/** Compact attachment grid inside a sent user bubble (ChatGPT-style). */
export function MessageAttachmentsBubble({
  attachments,
}: {
  attachments: Array<Pick<UiAttachment, "id" | "filename" | "mime" | "previewUrl">>;
}) {
  const tr = useTr();
  const [preview, setPreview] = useState<UiAttachment | null>(null);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  if (attachments.length === 0) return null;

  const previewSrc =
    preview && isImageAttachment(preview)
      ? preview.previewUrl || `/api/mahacharya/attachments/${preview.id}`
      : null;

  return (
    <>
      <div style={bubbleGridStyle}>
        {attachments.map((a) => {
          const image = isImageAttachment(a);
          const src = a.previewUrl || (image ? `/api/mahacharya/attachments/${a.id}` : null);
          if (image && src) {
            return (
              <button
                key={a.id}
                type="button"
                title={a.filename}
                aria-label={`Preview ${a.filename}`}
                onClick={() => setPreview(a)}
                style={bubbleThumbBtnStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={a.filename} style={thumbImgStyle} />
              </button>
            );
          }
          return (
            <div key={a.id} style={bubbleFileTileStyle} title={a.filename}>
              <span style={bubbleFileExtStyle}>{fileExtLabel(a.filename)}</span>
              <span style={bubbleFileNameStyle}>{a.filename}</span>
            </div>
          );
        })}
      </div>
      {previewSrc && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal
              aria-label={`Preview ${preview?.filename ?? "image"}`}
              style={lightboxOverlayStyle}
              onClick={() => setPreview(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt={preview?.filename ?? ""}
                style={lightboxImgStyle}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                aria-label={tr("Close preview")}
                onClick={() => setPreview(null)}
                style={lightboxCloseStyle}
              >
                ×
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const attachButtonStyle: CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 37,
  height: 37,
  padding: 0,
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface)",
  color: "var(--ink-soft)",
};

const thumbRailStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const thumbRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "nowrap",
  alignItems: "flex-start",
  gap: 10,
  overflowX: "auto",
  overflowY: "hidden",
  // Room for remove badges above tiles + OmniDel themed scrollbar below.
  padding: "8px 4px 10px 2px",
  WebkitOverflowScrolling: "touch",
};

const thumbWrapStyle: CSSProperties = {
  position: "relative",
  flex: "0 0 auto",
  width: 72,
  height: 72,
};

const thumbBtnStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  padding: 0,
  border: "1px solid var(--rule)",
  borderRadius: 12,
  overflow: "hidden",
  background: "var(--surface-sunk)",
  cursor: "zoom-in",
};

const thumbImgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const fileTileStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  height: "100%",
  padding: 8,
  borderRadius: 12,
  border: "1px solid var(--rule)",
  background: "var(--surface-sunk)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  gap: 4,
  overflow: "hidden",
};

const fileExtStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 600,
  color: "var(--ink-mute)",
  letterSpacing: 0.4,
};

const fileNameStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 10,
  lineHeight: 1.2,
  color: "var(--ink-soft)",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  wordBreak: "break-all",
};

const thumbRemoveStyle: CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  border: "1px solid var(--rule)",
  background: "var(--page)",
  color: "var(--ink)",
  boxShadow: "var(--shadow-md)",
  padding: 0,
  zIndex: 1,
};

const countStyle: CSSProperties = {
  alignSelf: "flex-end",
  fontSize: 11,
  color: "var(--ink-mute)",
  paddingRight: 2,
};

const lightboxOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 4000,
  background: "rgba(0,0,0,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const lightboxImgStyle: CSSProperties = {
  maxWidth: "min(920px, 92vw)",
  maxHeight: "88vh",
  objectFit: "contain",
  borderRadius: 12,
  boxShadow: "var(--shadow-md)",
  background: "var(--page)",
};

const lightboxCloseStyle: CSSProperties = {
  position: "fixed",
  top: 18,
  right: 22,
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "none",
  background: "rgba(255,255,255,0.92)",
  color: "#111",
  fontSize: 24,
  lineHeight: 1,
  cursor: "pointer",
};

const uploadingBannerStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  borderBottom: "1px solid var(--rule)",
};

const bubbleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 72px)",
  gap: 6,
  marginBottom: 8,
  justifyContent: "end",
};

const bubbleThumbBtnStyle: CSSProperties = {
  width: 72,
  height: 72,
  padding: 0,
  border: "none",
  borderRadius: 10,
  overflow: "hidden",
  background: "rgba(255,255,255,0.12)",
  cursor: "zoom-in",
};

const bubbleFileTileStyle: CSSProperties = {
  boxSizing: "border-box",
  width: 72,
  height: 72,
  padding: 6,
  borderRadius: 10,
  background: "rgba(255,255,255,0.14)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  gap: 2,
  overflow: "hidden",
};

const bubbleFileExtStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 600,
  color: "rgba(255,255,255,0.7)",
  letterSpacing: 0.4,
};

const bubbleFileNameStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 10,
  lineHeight: 1.2,
  color: "rgba(255,255,255,0.95)",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  wordBreak: "break-all",
};
