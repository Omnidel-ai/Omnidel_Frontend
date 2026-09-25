"use client";

import type { CSSProperties, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { looksLikeMarkdown } from "@/components/TaskDescription";
import { blobViewUrl } from "@/lib/blob-url";
import { resolveTaskText } from "@/lib/task-text";

type JsonLike = Record<string, unknown>;

export function isTiptapDoc(raw: string | null | undefined): boolean {
  const t = typeof raw === "string" ? raw.trim() : "";
  return t.startsWith('{"type":"doc"');
}

function tryParseDoc(raw: string): JsonLike | null {
  try {
    const doc = JSON.parse(raw) as JsonLike;
    if (doc && doc.type === "doc" && Array.isArray(doc.content)) return doc;
  } catch {
    /* ignore */
  }
  return null;
}

function markStyle(marks: unknown): CSSProperties | undefined {
  if (!Array.isArray(marks) || marks.length === 0) return undefined;
  const style: CSSProperties = {};
  let href: string | undefined;
  for (const mark of marks) {
    if (!mark || typeof mark !== "object") continue;
    const m = mark as { type?: string; attrs?: { href?: string } };
    if (m.type === "bold" || m.type === "strong") style.fontWeight = 700;
    if (m.type === "italic" || m.type === "em") style.fontStyle = "italic";
    if (m.type === "underline") style.textDecoration = "underline";
    if (m.type === "strike" || m.type === "strikethrough") {
      style.textDecoration = style.textDecoration
        ? `${style.textDecoration} line-through`
        : "line-through";
    }
    if (m.type === "code") {
      style.fontFamily = "var(--font-mono), ui-monospace, monospace";
      style.fontSize = "0.92em";
      style.background = "var(--surface-sunk)";
      style.padding = "0 4px";
      style.borderRadius = 4;
    }
    if (m.type === "link" && typeof m.attrs?.href === "string") {
      href = m.attrs.href;
    }
  }
  if (href) (style as CSSProperties & { ["--href"]?: string })["--href"] = href;
  return Object.keys(style).length ? style : undefined;
}

function linkHref(marks: unknown): string | null {
  if (!Array.isArray(marks)) return null;
  for (const mark of marks) {
    if (!mark || typeof mark !== "object") continue;
    const m = mark as { type?: string; attrs?: { href?: string } };
    if (m.type === "link" && typeof m.attrs?.href === "string" && m.attrs.href.trim()) {
      return m.attrs.href.trim();
    }
  }
  return null;
}

function renderInline(nodes: unknown[] | undefined, keyPrefix: string): ReactNode[] {
  if (!nodes?.length) return [];
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!node || typeof node !== "object") return null;
    const n = node as JsonLike;
    const type = typeof n.type === "string" ? n.type : "";

    if (type === "text") {
      const text = typeof n.text === "string" ? n.text : "";
      if (!text) return null;
      const style = markStyle(n.marks);
      const href = linkHref(n.marks);
      if (href) {
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{ ...style, color: "var(--green-deep)", textDecoration: "underline" }}
          >
            {text}
          </a>
        );
      }
      return style ? (
        <span key={key} style={style}>{text}</span>
      ) : (
        <span key={key}>{text}</span>
      );
    }

    if (type === "hardBreak") return <br key={key} />;

    if (type === "mention") {
      const attrs = (n.attrs && typeof n.attrs === "object" ? n.attrs : {}) as {
        label?: string;
        id?: string;
      };
      const label = (attrs.label || attrs.id || "mention").trim();
      return (
        <span
          key={key}
          style={{
            fontWeight: 600,
            color: "var(--green-deep)",
            background: "var(--green-wash, var(--surface-sunk))",
            borderRadius: 4,
            padding: "0 4px",
          }}
        >
          @{label}
        </span>
      );
    }

    if (Array.isArray(n.content)) {
      return <span key={key}>{renderInline(n.content as unknown[], key)}</span>;
    }
    return null;
  });
}

function renderBlock(node: unknown, key: string): ReactNode {
  if (!node || typeof node !== "object") return null;
  const n = node as JsonLike;
  const type = typeof n.type === "string" ? n.type : "";
  const children = Array.isArray(n.content) ? (n.content as unknown[]) : [];

  if (type === "paragraph") {
    const inline = renderInline(children, key);
    if (!inline.some(Boolean)) return <p key={key} style={{ margin: "0 0 0.55em" }}>&nbsp;</p>;
    return (
      <p key={key} style={{ margin: "0 0 0.55em" }}>
        {inline}
      </p>
    );
  }

  if (type === "heading") {
    const level = Number((n.attrs as { level?: number } | undefined)?.level) || 3;
    const Tag = (level <= 2 ? "h3" : "h4") as "h3" | "h4";
    return (
      <Tag key={key} style={{ margin: "0 0 0.45em", fontWeight: 700, fontSize: level <= 2 ? 15 : 14 }}>
        {renderInline(children, key)}
      </Tag>
    );
  }

  if (type === "bulletList") {
    return (
      <ul key={key} style={{ margin: "0 0 0.55em", paddingLeft: 18 }}>
        {children.map((child, i) => renderBlock(child, `${key}-li-${i}`))}
      </ul>
    );
  }

  if (type === "orderedList") {
    return (
      <ol key={key} style={{ margin: "0 0 0.55em", paddingLeft: 18 }}>
        {children.map((child, i) => renderBlock(child, `${key}-li-${i}`))}
      </ol>
    );
  }

  if (type === "listItem") {
    return <li key={key} style={{ marginBottom: 4 }}>{children.map((child, i) => renderBlock(child, `${key}-c-${i}`))}</li>;
  }

  if (type === "blockquote") {
    return (
      <blockquote
        key={key}
        style={{
          margin: "0 0 0.55em",
          paddingLeft: 10,
          borderLeft: "3px solid var(--rule-strong)",
          color: "var(--ink-soft)",
        }}
      >
        {children.map((child, i) => renderBlock(child, `${key}-bq-${i}`))}
      </blockquote>
    );
  }

  if (type === "codeBlock") {
    const text = children
      .map((c) => (c && typeof c === "object" && typeof (c as JsonLike).text === "string" ? (c as JsonLike).text : ""))
      .join("");
    return (
      <pre
        key={key}
        style={{
          margin: "0 0 0.55em",
          padding: 10,
          borderRadius: 8,
          background: "var(--surface-sunk)",
          overflowX: "auto",
          fontSize: 12,
          fontFamily: "var(--font-mono), ui-monospace, monospace",
        }}
      >
        {text}
      </pre>
    );
  }

  // OmniDel / TipTap paste-upload embeds proof photos as image nodes (not only
  // the attachments[] array). Without this, completion/manager photos vanish.
  if (type === "image") {
    const attrs = (n.attrs && typeof n.attrs === "object" ? n.attrs : {}) as {
      src?: string;
      alt?: string;
      title?: string;
    };
    const src = typeof attrs.src === "string" ? attrs.src.trim() : "";
    if (!src) return null;
    const viewUrl = blobViewUrl(src) || src;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={key}
        src={viewUrl}
        alt={attrs.alt || attrs.title || "Comment image"}
        style={{
          display: "block",
          width: "100%",
          maxWidth: 260,
          maxHeight: 180,
          objectFit: "cover",
          margin: "0.35em 0 0.65em",
          borderRadius: "var(--r-md, 10px)",
          border: "1px solid var(--rule)",
          background: "var(--surface-sunk)",
        }}
      />
    );
  }

  if (children.length) {
    return <div key={key}>{children.map((child, i) => renderBlock(child, `${key}-n-${i}`))}</div>;
  }
  return null;
}

const bodyStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.55,
  color: "var(--ink)",
  wordBreak: "break-word",
};

/**
 * Renders OmniDel task-card comments with the same formatting the desktop
 * Comments panel shows (TipTap bold/italic/links/mentions, or markdown/plain).
 */
export function CommentRichBody({ content }: { content: string | null | undefined }) {
  if (!content?.trim()) return null;
  const raw = content.trim();

  if (isTiptapDoc(raw)) {
    const doc = tryParseDoc(raw);
    if (!doc) {
      const fallback = resolveTaskText(raw).trim();
      return fallback ? <p style={{ ...bodyStyle, whiteSpace: "pre-wrap", margin: 0 }}>{fallback}</p> : null;
    }
    const blocks = Array.isArray(doc.content) ? (doc.content as unknown[]) : [];
    if (blocks.length === 0) return null;
    return (
      <div style={bodyStyle} className="comment-rich-body">
        {blocks.map((block, i) => renderBlock(block, `b-${i}`))}
      </div>
    );
  }

  if (looksLikeMarkdown(raw)) {
    return (
      <div style={bodyStyle} className="comment-rich-body acharya-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
      </div>
    );
  }

  return <p style={{ ...bodyStyle, whiteSpace: "pre-wrap", margin: 0 }}>{raw}</p>;
}
