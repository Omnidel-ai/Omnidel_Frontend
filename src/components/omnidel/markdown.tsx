"use client";

import { Fragment, useState, type ReactNode, type CSSProperties } from "react";
import { blobViewUrl } from "@/lib/client/blob-url";
import { ImageLightbox, type LightboxImage } from "@/components/omnidel/image-lightbox";

// ─────────────────────────────────────────────────────────────────────────────
// Zero-dependency Markdown renderer for the task-comments feed.
// Scope (matches Trello's MD subset):
//   bold (**...** / __...__), italic (*...* / _..._), inline code (`...`),
//   fenced code (```...```), # / ## / ### headings, - / 1. lists (incl. nested via 2-space indent),
//   > blockquotes, --- hr, [text](url) links, ![alt](url) images,
//   autolinks (bare https?://), GFM tables (| header |).
//
// Security:
//   - We never inject raw HTML. The input is split into spans + text nodes
//     so React's escaping handles XSS. URLs are whitelisted to http(s) /
//     mailto / root-relative `/…` (same-origin). Absolute OmniStudio
//     URLs are rewritten to `/omnistudio/…` so stale ngrok hosts never win.
//     Images & links rendered with rel="noreferrer noopener".
//
// Trade-offs:
//   - Block parser is line-based + light. Tables are fully supported (GFM);
//     nested lists via 2-space indent are now supported. Footnotes still not.
//     Anything fancier can move to a real lib if/when we relax the no-deps rule.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rewrite absolute OmniStudio app URLs to root-relative paths so comments
 * stay on the viewer's current host (localhost / prod) instead of a stale
 * tunnel that was baked in when Share to task ran (ERR_NGROK_3200).
 */
function toSameOriginOmnistudioPath(absolute: string): string | null {
  try {
    const u = new URL(absolute);
    if (!/^\/omnistudio(\/|$)/i.test(u.pathname)) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

// Safe URL gate — http(s), mailto, and same-origin root-relative `/…` paths.
// Anything else (javascript:, data:, etc.) is null so callers fall back to
// rendering the raw text.
export function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  // Allow protocol-relative for completeness (treated as https).
  if (/^\/\//.test(url)) {
    const asHttps = `https:${url}`;
    return toSameOriginOmnistudioPath(asHttps) ?? asHttps;
  }
  // Root-relative in-app paths (Share-to-task "Open media chat", etc.).
  if (url.startsWith("/") && !url.startsWith("//")) {
    if (/[\s<>"'`]/.test(url)) return null;
    return url;
  }
  if (/^(https?|mailto):/i.test(url)) {
    if (/^https?:/i.test(url)) {
      const relative = toSameOriginOmnistudioPath(url);
      if (relative) return relative;
    }
    return url;
  }
  return null;
}

// Extract bare http(s) URLs for LinkPreview cards under a comment body.
// Markdown links `[label](url)` and images `![alt](url)` are intentionally
// excluded — they already render as green underlined <a> / inline images via
// Markdown. Unfurling them produced ugly OG cards (e.g. truncated ngrok host
// for Share-to-task "Open media chat" notes). Only paste-as-bare URLs unfurl.
export function extractUrls(source: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  // Pre-pass — gather image + labeled-link hrefs into `seen` so the bare-URL
  // pass does not also match the same URL sitting inside `(...)`.
  const mdImage = /!\[[^\]]*\]\(([^)\s]+)\)/g;
  while ((m = mdImage.exec(source))) {
    const url = safeUrl(m[1]);
    if (url) seen.add(url);
  }
  const mdLink = /(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g;
  while ((m = mdLink.exec(source))) {
    const url = safeUrl(m[1]);
    if (url) seen.add(url);
  }

  // Bare http(s) URLs only — these get Trello-style LinkPreview cards.
  const bare = /(https?:\/\/[^\s<>()'"]+)/g;
  while ((m = bare.exec(source))) {
    // Trim trailing punctuation that's almost certainly not part of the URL.
    const url = safeUrl(m[1].replace(/[.,;:!?)\]]+$/, ""));
    if (url && !seen.has(url)) { seen.add(url); out.push(url); }
  }
  return out;
}

// ─── Inline pass — turns a single line of text into a list of React nodes ────

interface InlineToken {
  kind: "text" | "bold" | "italic" | "code" | "link" | "image" | "br" | "mention";
  value?: string;
  href?: string;
  children?: InlineToken[];
}

interface InlineOpts {
  /** When false, link markdown and autolinks render as plain text (avoids nested <a>). */
  allowLinks?: boolean;
  /** Known @mention display names — enables highlighting multi-word names. */
  mentionNames?: string[];
}

// Threaded through the render pass (not the tokenize pass). Carries side-effects
// the pure token walk can't hold — currently the image-click handler that opens
// the shared lightbox.
interface RenderCtx {
  onImageClick?: (src: string) => void;
}

// A `@` starts a mention only at the start of the line or after whitespace, so
// email addresses (foo@bar) and mid-word @ never highlight.
function isMentionBoundary(line: string, at: number): boolean {
  return at === 0 || /\s/.test(line[at - 1]);
}

function tokenizeInline(line: string, opts: InlineOpts = {}): InlineToken[] {
  const allowLinks = opts.allowLinks !== false;
  // Order matters: longer markers (** / ``` already handled by block) first,
  // then * / _, then ` for inline code, then links / images / autolinks.
  // This is a small state-machine pass — not a full grammar.
  const tokens: InlineToken[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];

    // Mention: @Display Name (matched against known names) or a bare @handle.
    if (ch === "@" && isMentionBoundary(line, i)) {
      const rest = line.slice(i + 1);
      // Prefer the longest known name whose text follows the @ (names may have
      // spaces, e.g. "@Gaurav Kamble"). opts.mentionNames is pre-sorted longest
      // first so the first hit is the greediest.
      let matched: string | null = null;
      for (const name of opts.mentionNames || []) {
        if (!name) continue;
        if (rest.slice(0, name.length).toLowerCase() === name.toLowerCase()) {
          const after = rest[name.length];
          // Must end at a word boundary so "@Ann" doesn't match inside "@Anne".
          if (after === undefined || !/[A-Za-z0-9]/.test(after)) {
            matched = rest.slice(0, name.length);
            break;
          }
        }
      }
      // Fallback: a single @handle token (legacy slugs / single-word names).
      if (!matched) {
        const m = /^[A-Za-z0-9._-]+/.exec(rest);
        if (m) matched = m[0];
      }
      if (matched) {
        tokens.push({ kind: "mention", value: matched });
        i += 1 + matched.length;
        continue;
      }
    }

    // Image: ![alt](url)
    if (allowLinks && ch === "!" && line[i + 1] === "[") {
      const close = line.indexOf("]", i + 2);
      const open = close !== -1 ? line.indexOf("(", close) : -1;
      const endParen = open !== -1 ? line.indexOf(")", open) : -1;
      if (close !== -1 && open === close + 1 && endParen !== -1) {
        const alt = line.slice(i + 2, close);
        const href = line.slice(open + 1, endParen);
        const safe = safeUrl(href);
        if (safe) {
          tokens.push({ kind: "image", value: alt, href: safe });
          i = endParen + 1;
          continue;
        }
      }
    }

    // Link: [text](url)
    if (allowLinks && ch === "[") {
      const close = line.indexOf("]", i + 1);
      const open = close !== -1 ? line.indexOf("(", close) : -1;
      const endParen = open !== -1 ? line.indexOf(")", open) : -1;
      if (close !== -1 && open === close + 1 && endParen !== -1) {
        const text = line.slice(i + 1, close);
        const href = line.slice(open + 1, endParen);
        const safe = safeUrl(href);
        if (safe) {
          tokens.push({
            kind: "link",
            href: safe,
            // Link label must not emit nested anchors (e.g. URL inside [text](url)).
            children: tokenizeInline(text, { ...opts, allowLinks: false }),
          });
          i = endParen + 1;
          continue;
        }
      }
    }

    // Autolink: bare http(s)://...
    if (allowLinks && ch === "h" && /^https?:\/\//.test(line.slice(i))) {
      const match = /^(https?:\/\/[^\s<>()'"]+)/.exec(line.slice(i));
      if (match) {
        const raw = match[1].replace(/[.,;:!?)\]]+$/, "");
        const safe = safeUrl(raw);
        if (safe) {
          tokens.push({ kind: "link", href: safe, children: [{ kind: "text", value: raw }] });
          i += raw.length;
          continue;
        }
      }
    }

    // Inline code: `...`
    if (ch === "`") {
      const close = line.indexOf("`", i + 1);
      if (close !== -1) {
        tokens.push({ kind: "code", value: line.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    // Bold: **...** or __...__
    if ((ch === "*" && line[i + 1] === "*") || (ch === "_" && line[i + 1] === "_")) {
      const marker = ch + ch;
      const close = line.indexOf(marker, i + 2);
      if (close !== -1) {
        tokens.push({
          kind: "bold",
          children: tokenizeInline(line.slice(i + 2, close), opts),
        });
        i = close + 2;
        continue;
      }
    }

    // Italic: *...* or _..._
    if (ch === "*" || ch === "_") {
      // Don't match when adjacent to alphanumerics on the inner side without a
      // close (avoids snake_case_words and 3*5 arithmetic looking like italic).
      const close = line.indexOf(ch, i + 1);
      if (close !== -1 && close - i > 1 && line[i + 1] !== " " && line[close - 1] !== " ") {
        tokens.push({
          kind: "italic",
          children: tokenizeInline(line.slice(i + 1, close), opts),
        });
        i = close + 1;
        continue;
      }
    }

    // Fallback: accumulate a run of plain text until we hit a marker.
    const nextMarker = (() => {
      let next = line.length;
      for (const probe of ["![", "[", "`", "**", "__", "*", "_", "http", "@"]) {
        const idx = line.indexOf(probe, i + 1);
        if (idx !== -1 && idx < next) next = idx;
      }
      return next;
    })();
    const slice = line.slice(i, nextMarker);
    if (slice) tokens.push({ kind: "text", value: slice });
    i = nextMarker;
  }
  return tokens;
}

function renderInline(tokens: InlineToken[], keyPrefix: string, ctx?: RenderCtx): ReactNode[] {
  return tokens.map((tok, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (tok.kind) {
      case "text":
        return <Fragment key={key}>{tok.value}</Fragment>;
      case "br":
        return <br key={key} />;
      case "bold":
        return <strong key={key}>{renderInline(tok.children || [], key, ctx)}</strong>;
      case "italic":
        return <em key={key}>{renderInline(tok.children || [], key, ctx)}</em>;
      case "code":
        return (
          <code key={key} style={inlineCodeStyle}>{tok.value}</code>
        );
      case "mention":
        return (
          <span key={key} style={mentionStyle}>@{tok.value}</span>
        );
      case "link":
        return (
          <a
            key={key}
            href={tok.href}
            target="_blank"
            rel="noreferrer noopener"
            style={linkStyle}
          >
            {renderInline(tok.children || [], key, ctx)}
          </a>
        );
      case "image": {
        // Private Vercel blobs need the /api/uploads/view proxy. Helper passes
        // through other URLs untouched, so the markdown can keep storing the
        // canonical blob URL and only the render layer adds the proxy.
        const src = blobViewUrl(tok.href);
        const onImageClick = ctx?.onImageClick;
        // Preferred path: open the in-page lightbox. Falls back to a new-tab
        // link only if no handler is wired (defensive — Markdown always wires it).
        if (onImageClick) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => onImageClick(src)}
              style={imageButtonStyle}
              aria-label={tok.value ? `Preview image: ${tok.value}` : "Preview image"}
            >
              <img src={src} alt={tok.value || ""} style={inlineImageStyle} />
            </button>
          );
        }
        return (
          <a
            key={key}
            href={src}
            target="_blank"
            rel="noreferrer noopener"
            style={{ display: "block", margin: "6px 0" }}
          >
            <img src={src} alt={tok.value || ""} style={inlineImageStyle} />
          </a>
        );
      }
    }
  });
}

// ─── Block pass — line-based ──────────────────────────────────────────────────

interface BlockToken {
  kind: "p" | "h1" | "h2" | "h3" | "ul" | "ol" | "blockquote" | "hr" | "pre" | "table" | "list";
  lines?: string[];
  items?: string[];
  // For nested lists: parallel indent per item (0 = top-level, 1 = 2-space nested, etc.)
  indents?: number[];
  header?: string[];
  rows?: string[][];
  // Generic list that may mix ordered/unordered when nested
  listItems?: { text: string; indent: number; ordered: boolean }[];
}

// GFM table helpers. A table is a header row of `|`-separated cells, then a
// separator row of dashes (| --- | :--: | ---: |), then zero+ body rows.
function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line.trim());
}
function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}
function isTableStart(line: string, next: string): boolean {
  return line.includes("|") && isTableSeparator(next);
}

function tokenizeBlocks(source: string): BlockToken[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: BlockToken[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code: ```\n...\n```
    if (/^```/.test(trimmed)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1; // skip closing fence
      out.push({ kind: "pre", lines: body });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push({ kind: "hr" });
      i += 1;
      continue;
    }

    // Headings
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1].length as 1 | 2 | 3;
      out.push({
        kind: (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as BlockToken["kind"],
        lines: [h[2]],
      });
      i += 1;
      continue;
    }

    // Blockquote — consecutive '> ' lines collapse into one quote block.
    if (/^>\s?/.test(trimmed)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        body.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      out.push({ kind: "blockquote", lines: body });
      continue;
    }

    // List — consecutive '- ' / '* ' / '1. ' lines, with 2-space indent for nesting
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const listItems: { text: string; indent: number; ordered: boolean }[] = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const raw = lines[i];
        const indent = Math.floor((raw.match(/^\s*/)?.[0].length || 0) / 2);
        const isOrdered = /^\s*\d+\.\s+/.test(raw);
        const text = raw.replace(/^\s*(?:[-*]|\d+\.)\s+/, "").trim();
        listItems.push({ text, indent, ordered: isOrdered });
        i += 1;
      }
      // Simple top-level kind for backward compat; nested rendering uses listItems
      const allOrdered = listItems.every((it) => it.ordered);
      const allUnordered = listItems.every((it) => !it.ordered);
      if (allOrdered) {
        out.push({ kind: "ol", items: listItems.map((it) => it.text), indents: listItems.map((it) => it.indent) });
      } else if (allUnordered) {
        out.push({ kind: "ul", items: listItems.map((it) => it.text), indents: listItems.map((it) => it.indent) });
      } else {
        out.push({ kind: "list", listItems });
      }
      continue;
    }

    // GFM table — header row, |---|---| separator, then body rows.
    if (i + 1 < lines.length && isTableStart(line, lines[i + 1])) {
      const header = splitTableRow(line);
      i += 2; // consume header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      out.push({ kind: "table", header, rows });
      continue;
    }

    // Blank line — separator, advance.
    if (trimmed === "") {
      i += 1;
      continue;
    }

    // Paragraph — accumulate until a blank line / block boundary.
    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i].trim()) &&
      !/^```/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !isTableStart(lines[i], lines[i + 1] ?? "")
    ) {
      body.push(lines[i]);
      i += 1;
    }
    out.push({ kind: "p", lines: body });
  }
  return out;
}

function renderBlock(block: BlockToken, idx: number, wrapPre = false, ctx?: RenderCtx, mentionNames?: string[]): ReactNode {
  const key = `b-${idx}`;
  const inlineOpts: InlineOpts = { mentionNames };
  switch (block.kind) {
    case "h1":
      return <h1 key={key} style={h1Style}>{renderInline(tokenizeInline(block.lines?.[0] || "", inlineOpts), key, ctx)}</h1>;
    case "h2":
      return <h2 key={key} style={h2Style}>{renderInline(tokenizeInline(block.lines?.[0] || "", inlineOpts), key, ctx)}</h2>;
    case "h3":
      return <h3 key={key} style={h3Style}>{renderInline(tokenizeInline(block.lines?.[0] || "", inlineOpts), key, ctx)}</h3>;
    case "hr":
      return <hr key={key} style={hrStyle} />;
    case "pre":
      return (
        <pre key={key} style={wrapPre ? preWrapStyle : preStyle}>
          <code>{(block.lines || []).join("\n")}</code>
        </pre>
      );
    case "blockquote":
      return (
        <blockquote key={key} style={blockquoteStyle}>
          {(block.lines || []).map((l, li) => (
            <div key={`${key}-${li}`}>{renderInline(tokenizeInline(l, inlineOpts), `${key}-${li}`, ctx)}</div>
          ))}
        </blockquote>
      );
    case "ul":
      return (
        <ul key={key} style={listStyle}>
          {(block.items || []).map((it, li) => {
            const indent = block.indents?.[li] || 0;
            return (
              <li key={`${key}-${li}`} style={{ ...listItemStyle, marginLeft: indent * 16 }}>
                {renderInline(tokenizeInline(it, inlineOpts), `${key}-${li}`, ctx)}
              </li>
            );
          })}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} style={listStyle}>
          {(block.items || []).map((it, li) => {
            const indent = block.indents?.[li] || 0;
            return (
              <li key={`${key}-${li}`} style={{ ...listItemStyle, marginLeft: indent * 16 }}>
                {renderInline(tokenizeInline(it, inlineOpts), `${key}-${li}`, ctx)}
              </li>
            );
          })}
        </ol>
      );
    case "list":
      // Mixed ordered/unordered with nesting — render as nested structure
      return (
        <div key={key} style={listStyle}>
          {(block.listItems || []).map((it, li) => {
            const Tag = it.ordered ? "ol" : "ul";
            // Simple flat with indent for mixed case
            return (
              <div key={`${key}-${li}`} style={{ marginLeft: it.indent * 16, display: "flex", gap: 6 }}>
                <span style={{ color: "var(--ink-mute)", minWidth: 14, textAlign: "right" }}>{it.ordered ? `${li + 1}.` : "•"}</span>
                <span style={listItemStyle}>{renderInline(tokenizeInline(it.text, inlineOpts), `${key}-${li}`, ctx)}</span>
              </div>
            );
          })}
        </div>
      );
    case "table":
      return (
        <div key={key} style={tableWrapStyle}>
          <table style={tableStyle}>
            {block.header && block.header.length > 0 && (
              <thead>
                <tr>
                  {block.header.map((cell, ci) => (
                    <th key={`${key}-h-${ci}`} style={thStyle}>
                      {renderInline(tokenizeInline(cell, inlineOpts), `${key}-h-${ci}`, ctx)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {(block.rows || []).map((row, ri) => (
                <tr key={`${key}-r-${ri}`}>
                  {row.map((cell, ci) => (
                    <td key={`${key}-r-${ri}-${ci}`} style={tdStyle}>
                      {renderInline(tokenizeInline(cell, inlineOpts), `${key}-r-${ri}-${ci}`, ctx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "p":
    default:
      return (
        <p key={key} style={paragraphStyle}>
          {(block.lines || []).map((l, li) => (
            <Fragment key={`${key}-${li}`}>
              {li > 0 && <br />}
              {renderInline(tokenizeInline(l, inlineOpts), `${key}-${li}`, ctx)}
            </Fragment>
          ))}
        </p>
      );
  }
}

// Ordered list of every renderable image in the source, with the SAME src
// string the inline renderer produces (blobViewUrl of the safe url) so a click
// can be matched back to its index for the lightbox.
function collectImages(source: string): LightboxImage[] {
  const out: LightboxImage[] = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const safe = safeUrl(m[2]);
    if (safe) out.push({ src: blobViewUrl(safe), alt: m[1] || "" });
  }
  return out;
}

// wrapPre: render fenced code blocks with soft-wrapping instead of a horizontal
// scrollbar. Used where the surrounding container must never scroll sideways
// (e.g. the task description box).
// mentionNames: known @mention display names; when supplied, multi-word names
// (e.g. "@Gaurav Kamble") highlight fully. Without it, a single @handle token
// still highlights.
export function Markdown({
  source,
  wrapPre = false,
  mentionNames,
}: {
  source: string;
  wrapPre?: boolean;
  mentionNames?: string[];
}) {
  // Index of the image currently open in the lightbox (null = closed). Hook must
  // run before any early return so hook order stays stable.
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!source || !source.trim()) {
    return null;
  }

  const images = collectImages(source);
  const blocks = tokenizeBlocks(source);
  // Pre-sort names longest-first so the tokenizer matches the greediest name.
  const sortedMentions = mentionNames
    ? [...mentionNames].filter(Boolean).sort((a, b) => b.length - a.length)
    : undefined;
  const ctx: RenderCtx = {
    onImageClick: (src) => {
      const idx = images.findIndex((im) => im.src === src);
      setLightboxIdx(idx >= 0 ? idx : 0);
    },
  };

  return (
    <div style={containerStyle}>
      {blocks.map((b, i) => renderBlock(b, i, wrapPre, ctx, sortedMentions))}
      {lightboxIdx !== null && images.length > 0 && (
        <ImageLightbox
          images={images}
          index={lightboxIdx}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

// ─── Styles (CSS variables only) ─────────────────────────────────────────────

const containerStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.55,
  color: "var(--ink)",
  overflowX: "hidden",
  wordBreak: "break-word",
};
const paragraphStyle: CSSProperties = { margin: "0 0 6px 0" };
const tableWrapStyle: CSSProperties = { overflowX: "auto", maxWidth: "100%", margin: "6px 0" };
const tableStyle: CSSProperties = {
  borderCollapse: "collapse",
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.4,
};
const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "5px 10px",
  background: "var(--surface-sunk)",
  borderBottom: "2px solid var(--ink-faint)",
  fontWeight: 600,
  color: "var(--ink)",
  whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = {
  padding: "5px 10px",
  borderBottom: "1px solid var(--ink-faint)",
  color: "var(--ink)",
  verticalAlign: "top",
};
const h1Style: CSSProperties = { fontFamily: "var(--serif)", fontSize: 18, margin: "10px 0 6px" };
const h2Style: CSSProperties = { fontFamily: "var(--serif)", fontSize: 16, margin: "10px 0 6px" };
const h3Style: CSSProperties = { fontFamily: "var(--serif)", fontSize: 14, margin: "8px 0 4px" };
const hrStyle: CSSProperties = {
  borderWidth: 0, borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "var(--rule)",
  margin: "10px 0",
};
const preStyle: CSSProperties = {
  margin: "6px 0", padding: "8px 10px",
  background: "var(--surface-sunk)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  fontFamily: "var(--mono)", fontSize: 12,
  color: "var(--ink-soft)",
  overflowX: "auto",
  whiteSpace: "pre",
};
// Same as preStyle but soft-wraps long lines so a code block never forces a
// horizontal scrollbar on its container (used by the task description box).
const preWrapStyle: CSSProperties = {
  ...preStyle,
  overflowX: "hidden",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
const inlineCodeStyle: CSSProperties = {
  padding: "1px 5px", borderRadius: 3,
  background: "var(--surface-sunk)",
  fontFamily: "var(--mono)", fontSize: 12,
  color: "var(--ink-soft)",
};
const blockquoteStyle: CSSProperties = {
  margin: "6px 0",
  paddingLeft: 10,
  borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: "var(--rule-strong)",
  color: "var(--ink-soft)",
  fontStyle: "italic",
};
const listStyle: CSSProperties = { margin: "4px 0 6px 0", paddingLeft: 22 };
const listItemStyle: CSSProperties = { margin: "2px 0" };
const linkStyle: CSSProperties = {
  color: "var(--green-deep)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
const inlineImageStyle: CSSProperties = {
  maxWidth: "100%",
  maxHeight: 320,
  borderRadius: "var(--r-sm)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  display: "block",
};
// Transparent button wrapper so a comment image opens the in-page lightbox
// (instead of a new tab) while keeping the image's own look.
const imageButtonStyle: CSSProperties = {
  display: "block",
  margin: "6px 0",
  padding: 0,
  border: "none",
  background: "none",
  cursor: "zoom-in",
  maxWidth: "100%",
};
// @mention pill — reuses the app's green accent (matches tags, mention menu
// hover, and the label wash) so mentions read instantly as "a person."
const mentionStyle: CSSProperties = {
  padding: "1px 6px",
  borderRadius: "var(--r-sm)",
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};
