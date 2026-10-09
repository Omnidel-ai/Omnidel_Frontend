"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useStrings } from "@/lib/i18n/useLang";
import { blobViewUrl } from "@/lib/blob-url";
import { uploadViaClientToken } from "@/lib/image-intake";
import { CommentRichBody } from "@/components/acharya/CommentRichBody";

interface TaskNote {
  id: string;
  authorName: string | null;
  noteType: string;
  content: string | null;
  attachments: Array<{ url: string; name?: string; type?: string }>;
  createdAt: string;
}

interface Props {
  taskId: string;
  /** From task detail — drives the Approve / Your Score card. */
  reviewStatus?: "pending_review" | "reviewed" | null;
  finalScore?: number | null;
  acharyaScore?: number | null;
}

export function TaskCommentsTab({
  taskId,
  reviewStatus = null,
  finalScore = null,
  acharyaScore = null,
}: Props) {
  const s = useStrings();
  const [items, setItems] = useState<TaskNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; alt: string } | null>(null);
  const [liveReviewStatus, setLiveReviewStatus] = useState(reviewStatus);
  const [liveFinalScore, setLiveFinalScore] = useState(finalScore);
  const [liveAcharyaScore, setLiveAcharyaScore] = useState(acharyaScore);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLiveReviewStatus(reviewStatus);
    setLiveFinalScore(finalScore);
    setLiveAcharyaScore(acharyaScore);
  }, [reviewStatus, finalScore, acharyaScore]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  async function loadNotes() {
    setError(null);
    setLoading(true);
    try {
      const [notesRes, taskRes] = await Promise.all([
        fetch(`/api/work/tasks/${taskId}/notes`, { cache: "no-store" }),
        fetch(`/api/work/tasks/${taskId}?fresh=1`, { cache: "no-store" }),
      ]);
      if (!notesRes.ok) throw new Error(`${s.couldNotLoadComments} (${notesRes.status})`);
      const data = (await notesRes.json()) as { items?: TaskNote[] };
      const next = Array.isArray(data.items) ? data.items : [];
      setItems(
        [...next].sort((a, b) => {
          const ta = Date.parse(a.createdAt) || 0;
          const tb = Date.parse(b.createdAt) || 0;
          return tb - ta;
        }),
      );
      // Refresh Approve / Your Score from the live task (manager may have
      // finalized since the SSR seed).
      if (taskRes.ok) {
        const taskData = (await taskRes.json()) as {
          item?: {
            reviewStatus?: "pending_review" | "reviewed" | null;
            finalScore?: number | null;
            acharyaScore?: number | null;
          };
        };
        if (taskData.item) {
          setLiveReviewStatus(taskData.item.reviewStatus ?? null);
          setLiveFinalScore(taskData.item.finalScore ?? null);
          setLiveAcharyaScore(taskData.item.acharyaScore ?? null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : s.couldNotLoadComments);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void loadNotes();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handlePost() {
    const text = content.trim();
    if (!text && !file) return;
    if (!file && text.length < 2) {
      showToast(s.commentTooShort);
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const attachments: Array<{ url: string; name?: string; type?: string }> = [];
      if (file) {
        // Browser → Blob with a client token. This used to POST the photo to
        // /api/work/uploads, i.e. THROUGH a function, where Vercel refuses any
        // body over ~4.5 MB with FUNCTION_PAYLOAD_TOO_LARGE — so an ordinary
        // 3–8 MB phone photo failed as "Upload failed (413)". The helper also
        // shrinks oversize photos and re-encodes HEIC to JPEG.
        const uploaded = await uploadViaClientToken(file, "chat");
        attachments.push({ url: uploaded.url, name: uploaded.name, type: uploaded.mime });
      }

      const res = await fetch(`/api/work/tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, attachments }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string; code?: string } | null;
        if (data?.code === "comment_too_short" || /at least 2|comment is required/i.test(data?.error || "")) {
          showToast(s.commentTooShort);
          return;
        }
        throw new Error(data?.error || `${s.couldNotPostComment} (${res.status})`);
      }
      const data = (await res.json()) as { item?: TaskNote };
      if (data.item) {
        setItems((prev) =>
          [...prev, data.item as TaskNote].sort((a, b) => {
            const ta = Date.parse(a.createdAt) || 0;
            const tb = Date.parse(b.createdAt) || 0;
            return tb - ta;
          }),
        );
      }
      setContent("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : s.couldNotPostComment;
      setError(message);
      showToast(message);
    } finally {
      setPosting(false);
    }
  }

  const approved = liveReviewStatus === "reviewed";
  const pendingReview = liveReviewStatus === "pending_review";
  const displayScore = approved
    ? liveFinalScore
    : liveAcharyaScore ?? liveFinalScore;
  const showScoreCard = approved || pendingReview || displayScore != null;

  return (
    <section style={commentsWrap}>
      {showScoreCard ? (
        <div
          style={{
            ...scoreCard,
            background: approved ? "var(--ok-wash)" : "var(--ochre-wash)",
            borderColor: approved
              ? "color-mix(in srgb, var(--ok) 35%, var(--rule))"
              : "color-mix(in srgb, var(--ochre) 35%, var(--rule))",
          }}
          role="status"
          aria-label={approved ? s.commentsApproved : s.commentsAwaitingApproval}
        >
          <div style={scoreCardHeader}>
            <span
              style={{
                ...scoreBadge,
                background: approved ? "var(--ok)" : "var(--ochre)",
                color: "#f4efdf",
              }}
            >
              {approved ? s.commentsApproved : s.commentsAwaitingApproval}
            </span>
            {displayScore != null ? (
              <span style={scoreValue}>
                {approved ? s.commentsYourScore : s.commentsAcharyaScore}
                {": "}
                <strong>{formatScoreOutOfTen(displayScore)}</strong>
              </span>
            ) : null}
          </div>
          {displayScore != null ? (
            <div
              style={scoreBarTrack}
              role="progressbar"
              aria-valuenow={Math.round(clamp01(displayScore) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={formatScoreOutOfTen(displayScore)}
            >
              <div
                style={{
                  ...scoreBarFill,
                  width: `${Math.round(clamp01(displayScore) * 100)}%`,
                  background:
                    clamp01(displayScore) >= 0.7
                      ? "var(--ok)"
                      : clamp01(displayScore) >= 0.4
                        ? "var(--ochre)"
                        : "var(--crit)",
                }}
              />
            </div>
          ) : null}
          <p style={scoreCardBody}>
            {approved ? s.commentsScoreApprovedBody : s.commentsScorePendingBody}
          </p>
        </div>
      ) : null}

      <div style={composerCard}>
        <p style={eyebrow}>{s.taskComments}</p>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={s.commentPlaceholder}
          rows={3}
          style={textareaStyle}
        />
        {file ? (
          <div style={filePill}>
            {filePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={filePreviewUrl} alt="" style={fileThumb} />
            ) : null}
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label={s.removePhoto}
              className="press"
              style={clearFileButton}
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            style={{ display: "none" }}
            aria-label={s.attachPhoto}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="press"
            style={secondaryButton}
          >
            <CameraIcon />
            {s.photo}
          </button>
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={
              posting ||
              (!content.trim() && !file) ||
              (!file && content.trim().length < 2)
            }
            className="press"
            style={{
              ...primaryButton,
              opacity:
                posting || (!content.trim() && !file) || (!file && content.trim().length < 2)
                  ? 0.55
                  : 1,
              cursor:
                posting || (!content.trim() && !file) || (!file && content.trim().length < 2)
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {posting ? s.posting : s.postComment}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" style={errorText}>{error}</p>
      ) : null}

      {loading ? (
        <div style={emptyState}>{s.loadingComments}</div>
      ) : items.length === 0 ? (
        <div style={emptyState}>
          <p style={emptyTitle}>{s.noCommentsYet}</p>
          <p style={emptyBody}>{s.noCommentsYetBody}</p>
        </div>
      ) : (
        <ol style={timelineList}>
          {items.map((item, itemIndex) => (
            <li key={noteKey(item, itemIndex)} style={timelineItem}>
              <NoteAvatar name={item.authorName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={timelineMeta}>
                  <span style={authorStyle}>{item.authorName || "OmniDel"}</span>
                  <span style={whenStyle}>{formatNoteDate(item.createdAt)}</span>
                </div>
                <ActivityLine content={item.content} />
                {item.attachments.length > 0 ? (
                  <div style={attachmentGrid}>
                    {item.attachments.map((attachment, attachmentIndex) => {
                      const viewUrl = blobViewUrl(attachment.url);
                      const image = isImageAttachment(attachment);
                      const key = attachmentKey(item, attachment, attachmentIndex);
                      const alt = attachment.name || "Attachment preview";
                      if (image && viewUrl) {
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setImagePreview({ url: viewUrl, alt })}
                            aria-label={`Preview ${alt}`}
                            className="press"
                            style={{
                              ...attachmentPreviewLink,
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              font: "inherit",
                              textAlign: "left",
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={viewUrl}
                              alt={alt}
                              style={attachmentPreviewImage}
                              onError={(e) => {
                                const el = e.currentTarget;
                                el.style.display = "none";
                                const sibling = el.nextElementSibling as HTMLElement | null;
                                if (sibling) sibling.hidden = false;
                              }}
                            />
                            <span
                              hidden
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                minWidth: 0,
                                padding: 10,
                              }}
                            >
                              <AttachmentIcon />
                              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {attachment.name || "Attachment"}
                              </span>
                            </span>
                          </button>
                        );
                      }
                      return (
                        <a
                          key={key}
                          href={viewUrl || attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          style={attachmentLink}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <AttachmentIcon />
                            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {attachment.name || "Attachment"}
                            </span>
                          </span>
                        </a>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: "max(env(safe-area-inset-bottom), 24px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--ink)",
            color: "var(--surface)",
            padding: "10px 20px",
            borderRadius: 9999,
            fontFamily: "var(--sans)",
            fontSize: 13,
            fontWeight: 500,
            zIndex: 100,
            maxWidth: "90vw",
            textAlign: "center",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {toast}
        </div>
      ) : null}
      {imagePreview ? (
        <div
          style={imageLightboxRoot}
          aria-modal="true"
          role="dialog"
          aria-label={s.previewPhoto}
        >
          <button
            type="button"
            aria-label={s.cancel}
            onClick={() => setImagePreview(null)}
            className="fade-in"
            style={imageLightboxScrim}
          />
          <button
            type="button"
            aria-label={s.cancel}
            onClick={() => setImagePreview(null)}
            className="press fade-in"
            style={imageLightboxClose}
          >
            <CloseIcon size={20} />
          </button>
          <div className="fade-in" style={imageLightboxFrame}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview.url} alt={imagePreview.alt} style={imageLightboxImg} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatNoteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function noteKey(item: TaskNote, index: number) {
  return item.id || `${item.createdAt || "note"}-${index}`;
}

function attachmentKey(
  item: TaskNote,
  attachment: { url: string; name?: string; type?: string },
  index: number,
) {
  return `${item.id || item.createdAt || "note"}-${attachment.url || attachment.name || "attachment"}-${index}`;
}

function isImageAttachment(attachment: { url: string; name?: string; type?: string }) {
  if (attachment.type?.startsWith("image/")) return true;
  if (/^Proof image\b/i.test(attachment.name || "")) return true;
  // Extensionless private Vercel blobs are still photos in this app.
  if ((attachment.url || "").includes(".blob.vercel-storage.com")) return true;
  return /\.(png|jpe?g|webp|gif|heic|heif)(\?|#|$)/i.test(attachment.url || attachment.name || "");
}

/** OmniDel scores are 0–1 fractions; show as x.x/10 like the board chip. */
function formatScoreOutOfTen(score: number) {
  const frac = score > 1 ? score / 100 : score;
  return `${(clamp01(frac) * 10).toFixed(1)}/10`;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

const commentsWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  width: "100%",
  paddingBottom: 28,
};

const scoreCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--rule)",
};

const scoreCardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const scoreBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const scoreValue: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
};

const scoreBarTrack: CSSProperties = {
  width: "100%",
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
};

const scoreBarFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
};

const scoreCardBody: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 12.5,
  lineHeight: 1.45,
  color: "var(--ink-soft)",
};

const composerCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 14,
  borderRadius: "var(--r-md)",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--green-deep)",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 92,
  resize: "vertical",
  padding: "12px 13px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--rule)",
  background: "var(--surface-sunk)",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
  fontSize: 14,
  lineHeight: 1.5,
  outline: "none",
};

const filePill: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "8px 10px",
  borderRadius: "var(--r-sm)",
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  fontFamily: "var(--sans)",
  fontSize: 12,
};

const fileThumb: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "var(--r-sm)",
  objectFit: "cover",
  border: "1px solid var(--rule)",
  flexShrink: 0,
};

const clearFileButton: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "var(--green-deep)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const secondaryButton: CSSProperties = {
  minHeight: 42,
  padding: "0 12px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--rule)",
  background: "transparent",
  color: "var(--ink-soft)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const primaryButton: CSSProperties = {
  flex: 1,
  minHeight: 42,
  padding: "0 14px",
  borderRadius: "var(--r-md)",
  border: "none",
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 800,
};

const errorText: CSSProperties = {
  margin: 0,
  padding: "10px 12px",
  borderRadius: "var(--r-md)",
  background: "var(--crit-wash)",
  color: "var(--crit)",
  fontFamily: "var(--sans)",
  fontSize: 13,
};

const emptyState: CSSProperties = {
  minHeight: 180,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  textAlign: "center",
  color: "var(--ink-mute)",
  fontFamily: "var(--sans)",
  fontSize: 13,
};

const emptyTitle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 18,
  fontWeight: 500,
  color: "var(--ink)",
};

const emptyBody: CSSProperties = {
  margin: 0,
  maxWidth: 280,
  lineHeight: 1.5,
};

/**
 * Who wrote it, as a disc of their initials.
 *
 * Every row used to open with the same ochre dot, so a list of twelve notes
 * gave no clue that two people were talking — the name was set in the same
 * small mono as the timestamp beside it. Initials read at a glance, and the
 * tone is derived from the name so one person keeps one colour down the page.
 */
function NoteAvatar({ name }: { name: string | null }) {
  const label = (name || "OmniDel").trim();
  const initials =
    label
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "·";

  // Sum of char codes: stable for a given name, and this is decoration — a
  // real hash would buy nothing a person could notice.
  const tones = ["var(--green-deep)", "var(--ochre)", "var(--terracotta)", "var(--slate)"];
  let sum = 0;
  for (let i = 0; i < label.length; i += 1) sum += label.charCodeAt(i);
  const tone = tones[sum % tones.length];

  return (
    <span aria-hidden style={{ ...avatarStyle, background: tone }}>
      {initials}
    </span>
  );
}

/**
 * A note's body, with a short ALL-CAPS value lifted into a chip — the list
 * name in "Moved to list: TESTING", which is the one word in that sentence
 * the karigar is actually looking for.
 *
 * Only all-caps, only short, only when the whole note is that one line. A
 * looser rule would chip "added Khushi Pandey" out of "Assignees: added
 * Khushi Pandey", and a person's name in a status pill reads as a mistake.
 */
const LABELLED_VALUE = /^([^:]{2,28}):\s*([A-Z0-9][A-Z0-9 _/-]{0,22})$/;

function ActivityLine({ content }: { content: string | null }) {
  const raw = content?.trim();
  if (!raw) return null;
  // One line only. A multi-line note is a written comment, not a status
  // change, and its first line happening to end in a capitalised word is not
  // a reason to chip it.
  const match = raw.includes("\n") ? null : LABELLED_VALUE.exec(raw);
  if (!match) return <CommentRichBody content={content} />;
  return (
    <p style={activityStyle}>
      {match[1]}:{" "}
      <span style={valueChipStyle}>{match[2]}</span>
    </p>
  );
}

const avatarStyle: CSSProperties = {
  flexShrink: 0,
  width: 34,
  height: 34,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  color: "var(--surface)",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.02em",
};

const authorStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "none",
  color: "var(--ink)",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const whenStyle: CSSProperties = {
  flexShrink: 0,
  color: "var(--ink-mute)",
};

const activityStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 13.5,
  lineHeight: 1.5,
  color: "var(--ink)",
};

const valueChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 8px",
  borderRadius: 999,
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  fontFamily: "var(--mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
};

const timelineList: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const timelineItem: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 11,
  padding: 12,
  borderRadius: "var(--r-md)",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
};

const timelineMeta: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
  color: "var(--ink-mute)",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const attachmentGrid: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 9,
};

const attachmentLink: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 34,
  padding: "0 10px",
  borderRadius: "var(--r-sm)",
  background: "var(--surface-sunk)",
  color: "var(--green-deep)",
  textDecoration: "none",
  fontFamily: "var(--sans)",
  fontSize: 12.5,
  fontWeight: 650,
};

const attachmentPreviewLink: CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 260,
  borderRadius: "var(--r-md)",
  overflow: "hidden",
  border: "1px solid var(--rule)",
  background: "var(--surface-sunk)",
  textDecoration: "none",
};

const attachmentPreviewImage: CSSProperties = {
  display: "block",
  width: "100%",
  maxHeight: 180,
  objectFit: "cover",
};

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function AttachmentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function CloseIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

const imageLightboxRoot: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const imageLightboxScrim: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(35, 29, 20, 0.88)",
  border: "none",
  cursor: "pointer",
};

const imageLightboxClose: CSSProperties = {
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

const imageLightboxFrame: CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: "min(94vw, 520px)",
  maxHeight: "min(82vh, 640px)",
  borderRadius: "var(--r-md)",
  overflow: "hidden",
  boxShadow: "var(--shadow-lg)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "color-mix(in srgb, #f4efdf 15%, transparent)",
};

const imageLightboxImg: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  maxHeight: "min(82vh, 640px)",
  objectFit: "contain",
  background: "var(--surface-sunk)",
};
