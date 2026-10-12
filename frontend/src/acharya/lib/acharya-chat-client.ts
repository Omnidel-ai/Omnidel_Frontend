"use client";

import type { ChatMessage, Lang } from "@/acharya/lib/store";
import { isVoiceLang, type VoiceLang } from "@/acharya/lib/i18n/registry";

export type ChatWireMessage = {
  role: "user" | "assistant";
  content: string;
  /** data: URL or https URL — only for user turns with a photo. */
  image?: string;
};

/** Strip empty assistant bubbles; keep photo-only user turns for vision. */
export function toWireMessages(messages: ChatMessage[]): ChatWireMessage[] {
  return messages
    .filter((m) => {
      const hasText = typeof m.content === "string" && m.content.trim().length > 0;
      const hasImage = Boolean(m.image || m.attachmentUrl);
      return hasText || hasImage;
    })
    .map((m) => {
      const image = m.image || m.attachmentUrl || undefined;
      const content =
        typeof m.content === "string" && m.content.trim().length > 0
          ? m.content
          : image
            ? "(photo)"
            : "";
      return image && m.role === "user"
        ? { role: m.role, content, image }
        : { role: m.role, content };
    });
}

/** True when the assistant bubble is a transport failure we should not keep. */
export function isReachabilityErrorBubble(content: string): boolean {
  const c = content.trim();
  return (
    /^Couldn't reach the Acharya:/i.test(c) ||
    /^Couldn't reach MahAcharya/i.test(c) ||
    /^Failed to fetch$/i.test(c)
  );
}

/**
 * Abort / unload / "Failed to fetch" — do not persist as a chat error.
 * Reload mid-stream should resume, not show "network error".
 */
export function isTransientChatFailure(err: unknown): boolean {
  if (err == null) return false;
  if (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") {
    return true;
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    if (/abort/i.test(err.message)) return true;
    if (/failed to fetch|networkerror|load failed|network error/i.test(err.message)) return true;
  }
  // Chrome often throws TypeError: Failed to fetch on unload.
  if (typeof TypeError !== "undefined" && err instanceof TypeError) return true;
  return false;
}

/**
 * True when a transient failure happened on a LIVE, visible turn — i.e. the
 * karigar is sitting there watching, not reloading or backgrounding the tab.
 *
 * The transient path exists so an abort during reload/unload never persists a
 * "network error" bubble ([[2026-08-02]] fix). But it also swallowed genuine
 * live failures: `isTransientChatFailure` returns true for **any** TypeError,
 * so a real send failure vanished with no bubble, no retry left, and no
 * server-side log — the karigar pressed Send and nothing happened at all.
 *
 * Silence is correct for an unload. Silence is a bug for a live turn.
 */
export function shouldSurfaceTransientFailure(aborted: boolean): boolean {
  if (aborted) return false;
  if (typeof document === "undefined") return false;
  return document.visibilityState === "visible";
}

/**
 * Shown when a live turn has exhausted its one retry. English to match the
 * existing "Couldn't reach the Acharya" string — the chat error strings are not
 * yet in `strings.ts`; translating them is a separate, app-wide pass.
 *
 * Mentions signing in because an expired karigar session is the most common
 * cause: middleware answers an unauthenticated `/api/*` call with a 401, and
 * before that fix it 307'd to the login page and the POST died as a 405.
 */
export const CHAT_RETRY_EXHAUSTED_MESSAGE =
  "Couldn't send that — the connection dropped. Please try again; if it keeps failing, close and reopen the app to sign in again.";

/**
 * Drop trailing empty / reachability-error assistant turns so history ends on
 * the pending user message (ready to resume).
 */
export function stripIncompleteAssistantTail(messages: ChatMessage[]): ChatMessage[] {
  let out = [...messages];
  while (out.length > 0) {
    const last = out[out.length - 1];
    if (last.role !== "assistant") break;
    const c = typeof last.content === "string" ? last.content.trim() : "";
    if (!c || isReachabilityErrorBubble(c)) {
      out = out.slice(0, -1);
      continue;
    }
    break;
  }
  return out;
}

/**
 * If the last turn is a user message awaiting a reply, return that history
 * (after stripping incomplete assistants). Otherwise null.
 */
export function pendingChatHistoryForResume(messages: ChatMessage[]): ChatMessage[] | null {
  const cleaned = stripIncompleteAssistantTail(messages);
  if (cleaned.length === 0) return null;
  if (cleaned[cleaned.length - 1].role !== "user") return null;
  return cleaned;
}

/**
 * Stream an Acharya reply from POST /api/work/chat.
 * `onTextUpdate` receives the raw accumulated stream text on each chunk.
 */
export async function streamAcharyaChatReply(opts: {
  workspace?: string;
  taskId?: string;
  acharyaSlug?: string;
  /** Home MahAcharya navigator — text chat + app nav tools (no task tools). */
  mode?: "home_nav";
  /** Acharya slugs/names the home navigator may open. */
  availableAcharyas?: Array<{ slug: string; displayName: string }>;
  lang: Lang;
  /** Explicit per-conversation language; app/profile language stays in `lang`. */
  conversationLang?: VoiceLang;
  messages: ChatWireMessage[];
  onTextUpdate: (accumulated: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const body: Record<string, unknown> = {
    lang: opts.lang,
    messages: opts.messages,
  };
  const workspace = opts.workspace?.trim();
  if (workspace) body.workspace = workspace;
  if (opts.taskId) body.taskId = opts.taskId;
  if (opts.acharyaSlug?.trim()) body.acharyaSlug = opts.acharyaSlug.trim();
  if (opts.mode === "home_nav") body.mode = "home_nav";
  if (opts.availableAcharyas?.length) body.availableAcharyas = opts.availableAcharyas;
  if (isVoiceLang(opts.conversationLang)) body.conversationLang = opts.conversationLang;

  const r = await fetch("/api/work/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  // 401 is now the honest answer for an expired karigar session (middleware used
  // to 307 to the login PAGE, which turned this POST into a 405 + HTML). Give it
  // a message a karigar can act on rather than a bare status code.
  if (r.status === 401) throw new Error("your session ended — please sign in again");
  if (!r.ok || !r.body) throw new Error(`chat ${r.status}`);

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    opts.onTextUpdate(acc);
  }
  return acc;
}
