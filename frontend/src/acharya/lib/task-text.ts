import type { Lang } from "@/acharya/lib/i18n/registry";
import { polishLocalizedDisplay } from "@/acharya/lib/i18n/localize-content";

export type TaskLang = Lang;

type JsonLike = Record<string, unknown>;

const LOCALE_KEYS: Record<TaskLang, string[]> = {
  en: ["en", "english", "title_en", "description_en", "name_en", "text_en"],
  hi: ["hi", "hindi", "title_hi", "description_hi", "name_hi", "text_hi"],
  bn: ["bn", "bangla", "bengali", "title_bn", "description_bn", "name_bn", "text_bn"],
  fr: ["fr", "french", "francais", "français", "title_fr", "description_fr", "name_fr", "text_fr"],
  te: ["te", "telugu", "title_te", "description_te", "name_te", "text_te"],
  am: ["am", "amharic", "title_am", "description_am", "name_am", "text_am"],
};

function tryParseJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Tidy multi-line text without destroying its shape: normalise CRLF, drop
 * trailing spaces per line, and cap blank runs at one. The counterpart to
 * collapseWhitespace, which is still what titles want.
 */
function normalizeBlockWhitespace(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prefix a list item, indenting its continuation lines under the marker. */
function listItemLine(marker: string, content: string): string {
  const text = content.trim();
  if (!text) return "";
  const indent = " ".repeat(marker.length + 1);
  return `${marker} ${text.split("\n").join(`\n${indent}`)}`;
}

function clampHeadingLevel(attrs: unknown): number {
  const level = Number((attrs as JsonLike | null)?.level ?? 2);
  if (!Number.isFinite(level)) return 2;
  return Math.min(6, Math.max(1, Math.trunc(level)));
}

/**
 * Flatten a ProseMirror/Tiptap doc (how OmniDel stores rich task text) into
 * text that KEEPS the author's structure: paragraphs separated by a blank line,
 * list items on their own line as `- item` / `1. item`, hard breaks as newlines.
 *
 * The markers are markdown on purpose — `TaskDescription` renders markdown when
 * it sees any, so a bullet list authored in OmniDel comes out as a real list
 * instead of one run-on sentence.
 *
 * Emptiness matters: a node with no readable text must return "" (never a bare
 * `-` or `##`), because `isSerializedJsonOrArtifact` decides "is there anything
 * to show" from this output.
 */
function extractFromProseMirrorNode(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as JsonLike;

  if (typeof n.text === "string") return n.text;

  const nodeType = typeof n.type === "string" ? n.type : "";
  if (nodeType === "hardBreak") return "\n";
  // Decoration only — must not count as content.
  if (nodeType === "horizontalRule") return "";

  const children = Array.isArray(n.content) ? n.content : [];

  // Inline containers. Text nodes already carry their own spaces (a mark splits
  // "a **b** c" into "a ", "b", " c"), so they join with "" — the old " " join
  // doubled every space and only looked right because everything was collapsed
  // afterwards.
  if (nodeType === "paragraph" || nodeType === "codeBlock") {
    return children.map(extractFromProseMirrorNode).join("");
  }
  if (nodeType === "heading") {
    const inline = children.map(extractFromProseMirrorNode).join("").trim();
    return inline ? `${"#".repeat(clampHeadingLevel(n.attrs))} ${inline}` : "";
  }

  if (nodeType === "bulletList" || nodeType === "taskList") {
    return children
      .map((child) => listItemLine("-", extractFromProseMirrorNode(child)))
      .filter(Boolean)
      .join("\n");
  }
  if (nodeType === "orderedList") {
    const rawStart = Number((n.attrs as JsonLike | null)?.start ?? 1);
    const start = Number.isFinite(rawStart) ? Math.trunc(rawStart) : 1;
    return children
      .map((child, i) => listItemLine(`${start + i}.`, extractFromProseMirrorNode(child)))
      .filter(Boolean)
      .join("\n");
  }
  if (nodeType === "listItem" || nodeType === "taskItem") {
    // Holds block children — usually a single paragraph.
    return children.map(extractFromProseMirrorNode).filter(Boolean).join("\n");
  }
  if (nodeType === "blockquote") {
    const inner = children.map(extractFromProseMirrorNode).filter(Boolean).join("\n\n");
    if (!inner.trim()) return "";
    return inner
      .split("\n")
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
  }

  // doc + unknown containers: children are blocks → blank line between them.
  return children.map(extractFromProseMirrorNode).filter(Boolean).join("\n\n");
}

/** True when a string is empty, partial JSON, or ProseMirror JSON with no readable text. */
export function isSerializedJsonOrArtifact(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  if (t === "{" || t === "}" || t === "[" || t === "]") return true;
  if (!t.startsWith("{") && !t.startsWith("[")) return false;

  const parsed = tryParseJson(t);
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as JsonLike;
    if (obj.type === "doc" && Array.isArray(obj.content)) {
      return !collapseWhitespace(extractFromProseMirrorNode(obj));
    }
    const localized =
      pickLocalizedValue(obj, "bn") ||
      pickLocalizedValue(obj, "hi") ||
      pickLocalizedValue(obj, "en");
    if (localized) return !resolveTaskText(localized).trim();
    return true;
  }

  // Truncated or invalid JSON blob — never show in UI.
  return true;
}

function pickLocalizedValue(obj: JsonLike, preferredLang: TaskLang): string | null {
  const keysets: string[][] = [
    LOCALE_KEYS[preferredLang],
    LOCALE_KEYS.bn,
    LOCALE_KEYS.hi,
    LOCALE_KEYS.en,
  ];

  for (const keys of keysets) {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return null;
}

/** True when description is empty ProseMirror JSON or whitespace only. */
export function isEmptyTaskText(value: unknown): boolean {
  return !resolveTaskText(value).trim();
}

export type ResolveTaskTextOpts = {
  /**
   * Keep the author's line breaks / paragraphs / list structure. Off by default
   * so titles, chips and one-line previews stay single-line as before; on for
   * descriptions, which are rendered in a block that respects newlines.
   */
  multiline?: boolean;
};

/**
 * Resolves task title/description into plain readable text.
 * Handles plain strings, localized JSON objects, and ProseMirror/Tiptap docs.
 * Returns "" for empty docs like {"type":"doc","content":[{"type":"paragraph"}]}.
 */
export function resolveTaskText(
  value: unknown,
  preferredLang: TaskLang = "bn",
  opts?: ResolveTaskTextOpts,
): string {
  const multiline = opts?.multiline === true;
  if (value == null) return "";
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (typeof parsed === "string") {
      const trimmed = multiline ? normalizeBlockWhitespace(parsed) : parsed.trim();
      if (isSerializedJsonOrArtifact(trimmed)) return "";
      return polishLocalizedDisplay(trimmed, preferredLang, { multiline });
    }
    value = parsed;
  }

  if (typeof value !== "object") {
    return polishLocalizedDisplay(String(value).trim(), preferredLang, { multiline });
  }
  const obj = value as JsonLike;

  if (obj.type === "doc" && Array.isArray(obj.content)) {
    const flattened = extractFromProseMirrorNode(obj);
    return polishLocalizedDisplay(
      multiline ? normalizeBlockWhitespace(flattened) : collapseWhitespace(flattened),
      preferredLang,
      { multiline },
    );
  }

  const localized = pickLocalizedValue(obj, preferredLang);
  if (localized) {
    const nested = resolveTaskText(localized, preferredLang, opts);
    if (nested.trim()) return nested;
  }

  return "";
}

/**
 * Task description for display — same resolution as resolveTaskText but keeps
 * the formatting the manager typed in OmniDel (paragraphs, bullets, breaks).
 * Use this everywhere a description is rendered; titles keep resolveTaskText.
 */
export function resolveTaskDescription(
  value: unknown,
  preferredLang: TaskLang = "bn",
): string {
  return resolveTaskText(value, preferredLang, { multiline: true });
}

/** Human-readable task title for UI — never falls back to raw JSON artifacts. */
export function displayTaskTitle(
  value: unknown,
  lang?: TaskLang,
  sourceText?: string | null,
): string {
  const preferred = lang ?? "bn";
  const resolved = resolveTaskText(value, preferred).trim();
  if (resolved) {
    return polishLocalizedDisplay(resolved, preferred, { sourceText });
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (raw && !isSerializedJsonOrArtifact(raw)) {
      return polishLocalizedDisplay(raw, preferred, { sourceText });
    }
  }
  return "";
}

/** Normalize title/description on a task-shaped object for API responses. */
export function normalizeTaskTextFields<
  T extends { title: string; description: string | null },
>(
  task: T,
  lang?: TaskLang,
  sources?: { sourceTitle?: string | null; sourceDescription?: string | null },
): T {
  const preferred = lang ?? "bn";
  const title = displayTaskTitle(task.title, preferred, sources?.sourceTitle);
  // Descriptions keep their line breaks / bullets all the way to the client;
  // only the title is flattened to one line.
  const descriptionRaw = resolveTaskDescription(task.description, preferred);
  const description = polishLocalizedDisplay(descriptionRaw, preferred, {
    sourceText: sources?.sourceDescription ?? undefined,
    multiline: true,
  });
  return {
    ...task,
    title,
    description: description ? description : null,
  };
}
