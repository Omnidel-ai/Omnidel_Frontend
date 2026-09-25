"use client";

/**
 * Inline Acharya chat for an empty board — same message + composer surface as
 * the task Chat tab / shell sheet, but embedded in the page (no modal).
 */

import { MAX_IMAGE_BYTES, MAX_IMAGE_MB, formatMb, toVisionDataUrl } from "@/lib/image-intake";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import { useStore, type ChatMessage } from "@/lib/store";
import { useLang, useStrings } from "@/lib/i18n/useLang";

const EMPTY: ChatMessage[] = [];

type Props = {
  acharyaSlug: string;
  acharyaName: string;
  acharyaAvatarUrl: string | null;
  /** Workspace slug for /api/work/chat — optional when acharyaSlug is set (server fallback). */
  workspaceSlug?: string;
  /** Optional one-line hint above the thread (e.g. tasks appear when assigned). */
  hint?: string;
  /** Called when the board mounts/unmounts this surface so the shell can skip the popup. */
  onActiveChange?: (active: boolean) => void;
};

export function BoardAcharyaChat({
  acharyaSlug,
  acharyaName,
  acharyaAvatarUrl,
  workspaceSlug = "",
  hint,
  onActiveChange,
}: Props) {
  const s = useStrings();
  const lang = useLang();
  const chatKey = `__acharya:${acharyaSlug}`;

  const messages = useStore((st) => st.chatByTask[chatKey] ?? EMPTY);
  const appendTaskMessage = useStore((st) => st.appendTaskMessage);
  const updateLastAssistant = useStore((st) => st.updateLastAssistant);
  const setTaskChat = useStore((st) => st.setTaskChat);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resumeKeyRef = useRef<string | null>(null);
  const callChatRef = useRef<(msgs: ChatMessage[]) => Promise<void>>(async () => {});
  const transientRetriesRef = useRef(0);
  const loadingRef = useRef(false);
  const initial = acharyaName.trim()[0]?.toUpperCase() || "·";

  useEffect(() => {
    onActiveChange?.(true);
    return () => onActiveChange?.(false);
  }, [onActiveChange]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pendingImage, loading]);

  useEffect(() => {
    const onPageHide = () => {
      abortRef.current?.abort();
      const cur = useStore.getState().getTaskChat(chatKey);
      const cleaned = stripIncompleteAssistantTail(cur);
      if (cleaned.length !== cur.length) setTaskChat(chatKey, cleaned);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [chatKey, setTaskChat]);

  useEffect(() => {
    function onFocusComposer() {
      inputRef.current?.focus();
    }
    window.addEventListener("acharya:focus-board-chat", onFocusComposer);
    return () => window.removeEventListener("acharya:focus-board-chat", onFocusComposer);
  }, []);

  const callChat = useCallback(async (nextMessages: ChatMessage[]) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    loadingRef.current = true;
    setLoading(true);
    appendTaskMessage(chatKey, { role: "assistant", content: "", ts: Date.now() });

    try {
      await streamAcharyaChatReply({
        workspace: workspaceSlug,
        acharyaSlug,
        lang,
        messages: toWireMessages(nextMessages),
        signal: ac.signal,
        onTextUpdate: (acc) => updateLastAssistant(chatKey, acc.trim()),
      });
      transientRetriesRef.current = 0;
    } catch (err) {
      if (isTransientChatFailure(err) || ac.signal.aborted) {
        const cleaned = stripIncompleteAssistantTail(useStore.getState().getTaskChat(chatKey));
        setTaskChat(chatKey, cleaned);
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
          setTaskChat(chatKey, [
            ...cleaned,
            { role: "assistant", content: CHAT_RETRY_EXHAUSTED_MESSAGE, ts: Date.now() },
          ]);
        }
        return;
      }
      updateLastAssistant(
        chatKey,
        `Couldn't reach the Acharya: ${err instanceof Error ? err.message : "network error"}`,
      );
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      loadingRef.current = false;
      setLoading(false);
    }
  }, [acharyaSlug, appendTaskMessage, chatKey, lang, setTaskChat, updateLastAssistant, workspaceSlug]);

  callChatRef.current = callChat;

  useEffect(() => {
    resumeKeyRef.current = null;
    transientRetriesRef.current = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryResume = () => {
      if (cancelled || loadingRef.current) return;
      const pending = pendingChatHistoryForResume(useStore.getState().getTaskChat(chatKey));
      if (!pending) return;
      const last = pending[pending.length - 1];
      const key = `${chatKey}:${last.ts}:${pending.length}`;
      if (resumeKeyRef.current === key) return;
      resumeKeyRef.current = key;
      setTaskChat(chatKey, pending);
      void callChatRef.current(pending);
    };
    const schedule = () => {
      tryResume();
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
  }, [chatKey, setTaskChat]);

  useEffect(() => {
    if (loading) return;
    const pending = pendingChatHistoryForResume(messages);
    if (!pending) return;
    const last = pending[pending.length - 1];
    const key = `${chatKey}:${last.ts}:${pending.length}`;
    if (resumeKeyRef.current === key) return;
    resumeKeyRef.current = key;
    void callChatRef.current(pending);
  }, [chatKey, loading, messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text || "(photo)",
      image: pendingImage ?? undefined,
      ts: Date.now(),
    };
    resumeKeyRef.current = `${chatKey}:${userMsg.ts}:${messages.length + 1}`;
    loadingRef.current = true;
    appendTaskMessage(chatKey, userMsg);
    setInput("");
    setPendingImage(null);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    void callChat([...messages, userMsg]);
  }, [appendTaskMessage, callChat, chatKey, input, loading, messages, pendingImage]);

  const handleImagePick = useCallback((file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      alert(`That photo is ${formatMb(file.size)} — the limit is ${MAX_IMAGE_MB} MB.`);
      return;
    }
    // Downscale before base64: the data URL travels inside the chat request
    // body, and base64 inflates by ~a third, so full-resolution photos used to
    // blow the platform's body cap. The vision model reduces resolution anyway.
    void toVisionDataUrl(file)
      .then((dataUrl) => setPendingImage(dataUrl))
      .catch(() => alert("That photo could not be read. Please try another."));
  }, []);

  const welcome =
    lang === "bn"
      ? `নমস্কার — নিচে লিখুন বা মাইক ধরে ${acharyaName}-এর সাথে কথা বলুন।`
      : lang === "hi"
        ? `नमस्ते — नीचे लिखें या माइक दबाकर ${acharyaName} से बात करें।`
        : `Namaste — type below or hold the mic to talk with ${acharyaName}.`;

  const visibleMessages = messages.filter(
    (m, i) => !(i === messages.length - 1 && m.role === "assistant" && m.content === ""),
  );
  const showLoadingDots =
    loading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1].content === "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        height: "100%",
        background: "var(--page)",
      }}
    >
      {hint ? (
        <p
          style={{
            margin: 0,
            padding: "10px 16px 0",
            fontFamily: "var(--sans)",
            fontSize: 12,
            color: "var(--ink-mute)",
            lineHeight: 1.4,
            flexShrink: 0,
          }}
        >
          {hint}
        </p>
      ) : null}

      <div
        className="hide-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "14px 16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleMessages.length === 0 && !showLoadingDots ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <AcharyaAvatar
                slug={acharyaSlug}
                name={acharyaName}
                imageUrl={acharyaAvatarUrl}
                initial={initial}
                size={28}
              />
              <div style={assistantBubble}>
                <p style={{ margin: "0 0 6px", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 14 }}>
                  {s.askWhatToLearn(acharyaName)}
                </p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "var(--ink-soft)" }}>
                  {welcome}
                </p>
              </div>
            </div>
          ) : (
            visibleMessages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={`${msg.ts}-${msg.role}-${index}`}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "86%",
                    borderRadius: "var(--r-md)",
                    padding: "10px 12px",
                    background: isUser ? "var(--green-wash)" : "var(--surface)",
                    borderWidth: isUser ? 0 : 1,
                    borderStyle: "solid",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  {msg.image || msg.attachmentUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.image || blobViewUrl(msg.attachmentUrl)}
                      alt=""
                      style={{
                        display: "block",
                        width: "100%",
                        maxHeight: 220,
                        objectFit: "cover",
                        borderRadius: 6,
                        marginBottom: msg.content ? 8 : 0,
                      }}
                    />
                  ) : null}
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <div className="acharya-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {showLoadingDots ? (
            <div style={{ alignSelf: "flex-start", maxWidth: "86%", ...assistantBubble }}>
              <span className="typing" aria-label="Acharya is typing">
                <span /><span /><span />
              </span>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      </div>

      {pendingImage ? (
        <div style={{ flexShrink: 0, padding: "8px 12px 0", background: "var(--paper)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--rule)",
              background: "var(--surface)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: "cover" }} />
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Photo ready</span>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              aria-label="Clear photo"
              className="press"
              style={{
                width: 28,
                height: 28,
                border: "none",
                background: "transparent",
                color: "var(--ink-mute)",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          padding: "10px 12px max(env(safe-area-inset-bottom), 10px)",
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: "var(--rule)",
          background: "var(--paper)",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(event) => {
            handleImagePick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Camera"
          className="press"
          style={toolBtn}
          disabled={loading}
        >
          <CameraIcon />
        </button>
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          disabled={loading}
          onChange={(event) => {
            setInput(event.target.value);
            const el = event.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={`Message ${acharyaName}...`}
          style={composerInput}
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || (!input.trim() && !pendingImage)}
          aria-label="Send"
          className="press"
          style={{
            ...sendBtn,
            opacity: loading || (!input.trim() && !pendingImage) ? 0.42 : 1,
          }}
        >
          <SendIcon />
        </button>
      </div>

    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const assistantBubble: CSSProperties = {
  maxWidth: "86%",
  borderRadius: "var(--r-md)",
  padding: "10px 12px",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  color: "var(--ink)",
};

const toolBtn: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  border: "1px solid var(--rule)",
  background: "var(--surface)",
  color: "var(--ink)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  cursor: "pointer",
};

const sendBtn: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  border: "none",
  background: "var(--green-deep)",
  color: "var(--surface)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  cursor: "pointer",
};

const composerInput: CSSProperties = {
  flex: 1,
  minHeight: 42,
  maxHeight: 112,
  resize: "none",
  borderRadius: "var(--r-sm)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  color: "var(--ink)",
  padding: "10px 12px",
  fontFamily: "var(--sans)",
  fontSize: 14,
  lineHeight: 1.35,
  outline: "none",
  overflowY: "auto",
};
