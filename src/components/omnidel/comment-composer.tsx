"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { blobViewUrl } from "@/lib/client/blob-url";
import { ImageLightbox, type LightboxImage } from "@/components/omnidel/image-lightbox";
import { uploadPipelineFile } from "@/lib/client/upload-blob-file";
import { syncMentionQuery } from "@/lib/mention-slug";
import {
  createRichTextExtensions,
  isRichTextEmpty,
  LinkDialog,
  parseContent,
} from "@/components/omnidel/rich-text-editor";
import { useTr } from "@/lib/client/language";

// ─────────────────────────────────────────────────────────────────────────────
// CommentComposer — same Tiptap WYSIWYG editor as the task description field.
//
// Inputs:
//   - paste an image from the clipboard
//   - drop image / document files onto the editor
//   - click the "image" button in the toolbar (images) or drag docs
//
// Each upload goes to POST /api/uploads (images + common docs: MD, TXT, PDF…).
// The Attachment object is surfaced on `attachments` so the parent can include it
// in the POST body for the note.
//
// Attachments are capped at MAX_COMMENT_ATTACHMENTS per comment (paste / drag /
// file picker all share the same limit).
//
// The component is "controlled" for value + attachments so the parent can
// reset both after a successful post. `value` is stored as Tiptap JSON (same
// format as task descriptions).
// ─────────────────────────────────────────────────────────────────────────────

export interface ComposerAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface MentionOption {
  id: string;
  slug: string;
  display_name: string;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  attachments: ComposerAttachment[];
  onAttachmentsChange: (next: ComposerAttachment[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  posting?: boolean;
  error?: string;
  autoFocus?: boolean;
  submitLabel?: string;
  fetchMentions?: (query: string) => Promise<MentionOption[]>;
  mentionMenuLabel?: string;
  /** @deprecated Images are tracked via attachments only; markdown refs are not inserted. */
  insertMarkdownRefs?: boolean;
  /**
   * @deprecated Files are promoted on comment post by the parent — not during
   * paste/upload. Kept optional so old call sites still type-check.
   */
  onDocumentAttached?: (att: ComposerAttachment) => Promise<void>;
  /**
   * When set, non-image drops insert an editor link and stage the file in
   * `attachments` (for Files promotion on Post). Without it, docs stay as
   * comment attachment chips only.
   */
  stageDocuments?: boolean;
}

export const MAX_COMMENT_IMAGES = 10;
export const MAX_COMMENT_ATTACHMENTS = MAX_COMMENT_IMAGES;

const IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
]);

const DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
};

const FILE_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.markdown,.json,text/plain,text/markdown,text/csv,application/pdf,application/json";

function resolveAttachMime(file: File): string | null {
  const raw = (file.type || "").split(";")[0].trim().toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw && (IMAGE_TYPES.has(raw) || DOC_TYPES.has(raw))) return raw;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

function isImageMime(mime: string | null | undefined): boolean {
  const m = (mime || "").split(";")[0].trim().toLowerCase();
  return IMAGE_TYPES.has(m) || m === "image/jpg";
}

/** Normalize MIME so image/jpg and image/jpeg collapse to one bucket. */
function normalizeMimeKey(mime: string | null | undefined): string {
  const m = (mime || "").split(";")[0].trim().toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

/**
 * Clipboard paste often lists the same screenshot twice (duplicate items, or
 * the same bytes with a different lastModified / generic name). For images,
 * fingerprint by size + mime only — name and lastModified are volatile on
 * paste and were letting duplicates through.
 */
function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const file of files) {
    const mime = normalizeMimeKey(resolveAttachMime(file) || file.type);
    const key = isImageMime(mime)
      ? `img|${file.size}|${mime}`
      : `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}

/** Collect files from a paste event once — never merge items + files lists.
 *  Clipboard often exposes several MIME variants of the same screenshot with
 *  different byte sizes; for a single paste keep only the largest image. */
function collectClipboardFiles(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return [];
  const fromFiles = Array.from(dt.files || []);
  const raw = fromFiles.length > 0
    ? fromFiles
    : Array.from(dt.items || []).flatMap((item) => {
        if (item.kind !== "file") return [];
        const f = item.getAsFile();
        return f ? [f] : [];
      });
  const unique = dedupeFiles(raw);
  const images = unique.filter((f) => isImageMime(resolveAttachMime(f) || f.type));
  const docs = unique.filter((f) => !isImageMime(resolveAttachMime(f) || f.type));
  if (images.length <= 1) return [...images, ...docs];
  // One paste → one screenshot. Prefer the largest representation.
  images.sort((a, b) => b.size - a.size);
  return [images[0], ...docs];
}

function imageAttachmentFingerprint(size: number, type: string | null | undefined): string {
  return `img|${size}|${normalizeMimeKey(type)}`;
}

/** Clipboard paste often supplies a generic name like `image.png` — invent a
 *  timestamped screenshot name so Files / comments don't all look identical.
 *  Real filenames (picked or dragged from disk) are left alone. */
const GENERIC_CLIPBOARD_IMAGE_NAMES = new Set([
  "image.png",
  "image.jpg",
  "image.jpeg",
  "image.webp",
  "image.gif",
  "image.bmp",
  "blob",
  "blob.png",
  "untitled",
  "untitled.png",
  "paste.png",
  "pasted.png",
]);

function extFromMime(mime: string | null | undefined): string {
  const m = (mime || "").split(";")[0].trim().toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "image/bmp") return "bmp";
  return "png";
}

function isGenericClipboardImageName(name: string): boolean {
  const lower = (name || "").trim().toLowerCase();
  if (!lower) return true;
  if (GENERIC_CLIPBOARD_IMAGE_NAMES.has(lower)) return true;
  return /^image\.\w{2,5}$/i.test(lower) || /^blob(\.\w{2,5})?$/i.test(lower);
}

function screenshotStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function withPasteFriendlyName(file: File, mime: string): File {
  if (!isImageMime(mime)) return file;
  if (!isGenericClipboardImageName(file.name)) return file;
  const ext = (file.name.includes(".") ? file.name.split(".").pop() : null)?.toLowerCase()
    || extFromMime(mime);
  const nextName = `screenshot-${screenshotStamp()}.${ext}`;
  return new File([file], nextName, {
    type: mime || file.type || "image/png",
    lastModified: file.lastModified || Date.now(),
  });
}

function fileExtLabel(filename: string): string {
  return (filename.split(".").pop() || "FILE").toUpperCase().slice(0, 4);
}

const EMPTY_DOC = '{"type":"doc","content":[{"type":"paragraph"}]}';

export function CommentComposer({
  value, onChange, attachments, onAttachmentsChange,
  onSubmit, onCancel, posting, error, autoFocus, submitLabel,
  fetchMentions, mentionMenuLabel = "Mention member",
  stageDocuments = false,
}: Props) {
  const tr = useTr();
  const editorWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const suppressMentionKeyUpRef = useRef(false);
  const lastExternalRef = useRef(value);
  const mountBaselineRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const postingRef = useRef(!!posting);
  postingRef.current = !!posting;
  const uploadingRef = useRef(false);
  const pasteLockRef = useRef(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const canSubmitRef = useRef(false);
  const mentionQueryRef = useRef<string | null>(null);
  const mentionOptionsRef = useRef<MentionOption[]>([]);
  const mentionActiveIdxRef = useRef(0);
  const selectMentionRef = useRef<(opt: MentionOption) => void>(() => {});
  const uploadFilesRef = useRef<(files: File[]) => Promise<void>>(async () => {});

  const [showLink, setShowLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionOptions, setMentionOptions] = useState<MentionOption[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const [previewImageIdx, setPreviewImageIdx] = useState<number | null>(null);
  const [mentionPopoverPos, setMentionPopoverPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  mentionQueryRef.current = mentionQuery;
  mentionOptionsRef.current = mentionOptions;
  mentionActiveIdxRef.current = mentionActiveIdx;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createRichTextExtensions("Write a comment... @mention members, paste/drag images or files."),
    content: parseContent(value) ?? "",
    editable: true,
    editorProps: {
      attributes: {
        class: "comment-composer-editor",
      },
      handleKeyDown: (_view, event) => {
        const menuOpen = fetchMentions && mentionQueryRef.current !== null;
        const options = mentionOptionsRef.current;
        const activeIdx = mentionActiveIdxRef.current;
        if (menuOpen && options.length > 0 && activeIdx >= 0) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setMentionActiveIdx((i) => Math.min(options.length - 1, i + 1));
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setMentionActiveIdx((i) => Math.max(0, i - 1));
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            selectMentionRef.current(options[activeIdx]);
            return true;
          }
        }
        if (menuOpen && event.key === "Escape") {
          event.preventDefault();
          suppressMentionKeyUpRef.current = true;
          setMentionQuery(null);
          setMentionOptions([]);
          setMentionActiveIdx(-1);
          return true;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          if (!postingRef.current && !uploadingRef.current && canSubmitRef.current) onSubmitRef.current();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const unique = collectClipboardFiles(event.clipboardData);
        if (unique.length === 0) return false;
        // Some browsers / OS clipboard bridges fire paste twice for one Cmd/Ctrl+V.
        // Swallow the duplicate while an upload from paste is already in flight.
        event.preventDefault();
        if (pasteLockRef.current || uploadingRef.current) return true;
        pasteLockRef.current = true;
        void uploadFilesRef.current(unique).finally(() => {
          window.setTimeout(() => {
            pasteLockRef.current = false;
          }, 400);
        });
        return true;
      },
      handleDrop: (_view, event) => {
        const files = dedupeFiles(Array.from(event.dataTransfer?.files || []));
        if (files.length > 0) {
          event.preventDefault();
          setDragOver(false);
          void uploadFilesRef.current(files);
          return true;
        }
        return false;
      },
    },
  });

  const refreshMentionQueryFromCaret = useCallback(() => {
    if (suppressMentionKeyUpRef.current) {
      suppressMentionKeyUpRef.current = false;
      return;
    }
    if (!editor || !fetchMentions) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(0, from, "\n");
    setMentionQuery(syncMentionQuery(textBefore, textBefore.length));
  }, [editor, fetchMentions]);

  useEffect(() => {
    if (!editor) return;
    if (mountBaselineRef.current === null) {
      mountBaselineRef.current = JSON.stringify(editor.getJSON());
    }
    const handler = () => {
      const json = JSON.stringify(editor.getJSON());
      if (json === mountBaselineRef.current) return;
      lastExternalRef.current = json;
      onChangeRef.current(json);
      refreshMentionQueryFromCaret();
    };
    editor.on("update", handler);
    editor.on("selectionUpdate", refreshMentionQueryFromCaret);
    return () => {
      editor.off("update", handler);
      editor.off("selectionUpdate", refreshMentionQueryFromCaret);
    };
  }, [editor, refreshMentionQueryFromCaret]);

  useEffect(() => {
    if (!editor || value === lastExternalRef.current) return;
    lastExternalRef.current = value;
    editor.commands.setContent(parseContent(value) ?? "");
    mountBaselineRef.current = JSON.stringify(editor.getJSON());
    setShowLink(false);
  }, [value, editor]);

  const updateMentionPopoverPosition = useCallback(() => {
    const wrap = editorWrapRef.current;
    if (!wrap || mentionQuery === null || !fetchMentions) {
      setMentionPopoverPos(null);
      return;
    }
    const r = wrap.getBoundingClientRect();
    setMentionPopoverPos({
      top: r.bottom + 6,
      left: r.left,
      width: Math.max(r.width, 240),
    });
  }, [mentionQuery, fetchMentions]);

  useLayoutEffect(() => {
    updateMentionPopoverPosition();
    if (mentionQuery === null) return;
    window.addEventListener("scroll", updateMentionPopoverPosition, true);
    window.addEventListener("resize", updateMentionPopoverPosition);
    return () => {
      window.removeEventListener("scroll", updateMentionPopoverPosition, true);
      window.removeEventListener("resize", updateMentionPopoverPosition);
    };
  }, [mentionQuery, updateMentionPopoverPosition, value]);

  useEffect(() => {
    if (!fetchMentions || mentionQuery === null) {
      setMentionOptions([]);
      setMentionLoading(false);
      return;
    }
    let cancelled = false;
    setMentionOptions([]);
    setMentionActiveIdx(-1);
    setMentionLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const results = await fetchMentions(mentionQuery);
        if (!cancelled) {
          setMentionOptions(results);
          setMentionActiveIdx(0);
        }
      } catch {
        if (!cancelled) setMentionOptions([]);
      } finally {
        if (!cancelled) setMentionLoading(false);
      }
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [mentionQuery, fetchMentions]);

  function selectMentionOption(opt: MentionOption) {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(0, from, "\n");
    const tokenMatch = textBefore.match(/(^|\s)@([^\s@]*)$/);
    if (tokenMatch) {
      const tokenLen = tokenMatch[0].length - (tokenMatch[1]?.length ?? 0);
      const replaceFrom = from - tokenLen;
      editor
        .chain()
        .focus()
        .deleteRange({ from: replaceFrom, to: from })
        .insertContent(`@${opt.display_name} `)
        .run();
    } else {
      editor.chain().focus().insertContent(`@${opt.display_name} `).run();
    }
    setMentionQuery(null);
  }
  selectMentionRef.current = selectMentionOption;

  useEffect(() => {
    if (autoFocus && editor) {
      requestAnimationFrame(() => editor.commands.focus("end"));
    }
  }, [autoFocus, editor]);

  const wasPostingRef = useRef(false);
  useEffect(() => {
    if (wasPostingRef.current && !posting && editor) {
      requestAnimationFrame(() => editor.commands.focus("end"));
    }
    wasPostingRef.current = !!posting;
  }, [posting, editor]);

  const atImageLimit = attachments.length >= MAX_COMMENT_ATTACHMENTS;
  const canSubmit = !isRichTextEmpty(value) || attachments.length > 0;
  canSubmitRef.current = canSubmit;
  const previewImages: LightboxImage[] = attachments
    .filter((a) => isImageMime(a.type))
    .map((a) => ({
      src: blobViewUrl(a.url),
      alt: a.name || "",
    }));

  function insertDocumentLink(att: ComposerAttachment) {
    if (!editor) return;
    const href = blobViewUrl(att.url);
    const label = att.name || "document";
    editor
      .chain()
      .focus("end")
      .insertContent([
        {
          type: "text",
          text: label,
          marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }],
        },
        { type: "text", text: " " },
      ])
      .run();
  }

  async function uploadFiles(files: File[]) {
    const uniqueFiles = dedupeFiles(files);
    if (uniqueFiles.length === 0) return;
    setUploading(true);
    uploadingRef.current = true;
    setLocalError("");
    // Prefer the live ref so a second paste/upload mid-flight sees chips already staged.
    let nextAttachments = [...attachmentsRef.current];
    let hitLimit = false;
    for (const file of uniqueFiles) {
      const mime = resolveAttachMime(file);
      if (!mime) {
        setLocalError(
          `Skipped "${file.name}" — use images, PDF, DOCX, TXT, MD, CSV, or JSON.`,
        );
        continue;
      }

      // Docs: insert a link in the editor + stage in attachments. Files section
      // is updated only when the parent posts the comment.
      if (!isImageMime(mime) && stageDocuments) {
        if (nextAttachments.length >= MAX_COMMENT_ATTACHMENTS) {
          hitLimit = true;
          break;
        }
        try {
          const named = withPasteFriendlyName(file, mime);
          const att = await uploadPipelineFile(named, mime);
          if (nextAttachments.some((a) => a.url === att.url || (a.name === att.name && a.size === att.size))) {
            continue;
          }
          insertDocumentLink(att);
          nextAttachments = [...nextAttachments, att];
          attachmentsRef.current = nextAttachments;
          onAttachmentsChange(nextAttachments);
        } catch (err: unknown) {
          setLocalError(err instanceof Error ? err.message : "Upload failed");
        }
        continue;
      }

      // Images: stage as comment chips only until Post.
      if (nextAttachments.length >= MAX_COMMENT_ATTACHMENTS) {
        hitLimit = true;
        break;
      }
      try {
        // Skip before upload when this paste already staged the same screenshot
        // (timestamped rename would otherwise defeat a name-based check).
        const pendingFp = imageAttachmentFingerprint(file.size, mime);
        if (
          nextAttachments.some(
            (a) => isImageMime(a.type) && imageAttachmentFingerprint(a.size, a.type) === pendingFp,
          )
        ) {
          continue;
        }
        const named = withPasteFriendlyName(file, mime);
        const att = await uploadPipelineFile(named, mime);
        // Same paste/upload can race into two blobs with different URLs —
        // collapse by URL or by image size+mime (ignore volatile paste names).
        const uploadedFp = imageAttachmentFingerprint(att.size, att.type);
        if (
          nextAttachments.some(
            (a) =>
              a.url === att.url ||
              (isImageMime(a.type) && imageAttachmentFingerprint(a.size, a.type) === uploadedFp),
          )
        ) {
          continue;
        }
        nextAttachments = [...nextAttachments, att];
        attachmentsRef.current = nextAttachments;
        onAttachmentsChange(nextAttachments);
      } catch (err: unknown) {
        setLocalError(err instanceof Error ? err.message : "Upload failed");
      }
    }
    if (hitLimit) {
      setLocalError(`Maximum ${MAX_COMMENT_ATTACHMENTS} images per comment.`);
    }
    setUploading(false);
    uploadingRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
    editor?.commands.focus("end");
  }
  uploadFilesRef.current = uploadFiles;

  function removeAttachment(url: string) {
    const next = attachmentsRef.current.filter((a) => a.url !== url);
    attachmentsRef.current = next;
    onAttachmentsChange(next);
  }

  const combinedError = error || localError;

  const mentionPopover =
    fetchMentions && mentionQuery !== null && mentionPopoverPos
      ? createPortal(
          <div
            style={{
              position: "fixed",
              ...(mentionPopoverPos.top !== undefined ? { top: mentionPopoverPos.top } : {}),
              ...(mentionPopoverPos.bottom !== undefined ? { bottom: mentionPopoverPos.bottom } : {}),
              left: mentionPopoverPos.left,
              width: mentionPopoverPos.width,
              zIndex: 2000,
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-md)",
              maxHeight: 240,
              overflowY: "auto",
              padding: "4px 0",
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div
              style={{
                padding: "6px 12px",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                borderBottom: "1px solid var(--rule)",
              }}
            >
              {mentionMenuLabel}
            </div>
            {mentionLoading ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-mute)" }}>{tr("Loading...")}</div>
            ) : mentionOptions.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-mute)" }}>
                {tr("No members match")}
              </div>
            ) : (
              mentionOptions.map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseEnter={() => setMentionActiveIdx(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMentionOption(opt);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    background: i === mentionActiveIdx ? "var(--green-wash)" : "transparent",
                    border: "none",
                    color: "var(--ink)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>@{opt.display_name}</div>
                </button>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div style={wrapperStyle}>
      <div
        ref={editorWrapRef}
        style={{
          ...editorContainerStyle,
          borderColor: dragOver ? "var(--green-deep)" : "var(--rule-strong)",
          background: dragOver ? "var(--green-wash)" : "var(--page)",
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => {
          if (!editorWrapRef.current?.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
      >
        <CommentToolbar
          editor={editor}
          onLinkClick={() => setShowLink((s) => !s)}
          imageLabel={uploading ? "Uploading…" : "image"}
          imageTitle={
            atImageLimit
              ? `Maximum ${MAX_COMMENT_ATTACHMENTS} images per comment`
              : stageDocuments
                ? `Images & files stage here · they appear in Files after you post`
                : `Attach images (up to ${MAX_COMMENT_ATTACHMENTS} per comment)`
          }
          onImageClick={() => fileInputRef.current?.click()}
          imageDisabled={uploading || atImageLimit}
        />
        {showLink && editor && (
          <LinkDialog editor={editor} onClose={() => setShowLink(false)} />
        )}
        <div style={{ position: "relative" }}>
          <EditorContent editor={editor} />
          {dragOver && (
            <div style={dragOverlayStyle}>
              {stageDocuments ? tr("Drop images or files") : tr("Drop files to attach")}
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={(e) => void uploadFiles(Array.from(e.target.files || []))}
        />
      </div>
      {mentionPopover}

      {(attachments.length > 0 || atImageLimit) && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mute)" }}>
          {attachments.length}/{MAX_COMMENT_ATTACHMENTS} {tr("images (max")} {MAX_COMMENT_ATTACHMENTS} {tr("per comment)")}
        </div>
      )}

      {attachments.length > 0 && (
        <div style={attachmentsStripStyle}>
          {attachments.map((a) => {
            const image = isImageMime(a.type);
            const imageIdx = image
              ? attachments.filter((x) => isImageMime(x.type)).findIndex((x) => x.url === a.url)
              : -1;
            return (
              <div key={a.url} style={attachmentChipStyle} title={a.name}>
                {image ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImageIdx(imageIdx >= 0 ? imageIdx : 0)}
                    style={attachmentPreviewBtnStyle}
                    aria-label={`Preview ${a.name}`}
                  >
                    <img src={blobViewUrl(a.url)} alt={a.name || ""} style={attachmentThumbStyle} />
                  </button>
                ) : (
                  <a
                    href={blobViewUrl(a.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={attachmentFileBadgeStyle}
                    aria-label={`Open ${a.name}`}
                  >
                    {fileExtLabel(a.name)}
                  </a>
                )}
                <span style={attachmentNameStyle}>{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.url)}
                  style={attachmentRemoveStyle}
                  aria-label={`Remove ${a.name}`}
                >×</button>
              </div>
            );
          })}
        </div>
      )}

      {combinedError && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--crit)" }}>{combinedError}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <button
          onClick={onSubmit}
          disabled={posting || uploading || !canSubmit}
          style={actionBtnStyle}
          type="button"
        >
          {posting ? tr("Posting…") : (submitLabel || tr("Post Comment"))}
        </button>
        <button onClick={onCancel} style={cancelBtnStyle} type="button">{tr("Cancel")}</button>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>
          {tr("Cmd/Ctrl + Enter to post")}
        </span>
      </div>
      {previewImageIdx !== null && previewImages.length > 0 && (
        <ImageLightbox
          images={previewImages}
          index={previewImageIdx}
          onIndexChange={setPreviewImageIdx}
          onClose={() => setPreviewImageIdx(null)}
        />
      )}
    </div>
  );
}

// ─── Comment toolbar (subset of description tools) ───────────────────────────

function CommentToolbar({
  editor,
  onLinkClick,
  imageLabel,
  imageTitle,
  onImageClick,
  imageDisabled,
}: {
  editor: Editor | null;
  onLinkClick: () => void;
  imageLabel: string;
  imageTitle: string;
  onImageClick: () => void;
  imageDisabled?: boolean;
}) {
  const tr = useTr();
  if (!editor) return null;

  return (
    <div
      role="toolbar"
      aria-label={tr("Comment formatting")}
      style={commentToolbarStyle}
    >
      <CommentToolBtn
        label="B"
        title={tr("Bold (Ctrl+B)")}
        weight={700}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <CommentToolBtn
        label="I"
        title={tr("Italic (Ctrl+I)")}
        italic
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <CommentToolBtn
        label="</>"
        title={tr("Inline code")}
        mono
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <CommentToolBtn
        label="link"
        title={tr("Insert link")}
        active={editor.isActive("link")}
        onClick={onLinkClick}
      />
      <CommentToolBtn
        label="list"
        title={tr("Bulleted list")}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <CommentToolBtn
        label="quote"
        title={tr("Blockquote")}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <div style={{ flex: 1 }} />
      <CommentToolBtn
        label={imageLabel}
        title={imageTitle}
        mono
        disabled={imageDisabled}
        onClick={onImageClick}
      />
    </div>
  );
}

function CommentToolBtn({
  label,
  title,
  onClick,
  disabled,
  active,
  weight,
  italic,
  mono,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  weight?: number;
  italic?: boolean;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      style={{
        padding: "4px 8px",
        fontSize: 11,
        fontFamily: mono ? "var(--mono)" : "var(--sans)",
        fontWeight: weight ?? (active ? 600 : 400),
        fontStyle: italic ? "italic" : "normal",
        background: active ? "var(--surface-sunk)" : "var(--surface)",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--rule)",
        borderRadius: "var(--r-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const wrapperStyle: CSSProperties = {
  marginBottom: 16,
};

const editorContainerStyle: CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: "var(--r-sm)",
  overflow: "hidden",
};

const commentToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap",
  padding: "6px 8px",
  borderBottom: "1px solid var(--rule)",
  background: "var(--surface)",
};

const dragOverlayStyle: CSSProperties = {
  position: "absolute", inset: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  pointerEvents: "none",
  fontFamily: "var(--mono)", fontSize: 11,
  letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--green-deep)",
};

const attachmentsStripStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};

const attachmentChipStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "3px 6px 3px 3px",
  background: "var(--surface-sunk)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  maxWidth: 220,
};

const attachmentThumbStyle: CSSProperties = {
  width: 28, height: 28, borderRadius: 3,
  objectFit: "cover",
  background: "var(--rule)",
};

const attachmentFileBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 3,
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  fontFamily: "var(--mono)",
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 0.3,
  textDecoration: "none",
  flexShrink: 0,
};

const attachmentPreviewBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  cursor: "zoom-in",
  display: "inline-flex",
};

const attachmentNameStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 11,
  color: "var(--ink-soft)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const attachmentRemoveStyle: CSSProperties = {
  width: 18, height: 18, padding: 0,
  borderWidth: 0, background: "transparent",
  color: "var(--ink-mute)",
  cursor: "pointer", fontSize: 14, lineHeight: 1,
};

const actionBtnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1,
  height: 30,
  minHeight: 30,
  maxHeight: 30,
  whiteSpace: "nowrap",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  boxSizing: "border-box",
};

const actionBtnStyle: CSSProperties = {
  ...actionBtnBase,
  background: "var(--green-deep)",
  color: "#f4efdf",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
};

const cancelBtnStyle: CSSProperties = {
  ...actionBtnBase,
  background: "transparent",
  color: "var(--ink-soft)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
};

export { EMPTY_DOC as COMMENT_EMPTY_DOC };
