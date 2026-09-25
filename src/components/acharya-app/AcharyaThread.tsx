"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStore, type Lang, type ChatMessage } from "@/lib/store";
import AcharyaAvatar from "./acharya-avatar";
import {
  isTransientChatFailure,
  pendingChatHistoryForResume,
  streamAcharyaChatReply,
  stripIncompleteAssistantTail,
  toWireMessages,
  shouldSurfaceTransientFailure,
  CHAT_RETRY_EXHAUSTED_MESSAGE,
} from "@/lib/acharya-chat-client";
import { blobViewUrl } from "@/lib/blob-url";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  formatMb,
  toVisionDataUrl,
  uploadViaClientToken,
} from "@/lib/image-intake";

export interface StatusProposal {
  taskId: string;
  status: "planned" | "doing" | "done";
  summary: string;
}

export interface AcharyaThreadHandle {
  /**
   * Inject a user utterance (e.g. from voice) into the Claude pipeline.
   * When `skipAppend` is true, the caller has already persisted the user
   * bubble (typical for voice transcripts) and we should only stream
   * Claude's reply — no duplicate user bubble.
   */
  sendUserMessage: (text: string, opts?: { skipAppend?: boolean }) => Promise<void>;
}

interface Props {
  workspaceSlug: string;
  acharyaSlug?: string;
  acharyaName: string;
  acharyaInitial: string;
  acharyaAvatarUrl?: string;
  taskId: string;
  lang: Lang;
  onTurnComplete?: () => void;
  onOpenAvatar?: () => void;
  /** Called when the Acharya proposes a status change. Parent shows the modal. */
  onProposal: (p: StatusProposal) => void;
}

// Matches `<<PROPOSE|task_id|status|summary>>` anywhere in the stream.
const PROPOSE_RX = /<<PROPOSE\|([^|]+)\|(planned|doing|done)\|([^>]+)>>/g;

// Stable reference for the loading-dots bubble — React-19 purity rule disallows
// `Date.now()` inside render.
const LOADING_BUBBLE: ChatMessage = { role: "assistant", content: "•••", ts: 0 };

// Stable empty-array reference. `useStore((s) => s.chatByTask[taskId] || [])`
// would otherwise return a fresh `[]` on every render, tripping Zustand's
// "getSnapshot should be cached" warning and an infinite loop in dev.
const EMPTY_MESSAGES: ChatMessage[] = [];

function extractProposals(text: string): { stripped: string; proposals: StatusProposal[] } {
  const proposals: StatusProposal[] = [];
  const stripped = text
    .replace(PROPOSE_RX, (_full, taskId: string, status: string, summary: string) => {
      proposals.push({ taskId, status: status as StatusProposal["status"], summary: summary.trim() });
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { stripped, proposals };
}

const AcharyaThread = forwardRef<AcharyaThreadHandle, Props>(function AcharyaThread({
  workspaceSlug, acharyaSlug, acharyaName, acharyaInitial, acharyaAvatarUrl, taskId, lang, onTurnComplete, onOpenAvatar, onProposal,
}, ref) {
  const messages = useStore((s) => s.chatByTask[taskId] ?? EMPTY_MESSAGES);
  const appendTaskMessage = useStore((s) => s.appendTaskMessage);
  const updateLastAssistant = useStore((s) => s.updateLastAssistant);
  const setTaskChat = useStore((s) => s.setTaskChat);

  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const announcedProposals = useRef<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resumeKeyRef = useRef<string | null>(null);
  const callChatRef = useRef<(msgs: ChatMessage[]) => Promise<void>>(async () => {});
  const transientRetriesRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  // Before unload / reload: abort the in-flight stream and drop empty/error
  // assistant bubbles so localStorage does not keep "network error".
  // Do NOT abort on React unmount — Strict Mode remount would kill a resumed reply.
  useEffect(() => {
    const onPageHide = () => {
      abortRef.current?.abort();
      const cur = useStore.getState().getTaskChat(taskId);
      const cleaned = stripIncompleteAssistantTail(cur);
      if (cleaned.length !== cur.length) setTaskChat(taskId, cleaned);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [setTaskChat, taskId]);

  const handleStreamUpdate = useCallback((rawAcc: string): string => {
    const { stripped, proposals } = extractProposals(rawAcc);
    for (const p of proposals) {
      const key = `${p.taskId}|${p.status}|${p.summary}`;
      if (announcedProposals.current.has(key)) continue;
      announcedProposals.current.add(key);
      onProposal(p);
    }
    return stripped;
  }, [onProposal]);

  const callChat = useCallback(async (userVisibleMessages: ChatMessage[]) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    loadingRef.current = true;
    setLoading(true);
    appendTaskMessage(taskId, { role: "assistant", content: "", ts: Date.now() });

    try {
      const acc = await streamAcharyaChatReply({
        workspace: workspaceSlug,
        taskId,
        lang,
        messages: toWireMessages(userVisibleMessages),
        signal: ac.signal,
        onTextUpdate: (chunk) => {
          updateLastAssistant(taskId, handleStreamUpdate(chunk));
        },
      });
      const cleaned = handleStreamUpdate(acc).trim();
      if (!cleaned) {
        updateLastAssistant(
          taskId,
          "I couldn't read that photo. Please attach it again and ask your question in the same message.",
        );
      }
      transientRetriesRef.current = 0;
      onTurnComplete?.();
    } catch (err) {
      // Reload / navigate mid-stream — never persist "Couldn't reach… network error".
      if (isTransientChatFailure(err) || ac.signal.aborted) {
        const cleaned = stripIncompleteAssistantTail(useStore.getState().getTaskChat(taskId));
        setTaskChat(taskId, cleaned);
        const canRetryLive =
          !ac.signal.aborted &&
          typeof document !== "undefined" &&
          document.visibilityState === "visible" &&
          transientRetriesRef.current < 1 &&
          pendingChatHistoryForResume(cleaned);
        if (canRetryLive) {
          transientRetriesRef.current += 1;
          void callChatRef.current(cleaned);
          return;
        }
        // Out of retries on a live, visible turn. Returning silently here is
        // exactly what made a failed send look like "nothing happens" — no
        // bubble, no retry, and no server log. Staying silent is still correct
        // for an abort/unload, which shouldSurfaceTransientFailure excludes.
        if (shouldSurfaceTransientFailure(ac.signal.aborted)) {
          setTaskChat(taskId, [
            ...cleaned,
            { role: "assistant", content: CHAT_RETRY_EXHAUSTED_MESSAGE, ts: Date.now() },
          ]);
        }
        return;
      }
      updateLastAssistant(taskId, `Couldn't reach the Acharya: ${err instanceof Error ? err.message : "network error"}`);
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      loadingRef.current = false;
      setLoading(false);
    }
  }, [appendTaskMessage, handleStreamUpdate, lang, onTurnComplete, setTaskChat, taskId, updateLastAssistant, workspaceSlug]);

  callChatRef.current = callChat;

  // After reload (or any pending user turn): restart the Acharya reply.
  useEffect(() => {
    resumeKeyRef.current = null;
    transientRetriesRef.current = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tryResume = () => {
      if (cancelled || loadingRef.current) return;
      const pending = pendingChatHistoryForResume(useStore.getState().getTaskChat(taskId));
      if (!pending) return;
      const last = pending[pending.length - 1];
      const key = `${taskId}:${last.ts}:${pending.length}`;
      if (resumeKeyRef.current === key) return;
      resumeKeyRef.current = key;
      setTaskChat(taskId, pending);
      void callChatRef.current(pending);
    };

    const schedule = () => {
      if (cancelled) return;
      tryResume();
      // Hydration / persist can land a tick after mount — retry briefly.
      timer = setTimeout(() => {
        if (!cancelled) tryResume();
      }, 150);
    };

    const unsub = useStore.persist.onFinishHydration(() => schedule());
    if (useStore.persist.hasHydrated()) schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [setTaskChat, taskId]);

  // Also react when persisted messages appear after hydrate (user-last → reply).
  useEffect(() => {
    if (loading) return;
    const pending = pendingChatHistoryForResume(messages);
    if (!pending) return;
    const last = pending[pending.length - 1];
    const key = `${taskId}:${last.ts}:${pending.length}`;
    if (resumeKeyRef.current === key) return;
    resumeKeyRef.current = key;
    void callChatRef.current(pending);
  }, [loading, messages, taskId]);

  /**
   * Upload to OmniDel Blob and post a task note so supervisors see the evidence.
   * Called on Send (not on camera pick) so the chat bubble is not auto-posted.
   */
  async function uploadAndAttach(file: File, caption?: string): Promise<{ url: string; name: string; type: string } | null> {
    // Client-token upload: browser→Blob, so the file never passes through a
    // function body and the 10 MB limit is real. This photo becomes a task
    // note — it is evidence, so it is NOT downscaled.
    let att: { url: string; name: string; type: string };
    try {
      const blob = await uploadViaClientToken(file, "chat");
      att = { url: blob.url, name: blob.name, type: blob.mime };
    } catch (err) {
      alert(err instanceof Error ? err.message : "Photo upload failed. Try again.");
      return null;
    }

    await fetch(`/api/work/tasks/${taskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: caption || `(photo from karigar)`,
        attachments: [{ url: att.url, name: att.name, type: att.type }],
      }),
    }).catch(() => null);

    return att;
  }

  async function handleImagePick(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      alert(`That photo is ${formatMb(file.size)} — the limit is ${MAX_IMAGE_MB} MB.`);
      return;
    }
    // Stage only — do not append a chat bubble until Send.
    // Downscale for the chat turn (data URL in request body); original uploads on Send.
    pendingFileRef.current = file;
    void toVisionDataUrl(file)
      .then((dataUrl) => setPendingImage(dataUrl))
      .catch(() => {
        const reader = new FileReader();
        reader.onload = () => setPendingImage(String(reader.result || ""));
        reader.readAsDataURL(file);
      });
  }

  async function send() {
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;

    setInput("");
    // Collapse the auto-grown textarea back to one line after sending.
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const image = pendingImage ?? undefined;
    const file = pendingFileRef.current;
    setPendingImage(null);
    pendingFileRef.current = null;

    let attachmentUrl: string | undefined;
    if (file) {
      // Keep composer disabled while uploading evidence to OmniDel.
      loadingRef.current = true;
      setLoading(true);
      const result = await uploadAndAttach(file, text || undefined);
      if (result) attachmentUrl = result.url;
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: text || "(photo)",
      image,
      attachmentUrl,
      ts: Date.now(),
    };
    // Claim resume key before append so the hydrate/messages effect does not
    // start a second parallel stream for the same user turn.
    resumeKeyRef.current = `${taskId}:${userMsg.ts}:${messages.length + 1}`;
    loadingRef.current = true;
    appendTaskMessage(taskId, userMsg);

    await callChat([...messages, userMsg]);
  }

  // Imperative handle so the AnamAvatarPanel can forward each voice turn
  // through the same Claude pipeline — Claude sees the karigar's utterance,
  // reasons about it, and (when appropriate) calls propose_status_change so
  // the modal pops up just like in text chat.
  useImperativeHandle(ref, () => ({
    async sendUserMessage(text: string, opts?: { skipAppend?: boolean }) {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      const userMsg: ChatMessage = { role: "user", content: trimmed, ts: Date.now() };
      const nextLen = opts?.skipAppend ? messages.length : messages.length + 1;
      resumeKeyRef.current = `${taskId}:${userMsg.ts}:${nextLen}`;
      loadingRef.current = true;
      if (!opts?.skipAppend) appendTaskMessage(taskId, userMsg);
      await callChat(opts?.skipAppend ? messages : [...messages, userMsg]);
    },
  }), [messages, taskId, loading, appendTaskMessage, callChat]);

  // Hide empty assistant bubble; only loading-dots indicator shows.
  const visibleMessages = messages.filter(
    (m, i) => !(i === messages.length - 1 && m.role === "assistant" && m.content === "")
  );
  const showLoadingDots =
    loading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1].content === "";

  const renderedMessages = visibleMessages;
  const showWelcome = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col min-h-0 flex-1" style={{ height: "100%" }}>
      {/* ── Messages ─────────────────────────────────────────── */}
      {/* `justify-end` anchors messages to the bottom of the scroll area so
          a fresh chat with 2-3 bubbles sits naturally above the composer
          instead of leaving a big empty gap below the last message.
          `mt-auto` on the inner wrapper achieves the same in chains where
          content overflows — the wrapper still scrolls top-to-bottom. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 hide-scrollbar flex flex-col">
        <div className="mt-auto space-y-2.5">
        {showWelcome && (
          <div className="bubble-in">
            <div className="flex justify-start items-end gap-2">
              <AcharyaAvatar
                slug={acharyaSlug}
                name={acharyaName}
                imageUrl={acharyaAvatarUrl}
                initial={acharyaInitial}
                size={28}
                style={{ marginBottom: 2 }}
              />
              <div
                className="max-w-[82%] rounded-md rounded-bl-sm px-4 py-2.5 text-[14px] leading-relaxed bg-surface text-ink border border-line"
                style={{ boxShadow: "var(--shadow-folio)" }}
              >
                {lang === "bn"
                  ? "নমস্কার — নিচে লিখুন বা মাইক ধরে এই কাজ সম্পর্কে জিজ্ঞাসা করুন।"
                  : lang === "hi"
                    ? "नमस्ते — नीचे लिखें या माइक दबाकर इस काम के बारे में पूछें।"
                    : "Namaste — type below or hold the mic to ask about this task."}
              </div>
            </div>
          </div>
        )}
        {renderedMessages.map((m, i) => (
          <div key={i} className="bubble-in">
            <Bubble msg={m} acharyaSlug={acharyaSlug} acharyaName={acharyaName} acharyaInitial={acharyaInitial} acharyaAvatarUrl={acharyaAvatarUrl} />
          </div>
        ))}
        {showLoadingDots && (
          <div className="bubble-in">
            <Bubble msg={LOADING_BUBBLE} acharyaSlug={acharyaSlug} acharyaName={acharyaName} acharyaInitial={acharyaInitial} acharyaAvatarUrl={acharyaAvatarUrl} />
          </div>
        )}
        <div ref={endRef} />
        </div>
      </div>

      {/* ── Image preview chip (staged until Send) ─────────── */}
      {pendingImage && (
        <div className="shrink-0 px-4 pb-2">
          <div className="inline-flex items-center gap-2 bg-parchment border border-line rounded p-2 pr-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage} alt="" className="w-11 h-11 rounded-md object-cover" />
            <span className="text-xs text-charcoal font-medium">Ready to send</span>
            <button
              type="button"
              onClick={() => {
                setPendingImage(null);
                pendingFileRef.current = null;
              }}
              className="ml-1 w-6 h-6 rounded-full hover:bg-line-soft flex items-center justify-center text-muted"
              aria-label="Clear preview"
            >×</button>
          </div>
        </div>
      )}

      {/* ── Composer ─────────────────────────────────────────── */}
      <div
        className="shrink-0 border-t border-line bg-paper px-3 pt-2.5"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
      >
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImagePick(f); e.target.value = ""; }}
        />

        <div className="flex items-end gap-1.5">
          <ToolbarBtn label="Camera" onClick={() => fileRef.current?.click()} icon="cam" />
          {onOpenAvatar && (
            <ToolbarBtn
              label={lang === "bn" ? "অ্যাভাটার" : lang === "hi" ? "अवतार" : "Avatar"}
              onClick={onOpenAvatar}
              icon="avatar"
              disabled={loading}
            />
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-grow: reset to measure, then snap to content height (capped
              // by max-h-32 via CSS). Keeps the field one line until it needs more.
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={lang === "bn" ? "একটা বার্তা লিখো…" : lang === "hi" ? "एक संदेश लिखो…" : "Type a message…"}
            rows={1}
            className="hide-scrollbar flex-1 resize-none rounded px-4 py-2.5 text-sm leading-snug max-h-32 bg-surface border border-line focus:outline-none focus:border-accent text-ink placeholder:text-muted"
          />
          <button
            type="button" onClick={() => void send()}
            disabled={(!input.trim() && !pendingImage) || loading}
            aria-label="Send"
            className="press shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 transition-colors"
            style={{ background: "var(--color-accent)", color: "var(--color-cream)" }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
});

export default AcharyaThread;

function Bubble({
  msg,
  acharyaSlug,
  acharyaName,
  acharyaInitial,
  acharyaAvatarUrl,
}: {
  msg: ChatMessage;
  acharyaSlug?: string;
  acharyaName: string;
  acharyaInitial: string;
  acharyaAvatarUrl?: string;
}) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[82%] rounded-md rounded-br-sm px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--color-accent)", color: "var(--color-cream)" }}
        >
          {(msg.image || msg.attachmentUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.image || blobViewUrl(msg.attachmentUrl)}
              alt=""
              className="rounded-md max-w-full mb-2 max-h-72 object-cover"
            />
          )}
          {msg.content}
        </div>
      </div>
    );
  }
  const isPlaceholder = msg.content === "•••";
  return (
    <div className="flex justify-start items-end gap-2">
      <AcharyaAvatar
        slug={acharyaSlug}
        name={acharyaName}
        imageUrl={acharyaAvatarUrl}
        initial={acharyaInitial}
        size={28}
        style={{ marginBottom: 2 }}
      />
      <div
        className="acharya-md max-w-[82%] rounded-md rounded-bl-sm px-4 py-2.5 text-[14px] leading-relaxed bg-surface text-ink border border-line"
        style={{ boxShadow: "var(--shadow-folio)" }}
      >
        {isPlaceholder ? (
          <span className="typing" aria-label="Acharya is typing">
            <span /><span /><span />
          </span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children, ...rest }) => (
                <a href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>
              ),
              code: ({ className, children, ...rest }) => {
                const isBlock = /\blanguage-/.test(className || "");
                return isBlock
                  ? <pre><code className={className} {...rest}>{children}</code></pre>
                  : <code className={className} {...rest}>{children}</code>;
              },
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({ label, onClick, icon, disabled }: { label: string; onClick: () => void; icon: "cam" | "avatar"; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      aria-label={label} title={label}
      className="press shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-surface border border-line text-ink hover:bg-parchment disabled:opacity-40 transition-colors"
    >
      {icon === "cam" ? <CamIcon /> : <AvatarIcon />}
    </button>
  );
}

function CamIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z"/></svg>;
}
function AvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5 19c1.2-3.1 3.6-4.8 7-4.8s5.8 1.7 7 4.8" />
    </svg>
  );
}
function SendIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}
