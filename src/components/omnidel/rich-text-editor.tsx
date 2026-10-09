"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { safeUrl } from "@/components/omnidel/markdown";
import { ImageLightbox } from "@/components/omnidel/image-lightbox";
import { useTr } from "@/lib/client/language";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isTiptapDoc(raw: string | null | undefined): boolean {
  const t = typeof raw === "string" ? raw.trim() : "";
  return t.startsWith('{"type":"doc"');
}

export function isRichTextEmpty(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return true;
  if (!isTiptapDoc(raw)) return !raw.trim();
  try {
    const doc = JSON.parse(raw) as { content?: unknown[] };
    function hasText(node: unknown): boolean {
      if (!node || typeof node !== "object") return false;
      const n = node as { text?: string; content?: unknown[] };
      if (typeof n.text === "string" && n.text.trim()) return true;
      return Array.isArray(n.content) && n.content.some(hasText);
    }
    return !hasText(doc);
  } catch {
    return true;
  }
}

export function parseContent(raw: string | null | undefined): Record<string, unknown> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = raw.trim();
  if (t.startsWith('{"type":"doc"')) {
    try { return JSON.parse(t); } catch { /* fall through to plain-text path */ }
  }
  // Legacy plain text → preserve line breaks as paragraph nodes
  return {
    type: "doc",
    content: raw.split("\n").map(line =>
      line
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph" }
    ),
  };
}

function isOnlyCheckedChange(prev: string, curr: string): boolean {
  if (!prev || !curr) return false;
  try {
    const norm = (s: string) => s.replace(/"checked"\s*:\s*(true|false)/g, '"checked":false');
    return norm(prev) === norm(curr);
  } catch { return false; }
}

function getChecklistProgress(json: string): { total: number; checked: number } | null {
  try {
    const doc = JSON.parse(json);
    let total = 0, checked = 0;
    function walk(node: { type?: string; attrs?: { checked?: boolean }; content?: unknown[] }) {
      if (node.type === "taskItem") { total++; if (node.attrs?.checked) checked++; }
      node.content?.forEach(n => walk(n as typeof node));
    }
    walk(doc);
    return total > 0 ? { total, checked } : null;
  } catch { return null; }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Svg({ d, size = 13 }: { d: string | string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const IC = {
  bold:      "M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z",
  italic:    ["M11 4h4", "M7 20h4", "M15 4l-8 16"],
  underline: ["M6 3v7a6 6 0 0 0 12 0V3", "M4 21h16"],
  strike:    ["M5 12h14", "M16 6c-1.5-1.5-8-2-10 2s2 4 4 4.5", "M8 18c1.5 1 7.5 2 10-1.5"],
  bullet:    ["M9 6h11", "M9 12h11", "M9 18h11", "M5 6v.01", "M5 12v.01", "M5 18v.01"],
  ordered:   ["M10 6h11", "M10 12h11", "M10 18h11", "M4 6h1v4", "M4 10H5", "M6 18H4l2-2c.5-.4.5-1 0-1.5L4.5 13H6"],
  task:      ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  quote:     ["M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z", "M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"],
  code:      ["M8 9l-3 3 3 3", "M16 9l3 3-3 3"],
  codeBlock: ["M2 4h20v16H2z", "M8 9l-3 3 3 3", "M16 9l3 3-3 3"],
  link:      ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  hr:        "M5 12h14",
  undo:      ["M3 7v5h5", "M3.51 15a9 9 0 1 0 2.13-9.36L3 7"],
  redo:      ["M21 7v5h-5", "M20.49 15a9 9 0 1 1-2.12-9.36L21 7"],
  clearFmt:  ["M17 11l4-4-4-4", "M13 7H3", "M13 17H3", "M9 11l-6 6 6 6"],
};

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function ToolBtn({
  active, disabled, onClick, title, children,
}: {
  active?: boolean; disabled?: boolean;
  onClick: () => void; title: string;
  children: React.ReactNode;
}) {
  const s: CSSProperties = {
    padding: "2px 4px",
    height: 24, minWidth: 24,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: active ? "var(--surface-sunk)" : "transparent",
    border: "none",
    borderRadius: "var(--r-sm)",
    cursor: disabled ? "default" : "pointer",
    color: active ? "var(--ink)" : "var(--ink-soft)",
    opacity: disabled ? 0.35 : 1,
    fontFamily: "var(--sans)",
    fontSize: 11, fontWeight: 600,
    transition: "background .1s, color .1s",
    flexShrink: 0,
  };
  return (
    <button
      type="button"
      className="rte-tool-btn"
      style={s}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={e => { e.preventDefault(); if (!disabled) onClick(); }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      style={{ width: 1, height: 14, background: "var(--rule-strong)", margin: "0 2px", flexShrink: 0 }}
    />
  );
}

export function createRichTextExtensions(placeholder: string) {
  return [
    StarterKit,
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      // No target=_blank — read-only click handler decides (preview vs new tab).
      HTMLAttributes: { rel: "noopener noreferrer" },
      isAllowedUri: (url: string) => /^(https?|mailto):/i.test(url),
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
    Typography,
  ];
}

export function Toolbar({ editor, onLinkClick }: { editor: Editor | null; onLinkClick: () => void }) {
  const tr = useTr();
  if (!editor) return null;
  const hLevel = editor.isActive("heading", { level: 1 }) ? 1
    : editor.isActive("heading", { level: 2 }) ? 2
    : editor.isActive("heading", { level: 3 }) ? 3
    : editor.isActive("heading", { level: 4 }) ? 4
    : 0;

  return (
    <div
      role="toolbar"
      aria-label={tr("Text formatting")}
      className="rte-toolbar"
      style={{
        display: "flex", alignItems: "center", gap: 1,
        padding: "4px 8px",
        borderBottom: "1px solid var(--rule)",
        background: "var(--surface)",
        borderRadius: "var(--r-sm) var(--r-sm) 0 0",
      }}
    >
      <select
        aria-label={tr("Text style")}
        value={hLevel}
        onChange={e => {
          const v = Number(e.target.value);
          if (v === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: v as 1|2|3|4 }).run();
        }}
        onBlur={() => editor.commands.focus()}
        style={{
          height: 24, padding: "0 14px 0 5px", fontSize: 11,
          fontFamily: "var(--sans)", background: "var(--surface)",
          color: "var(--ink-soft)", border: "1px solid var(--rule)",
          borderRadius: "var(--r-sm)", cursor: "pointer", flexShrink: 0,
        }}
      >
        <option value={0}>{tr("Para")}</option>
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
        <option value={4}>H4</option>
      </select>

      <Sep />

      <ToolBtn active={editor.isActive("bold")} title={tr("Bold (Ctrl+B)")}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Svg d={IC.bold} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("italic")} title={tr("Italic (Ctrl+I)")}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Svg d={IC.italic} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("underline")} title={tr("Underline (Ctrl+U)")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Svg d={IC.underline} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("strike")} title={tr("Strikethrough")}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Svg d={IC.strike} />
      </ToolBtn>

      <Sep />

      <ToolBtn active={editor.isActive("bulletList")} title={tr("Bullet List")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <Svg d={IC.bullet} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("orderedList")} title={tr("Numbered List")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <Svg d={IC.ordered} />
      </ToolBtn>

      <Sep />

      <ToolBtn active={editor.isActive("code")} title={tr("Inline Code")}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        <Svg d={IC.code} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("codeBlock")} title={tr("Code Block")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Svg d={IC.codeBlock} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("link")} title={tr("Insert Link")}
        onClick={onLinkClick}>
        <Svg d={IC.link} />
      </ToolBtn>

      <Sep />

      <ToolBtn active={false} title={tr("Horizontal Divider")}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Svg d={IC.hr} />
      </ToolBtn>

      <Sep />

      <ToolBtn active={false} disabled={!editor.can().undo()} title={tr("Undo (Ctrl+Z)")}
        onClick={() => editor.chain().focus().undo().run()}>
        <Svg d={IC.undo} />
      </ToolBtn>
      <ToolBtn active={false} disabled={!editor.can().redo()} title={tr("Redo (Ctrl+Shift+Z)")}
        onClick={() => editor.chain().focus().redo().run()}>
        <Svg d={IC.redo} />
      </ToolBtn>

      <Sep />

      <ToolBtn active={false} title={tr("Clear Formatting")}
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
        <Svg d={IC.clearFmt} />
      </ToolBtn>
    </div>
  );
}

// ─── Link Dialog ──────────────────────────────────────────────────────────────

/** Normalize pasted URLs for TipTap Link (requires http(s)/mailto). */
export function normalizeComposerLinkHref(raw: string): string {
  const href = raw.trim();
  if (!href) return "";
  if (/^(https?:\/\/|mailto:)/i.test(href)) return href;
  if (href.startsWith("//")) return `https:${href}`;

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

  // App-relative: "/omnistudio/..." → https://site/omnistudio/...
  if (href.startsWith("/")) {
    return origin ? `${origin}${href}` : href;
  }

  // Path-like without protocol (e.g. "omnistudio/media/uuid") — not a domain.
  const firstSeg = href.split("/")[0] || "";
  if (origin && href.includes("/") && !firstSeg.includes(".")) {
    return `${origin}/${href.replace(/^\/+/, "")}`;
  }

  return `https://${href.replace(/^\/+/, "")}`;
}

export function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const tr = useTr();
  const existing = editor.getAttributes("link").href || "";
  const [url, setUrl] = useState<string>(existing);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 10); }, []);

  function apply() {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }

    const full = normalizeComposerLinkHref(trimmed);
    // TipTap Link.isAllowedUri only accepts http(s)/mailto — refuse silently
    // would leave the composer looking like Apply did nothing.
    if (!/^(https?|mailto):/i.test(full)) {
      onClose();
      return;
    }

    const { empty } = editor.state.selection;
    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: full }).run();
    } else if (empty) {
      // setLink on an empty selection creates an invisible mark — insert text.
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: "text",
            text: full,
            marks: [{ type: "link", attrs: { href: full } }],
          },
        ])
        .run();
    } else {
      editor.chain().focus().setLink({ href: full }).run();
    }
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-label={tr("Insert link")}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px",
        borderBottom: "1px solid var(--rule)",
        background: "var(--page)",
      }}
    >
      <Svg d={IC.link} size={12} />
      <input
        ref={inputRef}
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); apply(); }
          if (e.key === "Escape") onClose();
        }}
        placeholder="https://..."
        aria-label={tr("URL")}
        style={{
          flex: 1, border: "none", outline: "none",
          background: "transparent", fontSize: 12,
          fontFamily: "var(--sans)", color: "var(--ink)",
        }}
      />
      {existing && (
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            onClose();
          }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--crit)", fontSize: 11, fontFamily: "var(--sans)", padding: "2px 6px",
          }}
        >
          {tr("Remove")}
        </button>
      )}
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); apply(); }}
        style={{
          background: "var(--green-deep)", color: "var(--avatar-fg)",
          border: "none", borderRadius: "var(--r-sm)",
          padding: "3px 10px", fontSize: 11, fontFamily: "var(--sans)", cursor: "pointer",
        }}
      >
        {tr("Apply")}
      </button>
      <button
        type="button"
        aria-label={tr("Close link dialog")}
        onMouseDown={e => { e.preventDefault(); onClose(); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--ink-mute)", fontSize: 18, lineHeight: 1, padding: "0 2px",
        }}
      >
        &times;
      </button>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ checked, total }: { checked: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
  return (
    <div
      role="status"
      aria-label={`${checked} of ${total} checklist items completed`}
      style={{
        padding: "7px 12px",
        borderTop: "1px solid var(--rule)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 4, background: "var(--surface-sunk)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: pct === 100 ? "var(--ok)" : "var(--green)",
            borderRadius: 2, transition: "width .2s ease",
          }} />
        </div>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 10,
          color: pct === 100 ? "var(--ok)" : "var(--ink-mute)",
          whiteSpace: "nowrap",
        }}>
          {checked}&thinsp;/&thinsp;{total}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  content: string;
  onChange: (json: string) => void;
  onAutoSave?: (json: string) => Promise<void> | void;
  readOnly?: boolean;
  dirty?: boolean;
  placeholder?: string;
  /** No border/background — use inside an already-framed parent (e.g. comment card). */
  plain?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  onAutoSave,
  readOnly = false,
  dirty = false,
  placeholder = "Write a detailed description...",
  plain = false,
}: RichTextEditorProps) {
  const tr = useTr();
  const [isEditing, setIsEditing] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const [progress, setProgress] = useState<{ total: number; checked: number } | null>(() =>
    getChecklistProgress(content)
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalRef = useRef<string>(content);
  const prevJsonRef = useRef<string>(content);
  // The editor's own serialization of the CURRENT external content. The editor
  // re-serializes the loaded doc on mount (and after an external setContent),
  // firing an "update" whose JSON differs from the raw stored string — that is
  // NOT a user edit and must not propagate (else it marks the consumer dirty
  // with no change, e.g. the task modal's false discard-confirm on close).
  const mountBaselineRef = useRef<string | null>(null);

  const handleChange = useCallback((json: string) => {
    // Skip no-op emissions that merely reflect the current content baseline.
    if (json === mountBaselineRef.current) return;
    lastExternalRef.current = json;
    onChange(json);
    setProgress(getChecklistProgress(json));

    if (!onAutoSave) return;

    const isChecklist = isOnlyCheckedChange(prevJsonRef.current, json);
    prevJsonRef.current = json;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (isChecklist) {
      void onAutoSave(json);
    } else {
      debounceRef.current = setTimeout(() => void onAutoSave(json), 1500);
    }
  }, [onChange, onAutoSave]);

  // Keep a stable ref so the editor's update listener never captures a stale closure.
  const handleChangeRef = useRef(handleChange);
  handleChangeRef.current = handleChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createRichTextExtensions(placeholder),
    content: parseContent(content) ?? "",
    editable: false,
    // onUpdate intentionally omitted — wired via editor.on() below to avoid stale closure
  });

  // Register update listener once; reads latest handleChange via ref.
  useEffect(() => {
    if (!editor) return;
    // Capture the editor's serialization of the initial content BEFORE any
    // update fires, so a mount-time re-serialization compares equal and is
    // suppressed by handleChange (no spurious dirty).
    if (mountBaselineRef.current === null) mountBaselineRef.current = JSON.stringify(editor.getJSON());
    const handler = () => handleChangeRef.current(JSON.stringify(editor.getJSON()));
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor]);

  // Sync when a different task is opened (content prop replaces externally)
  useEffect(() => {
    if (!editor || content === lastExternalRef.current) return;
    lastExternalRef.current = content;
    prevJsonRef.current = content;
    editor.commands.setContent(parseContent(content) ?? "");
    // New external content → its normalized serialization is the new baseline,
    // so the setContent-triggered "update" is a no-op, not a change.
    mountBaselineRef.current = JSON.stringify(editor.getJSON());
    setProgress(getChecklistProgress(content));
    setIsEditing(false);
    setShowLink(false);
  }, [content, editor]);

  // Toggle editable based on editing state
  useEffect(() => {
    if (!editor) return;
    const shouldEdit = isEditing && !readOnly;
    editor.setEditable(shouldEdit);
    if (shouldEdit) setTimeout(() => editor.commands.focus("end"), 20);
  }, [editor, isEditing, readOnly]);

  // Flush any pending debounced save and clear timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Remove the showLink guard so clicking outside always exits editing.
  // The container.contains() check is sufficient — link dialog is inside the container.
  function handleContainerBlur(e: React.FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && containerRef.current && containerRef.current.contains(next)) return;
    setShowLink(false);
    setIsEditing(false);
  }

  function handleContainerClick(e: React.MouseEvent) {
    // In read-only mode, allow link clicks (editable:false blocks ProseMirror's handler)
    if (readOnly) {
      // Images: in-page lightbox — never open a new tab.
      const img = (e.target as HTMLElement).closest("img");
      if (img) {
        e.preventDefault();
        e.stopPropagation();
        const src = img.getAttribute("src") || "";
        if (src) setImagePreview({ src, alt: img.getAttribute("alt") || "" });
        return;
      }
      const a = (e.target as HTMLElement).closest("a");
      if (a) {
        e.preventDefault();
        const href = safeUrl(a.getAttribute("href") ?? "");
        if (!href) return;
        if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(href)) {
          setImagePreview({ src: href, alt: a.textContent || "image" });
          return;
        }
        window.open(href, "_blank", "noopener,noreferrer");
      }
      return;
    }
    if (!isEditing) {
      // Activate editable synchronously so the first click lands inside the editor
      editor?.setEditable(true);
      setIsEditing(true);
    }
  }

  const isEmpty = editor?.isEmpty ?? !content?.trim();

  const containerStyle: CSSProperties = {
    border: plain ? "none" : "1px solid var(--rule-strong)",
    borderRadius: plain ? 0 : "var(--r-sm)",
    background: plain ? "transparent" : "var(--page)",
    boxShadow: plain
      ? "none"
      : dirty
        ? "0 0 0 2px var(--ochre)"
        : isEditing
          ? "0 0 0 2px var(--green-wash)"
          : "none",
    transition: "box-shadow .15s",
    cursor: !readOnly && !isEditing ? "text" : "default",
    overflow: "hidden",
  };

  return (
    <div
      ref={containerRef}
      className={plain ? "rte-plain" : undefined}
      style={containerStyle}
      onBlur={handleContainerBlur}
      onClick={handleContainerClick}
    >
      {isEditing && !readOnly && (
        <>
          <Toolbar editor={editor} onLinkClick={() => setShowLink(s => !s)} />
          {showLink && editor && (
            <LinkDialog editor={editor} onClose={() => setShowLink(false)} />
          )}
        </>
      )}

      {/* Empty state for read-only viewers */}
      {readOnly && isEmpty ? (
        plain ? null : (
          <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--ink-mute)" }}>
            {tr("No description added")}
          </div>
        )
      ) : (
        <EditorContent editor={editor} />
      )}

      {progress && (
        <ProgressBar checked={progress.checked} total={progress.total} />
      )}

      {imagePreview ? (
        <ImageLightbox
          src={imagePreview.src}
          alt={imagePreview.alt}
          onClose={() => setImagePreview(null)}
        />
      ) : null}
    </div>
  );
}
