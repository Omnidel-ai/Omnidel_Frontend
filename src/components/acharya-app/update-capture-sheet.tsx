"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { MAX_IMAGE_BYTES, MAX_IMAGE_MB, fitWithinLimit, formatMb, needsReencoding } from "@/lib/image-intake";
import { ProofConversationMic } from "@/components/voice/ProofConversationMic";
import { useProofVoiceAssist } from "@/hooks/useProofVoiceAssist";
import { useStrings } from "@/lib/i18n/useLang";

/**
 * UpdateCaptureSheet
 *
 * Bottom-sheet modal for submitting a break/session artifact.
 * Two tabs: IMAGE | TEXT.
 *
 * On submit:
 *   - Session/subtask end requires ≥1 image proof (up to 5) and text.
 *   - Break updates allow 0–5 images; text optional (pause without proof OK).
 *
 * The parent (active page) handles the actual API call to
 * /api/work/tasks/[id]/attempts/[attemptId]/updates so this component stays
 * focused on capture + upload only.
 *
 * When opened under AcharyaShell, a mic control talks to the same Gemini Live
 * Acharya so they can coach Text/Image tabs (user still taps Submit).
 */

type TabKey = "image" | "text";

export const MAX_PROOF_IMAGES = 5;

/**
 * The limit and the byte formatter live in `@/lib/image-intake`, which is the
 * single source of truth shared with the chat paths and kept in step with
 * `maximumSizeInBytes` in /api/work/uploads/token — that route is the real
 * enforcement. Re-exported here so existing importers keep working.
 */
export const MAX_PROOF_IMAGE_BYTES = MAX_IMAGE_BYTES;
const MAX_PROOF_IMAGE_MB = MAX_IMAGE_MB;

/**
 * Prepare freshly-picked proof photos. Two reasons a photo is touched at all:
 *
 *   OVERSIZE   — reduced by the smallest step that fits, because refusing it
 *                loses the proof entirely: the karigar has usually walked away
 *                from the work and cannot retake the shot.
 *   UNPAINTABLE — HEIC/HEIF/AVIF re-encoded to JPEG, because a reviewer's
 *                browser shows a broken image for those even when the bytes
 *                arrive intact. Size is irrelevant here.
 *
 * Anything under the limit AND already paintable is passed through UNTOUCHED,
 * which is what keeps ordinary evidence at full fidelity.
 *
 * Shared by all three pickers (this sheet, task detail, active session) — they
 * each had their own copy with no size check at all, which is how an oversize
 * photo reached Submit and came back as a bare "Upload failed (413)".
 */
export async function prepareProofFiles(
  picked: File[],
  existingCount: number,
): Promise<{ accepted: File[]; error: string | null }> {
  const room = Math.max(0, MAX_PROOF_IMAGES - existingCount);
  const considered = picked.slice(0, room);
  const skipped = picked.length - considered.length;

  const accepted: File[] = [];
  const reduced: string[] = [];
  const converted: string[] = [];
  const unreadable: string[] = [];

  for (const file of considered) {
    const oversize = file.size > MAX_PROOF_IMAGE_BYTES;
    const unpaintable = needsReencoding(file);
    if (!oversize && !unpaintable) {
      accepted.push(file);
      continue;
    }
    const fitted = await fitWithinLimit(file);
    if (!fitted) {
      unreadable.push(`${file.name} (${formatMb(file.size)})`);
      continue;
    }
    accepted.push(fitted.file);
    // A HEIC photo under the limit is re-encoded for viewability, not shrunk —
    // saying "reduced to fit" there would just confuse the karigar.
    if (oversize) {
      reduced.push(`${file.name} — ${formatMb(fitted.originalBytes)} → ${formatMb(fitted.file.size)}`);
    } else {
      converted.push(file.name);
    }
  }

  const notes: string[] = [];
  if (reduced.length === 1) {
    notes.push(`${reduced[0]}, so it fits the ${MAX_PROOF_IMAGE_MB} MB limit.`);
  } else if (reduced.length > 1) {
    notes.push(`${reduced.length} photos were reduced to fit the ${MAX_PROOF_IMAGE_MB} MB limit: ${reduced.join("; ")}.`);
  }
  if (converted.length > 0) {
    notes.push(
      `${converted.length === 1 ? `“${converted[0]}” was` : `${converted.length} photos were`} saved as JPEG so your manager can view ${converted.length === 1 ? "it" : "them"}.`,
    );
  }
  if (unreadable.length > 0) {
    notes.push(
      `Could not read ${unreadable.join(", ")} — please retake ${unreadable.length === 1 ? "it" : "them"} or pick another photo.`,
    );
  }
  if (skipped > 0) {
    notes.push(
      `Only ${MAX_PROOF_IMAGES} photos can be attached, so ${skipped} more ${skipped === 1 ? "was" : "were"} skipped.`,
    );
  }
  return { accepted, error: notes.length > 0 ? notes.join(" ") : null };
}

export interface ProofAttachment {
  url: string;
  mime: string;
}

export interface UpdatePayload {
  kind: "image" | "text";
  text?: string;
  /** First image — back-compat with single-blob callers/DB columns. */
  blob_url?: string;
  blob_mime?: string;
  /** Full set (1–5 for required proofs; 0–5 for breaks). */
  attachments?: ProofAttachment[];
}

interface ImageItem {
  file: File;
  preview: string;
}

interface Props {
  open: boolean;
  /** break = voluntary pause; expired = timer ran out; session = mid-subtask session end; subtask = last session of subtask */
  reason: "break" | "expired" | "session" | "subtask";
  onCancel: () => void;
  onSubmit: (payload: UpdatePayload) => void;
  uploading?: boolean;
  /** Optional task title for Acharya proof coaching. */
  taskTitle?: string | null;
}

const TABS: Array<{ key: TabKey; labelKey: "proofTabImage" | "proofTabText" }> = [
  { key: "image", labelKey: "proofTabImage" },
  { key: "text", labelKey: "proofTabText" },
];

function revokePreviews(items: ImageItem[]) {
  for (const item of items) {
    try { URL.revokeObjectURL(item.preview); } catch { /* ignore */ }
  }
}

/** Strip anything that could confuse a blob pathname; keep it recognisable. */
function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-64);
  return cleaned || "photo.jpg";
}

/**
 * Upload proof images browser→Blob, one PUT each, bypassing the function body
 * limit entirely. The token route requires a karigar session and pins the
 * pathname to `proof/`; `addRandomSuffix` with overwrite left off means an
 * upload can never clobber someone else's blob, so no per-user folder is needed.
 *
 * A failure names the offending file, so "Upload failed (413)" can never be all
 * the karigar is told again.
 */
export async function uploadProofImages(files: File[]): Promise<ProofAttachment[]> {
  const attachments: ProofAttachment[] = [];
  for (const file of files.slice(0, MAX_PROOF_IMAGES)) {
    // Belt and braces. The picker now shrinks oversize photos to fit rather
    // than refusing them, so this should be unreachable — but a file could
    // arrive from another caller that never went through prepareProofFiles.
    if (file.size > MAX_PROOF_IMAGE_BYTES) {
      throw new Error(
        `“${file.name}” is ${formatMb(file.size)} — each photo must be under ${MAX_PROOF_IMAGE_MB} MB.`,
      );
    }
    try {
      try {
        const blob = await upload(`proof/${Date.now()}-${safeName(file.name)}`, file, {
          access: "private",
          contentType: file.type || "image/jpeg",
          handleUploadUrl: "/api/work/uploads/token",
        });
        attachments.push({ url: blob.url, mime: file.type || "image/jpeg" });
      } catch (directErr) {
        // Local/dev often lacks BLOB_READ_WRITE_TOKEN — fall back to OmniDel proxy.
        const raw = directErr instanceof Error ? directErr.message : "";
        if (/unauthor/i.test(raw)) throw directErr;
        const viaProxy = await uploadProofImageViaOmnidelProxy(file);
        attachments.push(viaProxy);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (/unauthor/i.test(raw)) throw new Error("Your session expired — please sign in again.");
      if (/no read-write token|BLOB_READ_WRITE_TOKEN/i.test(raw)) {
        throw new Error(
          "Photo upload is not configured (missing BLOB_READ_WRITE_TOKEN). Copy it from OmniDel .env.local into omnidel-acharya/.env.local and restart the Acharya dev server.",
        );
      }
      throw new Error(`“${file.name}” could not be uploaded. ${raw || "Please try again."}`.trim());
    }
  }
  return attachments;
}

/** Multipart hop through Acharya → OmniDel when client Blob token is unavailable. */
async function uploadProofImageViaOmnidelProxy(file: File): Promise<ProofAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/work/uploads", { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as
    | { url?: string; type?: string; error?: string }
    | null;
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || `Upload failed (${res.status})`);
  }
  return { url: data.url, mime: data.type || file.type || "image/jpeg" };
}

export function UpdateCaptureSheet({
  open,
  reason,
  onCancel,
  onSubmit,
  uploading = false,
  taskTitle = null,
}: Props) {
  const s = useStrings();
  const [activeTab, setActiveTab] = useState<TabKey>("image");
  const [textValue, setTextValue] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingInternal, setUploadingInternal] = useState(false);
  const [textFocused, setTextFocused] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const onShowTab = useCallback((tab: "text" | "image") => {
    setActiveTab(tab);
  }, []);

  const proofVoice = useProofVoiceAssist({
    open,
    reason,
    taskTitle,
    onShowTab,
    onSetText: setTextValue,
    currentText: textValue,
  });

  // Break proof must not leak into Session/Subtask complete — state lives across
  // open→close because we only return null when closed (component stays mounted).
  useEffect(() => {
    if (!open) return;
    setActiveTab("image");
    setTextValue("");
    setImages((prev) => {
      revokePreviews(prev);
      return [];
    });
    setUploadError(null);
    setUploadingInternal(false);
    setTextFocused(false);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, [open, reason]);

  const isSubmitting = uploading || uploadingInternal;
  const requiresTextAndImage =
    reason === "expired" || reason === "session" || reason === "subtask";
  const isBreak = reason === "break";
  // Timer expiry cannot be dismissed; voluntary session/subtask/break can.
  const canDismiss = reason !== "expired";

  const heading =
    reason === "expired" || reason === "session"
      ? s.proofSessionHeading
      : reason === "subtask"
        ? s.proofSubtaskHeading
        : s.proofBreakHeading;

  const eyebrow =
    reason === "expired" || reason === "session"
      ? s.proofSessionEyebrow
      : reason === "subtask"
        ? s.proofSubtaskEyebrow
        : s.proofBreakEyebrow;

  const eyebrowColor =
    reason === "expired"
      ? "var(--crit)"
      : reason === "session" || reason === "subtask"
        ? "var(--green-deep)"
        : "var(--ink-mute)";

  const helperText = requiresTextAndImage
    ? s.proofHelperRequired
    : isBreak
      ? s.proofHelperBreak
      : null;

  const primaryLabel = isBreak
    ? (textValue.trim() || images.length > 0 ? s.proofSubmitBreak : s.proofTakeBreak)
    : reason === "subtask"
      ? s.proofSubmitProof
      : s.proofSubmitUpdate;

  const cancelLabel = isBreak ? s.proofBreakWithout : s.proofCancel;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    // Reset both inputs so re-picking the SAME file still fires.
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (picked.length === 0) return;

    // Reject oversize photos HERE, naming the file and its size. Previously an
    // oversize photo was accepted into the tray and only failed after the
    // karigar tapped Submit, as an opaque "Upload failed (413)".
    const { accepted, error } = await prepareProofFiles(picked, images.length);
    setUploadError(error);

    if (accepted.length === 0) return;
    setImages((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const target = prev[index];
      if (target) {
        try { URL.revokeObjectURL(target.preview); } catch { /* ignore */ }
      }
      return prev.filter((_, i) => i !== index);
    });
    setUploadError(null);
  }

  async function handleSubmit() {
    setUploadError(null);

    const trimmedText = textValue.trim();
    if (requiresTextAndImage && images.length === 0) {
      setUploadError(s.proofNeedImage);
      setActiveTab("image");
      return;
    }
    if (requiresTextAndImage && !trimmedText) {
      setUploadError(s.proofNeedText);
      setActiveTab("text");
      return;
    }
    // Breaks may submit with neither text nor image (pause without proof).
    if (!isBreak && !trimmedText && images.length === 0) return;

    let attachments: ProofAttachment[] = [];

    if (images.length > 0) {
      setUploadingInternal(true);
      try {
        attachments = await uploadProofImages(images.map((i) => i.file));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
        return;
      } finally {
        setUploadingInternal(false);
      }
    }

    const first = attachments[0];
    const kind: UpdatePayload["kind"] = attachments.length > 0 ? "image" : "text";
    onSubmit({
      kind,
      text: trimmedText || undefined,
      blob_url: first?.url,
      blob_mime: first?.mime,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  const canSubmit = !isSubmitting && (
    isBreak
      ? true
      : requiresTextAndImage
        ? textValue.trim().length > 0 && images.length > 0
        : textValue.trim().length > 0 || images.length > 0
  );

  if (!open) return null;

  const canAddMore = images.length < MAX_PROOF_IMAGES;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      aria-modal="true"
      role="dialog"
      aria-label={heading}
    >
      {/* Scrim — fades in independently of the sheet sliding up */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={canDismiss ? onCancel : undefined}
        className="fade-in"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(35, 29, 20, 0.52)",
          border: "none",
          cursor: canDismiss ? "pointer" : "default",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />

      {/* Sheet */}
      <div
        className="slide-up"
        style={{
          position: "relative",
          background: "var(--surface)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: "1px solid var(--rule)",
          paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Handle — slightly wider, more inviting to grab */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 6 }}>
          <div style={{ width: 40, height: 4, borderRadius: 9999, background: "var(--rule-strong)" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "6px 20px 14px" }}>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: eyebrowColor,
            margin: 0,
            transition: "color 0.4s ease",
          }}>
            {eyebrow}
          </p>
          <h2 style={{
            fontFamily: "var(--font-serif)",
            fontSize: 19,
            fontWeight: 400,
            color: "var(--ink)",
            margin: "5px 0 0",
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
          }}>
            {heading}
          </h2>
          {helperText && (
            <p style={{
              margin: "8px 0 0",
              fontSize: 12.5,
              color: "var(--ink-mute)",
              fontFamily: "var(--font-sans)",
              lineHeight: 1.45,
            }}>
              {helperText}
            </p>
          )}
          <ProofConversationMic
            available={proofVoice.available}
            status={proofVoice.status}
            onStart={() => void proofVoice.start()}
            onEnd={proofVoice.end}
          />
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: 6,
          padding: "0 20px 14px",
          borderBottom: "1px solid var(--rule)",
        }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={isActive}
                className="press"
                style={{
                  padding: "6px 18px",
                  borderRadius: "var(--r-md)",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                  fontWeight: isActive ? 600 : 400,
                  borderWidth: isActive ? 0 : 1,
                  borderStyle: "solid",
                  borderColor: "var(--rule)",
                  background: isActive ? "var(--green-deep)" : "transparent",
                  color: isActive ? "#f4efdf" : "var(--ink-soft)",
                  cursor: "pointer",
                  minHeight: 36,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "background 0.15s ease, color 0.15s ease",
                  outline: "none",
                }}
              >
                {s[tab.labelKey]}
                {tab.key === "image" && images.length > 0 ? ` (${images.length})` : ""}
              </button>
            );
          })}
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 0" }}>
          {activeTab === "image" && (
            <div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleFileChange}
                style={{ display: "none" }}
                id="update-image-camera"
                aria-label={s.proofTakePhoto}
              />

              {images.length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                  gap: 8,
                  marginBottom: 12,
                }}>
                  {images.map((item, index) => (
                    <div key={item.preview} style={{ position: "relative" }} className="fade-in">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.preview}
                        alt={`Selected image ${index + 1}`}
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          objectFit: "cover",
                          borderRadius: "var(--r-md)",
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderColor: "var(--rule)",
                          display: "block",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label={`Remove image ${index + 1}`}
                        className="press"
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 26,
                          height: 26,
                          borderRadius: 9999,
                          background: "rgba(35, 29, 20, 0.65)",
                          border: "none",
                          color: "#f4efdf",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <XIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {canAddMore ? (
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="press"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    width: "100%",
                    minHeight: images.length > 0 ? 88 : 120,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: "var(--rule-strong)",
                    borderRadius: "var(--r-lg)",
                    cursor: "pointer",
                    background: "var(--surface-sunk)",
                    fontFamily: "var(--font-sans)",
                    color: "var(--ink-mute)",
                  }}
                >
                  <CameraIcon />
                  <span style={{ fontSize: 13, textAlign: "center", padding: "0 12px" }}>
                    {images.length === 0
                      ? s.proofTakePhoto
                      : s.proofAddAnother(images.length, MAX_PROOF_IMAGES)}
                  </span>
                </button>
              ) : (
                <p style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  fontFamily: "var(--font-sans)",
                  margin: 0,
                }}>
                  {s.proofMaxPhotos(MAX_PROOF_IMAGES)}
                </p>
              )}

            </div>
          )}

          {activeTab === "text" && (
            <div>
              <label htmlFor="update-text-input" style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                fontFamily: "var(--font-sans)",
                display: "block",
                marginBottom: 8,
                letterSpacing: "0.01em",
              }}>
                {s.proofDescribeLabel}
              </label>
              <textarea
                id="update-text-input"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder={s.proofDescribePlaceholder}
                rows={5}
                maxLength={2000}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--r-lg)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: textFocused ? "var(--green-deep)" : "var(--rule)",
                  background: "var(--surface-sunk)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  color: "var(--ink)",
                  lineHeight: 1.65,
                  resize: "none",
                  minHeight: 128,
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={() => setTextFocused(true)}
                onBlur={() => setTextFocused(false)}
              />
              <p style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                marginTop: 5,
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
              }}>
                {textValue.length}/2000
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px 0" }}>
          {uploadError ? (
            <p
              role="alert"
              style={{
                fontSize: 12.5,
                color: "var(--crit)",
                margin: "0 0 12px",
                fontFamily: "var(--font-sans)",
                lineHeight: 1.45,
              }}
            >
              {uploadError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className={!isSubmitting ? "press" : undefined}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: "var(--r-lg)",
              border: "none",
              background: "var(--green-deep)",
              color: "#f4efdf",
              opacity: canSubmit || isSubmitting ? 1 : 0.85,
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 700,
              cursor: isSubmitting ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 52,
              transition: "background 0.18s ease, color 0.18s ease",
              outline: "none",
              letterSpacing: "0.01em",
            }}
          >
            {isSubmitting ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              primaryLabel
            )}
          </button>

          {reason !== "expired" && (
            <button
              type="button"
              onClick={onCancel}
              className="press"
              style={{
                width: "100%",
                marginTop: 10,
                padding: "13px",
                borderRadius: "var(--r-lg)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--rule)",
                background: "transparent",
                color: "var(--ink-soft)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                minHeight: 48,
                outline: "none",
              }}
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Icons (inline SVG — no dependency) ────────────────────────────────── */

function CameraIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: "rgba(244,239,223,0.35)",
        borderTopColor: "#f4efdf",
        borderRadius: 9999,
        display: "inline-block",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
