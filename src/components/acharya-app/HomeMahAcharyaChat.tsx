"use client";

/**
 * Home-screen MahAcharya text chat — same composer surface as BoardAcharyaChat,
 * plus <<NAV|…>> sentinel parsing that drives app navigation (profile / settings
 * / MSME requests / open Acharya / home). Voice mic lives in HomeMahAcharyaGuide
 * (separate from this sheet — mic must not open chat).
 */

import { MAX_IMAGE_BYTES, MAX_IMAGE_MB, formatMb, toVisionDataUrl } from "@/lib/image-intake";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ghostIconButtonStyle } from "@/components/ghost-icon-button";
import { useInstantNav } from "@/components/instant-nav";
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
import {
  normalizeProfileTab,
  normalizeSettingsSection,
  profileHref,
  settingsHref,
  type ProfileVoiceTab,
  type SettingsVoiceSection,
} from "@/lib/voice-nav-targets";

const EMPTY: ChatMessage[] = [];
const CHAT_KEY = "__acharya:mahacharya";

/**
 * Nav sentinels. The optional third segment is the screen-grouped argument:
 * `<<NAV|open_profile|requests>>`, `<<NAV|open_settings|language>>`,
 * `<<NAV|open_acharya|slug>>`. `open_msme_requests` is retired in favour of
 * `open_profile|requests`, but stays matchable so a reply already streaming
 * when this shipped still navigates instead of leaking a sentinel into a bubble.
 */
const NAV_RX = /<<NAV\|(open_profile|open_settings|open_msme_requests|go_home|open_acharya)(?:\|([^>\s]+))?>>/g;

export type HomeNavAction =
  | { type: "open_profile"; tab: ProfileVoiceTab | null }
  | { type: "open_settings"; section: SettingsVoiceSection | null }
  | { type: "go_home" }
  | { type: "open_acharya"; slug: string };

type Props = {
  open: boolean;
  onClose: () => void;
  acharyaName: string;
  acharyaAvatarUrl: string | null;
  availableAcharyas: Array<{ slug: string; displayName: string }>;
};

function extractNav(text: string): { stripped: string; actions: HomeNavAction[] } {
  const actions: HomeNavAction[] = [];
  const stripped = text
    .replace(NAV_RX, (_full, kind: string, arg?: string) => {
      if (kind === "open_acharya") {
        const s = (arg || "").trim().toLowerCase();
        if (s) actions.push({ type: "open_acharya", slug: s });
      } else if (kind === "open_profile") {
        actions.push({ type: "open_profile", tab: normalizeProfileTab(arg) });
      } else if (kind === "open_msme_requests") {
        // Retired tool, still honoured: it always meant the Requests tab.
        actions.push({ type: "open_profile", tab: "requests" });
      } else if (kind === "open_settings") {
        actions.push({ type: "open_settings", section: normalizeSettingsSection(arg) });
      } else if (kind === "go_home") {
        actions.push({ type: "go_home" });
      }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { stripped, actions };
}

export function HomeMahAcharyaChat({
  open,
  onClose,
  acharyaName,
  acharyaAvatarUrl,
  availableAcharyas,
}: Props) {
  const nav = useInstantNav();
  const s = useStrings();
  const lang = useLang();
  const messages = useStore((st) => st.chatByTask[CHAT_KEY] ?? EMPTY);
  const appendTaskMessage = useStore((st) => st.appendTaskMessage);
  const updateLastAssistant = useStore((st) => st.updateLastAssistant);
  const setTaskChat = useStore((st) => st.setTaskChat);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const announcedNav = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const resumeKeyRef = useRef<string | null>(null);
  const callChatRef = useRef<(msgs: ChatMessage[]) => Promise<void>>(async () => {});
  const transientRetriesRef = useRef(0);
  const loadingRef = useRef(false);
  const initial = acharyaName.trim()[0]?.toUpperCase() || "M";

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pendingImage, loading, open]);

  useEffect(() => {
    const onPageHide = () => {
      abortRef.current?.abort();
      const cur = useStore.getState().getTaskChat(CHAT_KEY);
      const cleaned = stripIncompleteAssistantTail(cur);
      if (cleaned.length !== cur.length) setTaskChat(CHAT_KEY, cleaned);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [setTaskChat]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open]);

  const runNav = useCallback(
    (action: HomeNavAction) => {
      onClose();
      switch (action.type) {
        // `replaceQuery` for these two: within Profile or Settings only the query
        // changes, and a push repainted a screen that was already correct — the
        // flicker PR #152's QA logged against the voice side of the same targets.
        // Falls through to a real push when the screen itself differs.
        case "open_profile":
          nav.replaceQuery(profileHref(action.tab));
          break;
        case "open_settings":
          nav.replaceQuery(settingsHref(action.section));
          break;
        case "open_acharya":
          nav.push(`/acharyas/${action.slug}`);
          break;
        case "go_home":
          nav.push("/acharyas");
          break;
      }
    },
    [onClose, nav],
  );

  const handleStreamUpdate = useCallback(
    (rawAcc: string): string => {
      const { stripped, actions } = extractNav(rawAcc);
      for (const action of actions) {
        // The argument is part of the key: "open my report" then "and my
        // history" in one reply are two different destinations, and a bare
        // `action.type` key would swallow the second.
        const key =
          action.type === "open_acharya"
            ? `open_acharya|${action.slug}`
            : action.type === "open_profile"
              ? `open_profile|${action.tab ?? ""}`
              : action.type === "open_settings"
                ? `open_settings|${action.section ?? ""}`
                : action.type;
        if (announcedNav.current.has(key)) continue;
        announcedNav.current.add(key);
        // Defer so the stripped bubble paints before route change.
        window.setTimeout(() => runNav(action), 120);
      }
      return stripped;
    },
    [runNav],
  );

  const callChat = useCallback(
    async (nextMessages: ChatMessage[]) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      loadingRef.current = true;
      setLoading(true);
      appendTaskMessage(CHAT_KEY, { role: "assistant", content: "", ts: Date.now() });

      try {
        await streamAcharyaChatReply({
          acharyaSlug: "mahacharya",
          mode: "home_nav",
          availableAcharyas,
          lang,
          messages: toWireMessages(nextMessages),
          signal: ac.signal,
          onTextUpdate: (acc) => updateLastAssistant(CHAT_KEY, handleStreamUpdate(acc)),
        });
        transientRetriesRef.current = 0;
      } catch (err) {
        if (isTransientChatFailure(err) || ac.signal.aborted) {
          const cleaned = stripIncompleteAssistantTail(useStore.getState().getTaskChat(CHAT_KEY));
          setTaskChat(CHAT_KEY, cleaned);
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
            setTaskChat(CHAT_KEY, [
              ...cleaned,
              { role: "assistant", content: CHAT_RETRY_EXHAUSTED_MESSAGE, ts: Date.now() },
            ]);
          }
          return;
        }
        updateLastAssistant(
          CHAT_KEY,
          `Couldn't reach MahAcharya'ji: ${err instanceof Error ? err.message : "network error"}`,
        );
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [appendTaskMessage, availableAcharyas, handleStreamUpdate, lang, setTaskChat, updateLastAssistant],
  );

  callChatRef.current = callChat;

  useEffect(() => {
    if (!open) {
      resumeKeyRef.current = null;
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryResume = () => {
      if (cancelled || loadingRef.current) return;
      const pending = pendingChatHistoryForResume(useStore.getState().getTaskChat(CHAT_KEY));
      if (!pending) return;
      const last = pending[pending.length - 1];
      const key = `${CHAT_KEY}:${last.ts}:${pending.length}`;
      if (resumeKeyRef.current === key) return;
      resumeKeyRef.current = key;
      setTaskChat(CHAT_KEY, pending);
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
  }, [open, setTaskChat]);

  useEffect(() => {
    if (!open || loading) return;
    const pending = pendingChatHistoryForResume(messages);
    if (!pending) return;
    const last = pending[pending.length - 1];
    const key = `${CHAT_KEY}:${last.ts}:${pending.length}`;
    if (resumeKeyRef.current === key) return;
    resumeKeyRef.current = key;
    void callChatRef.current(pending);
  }, [loading, messages, open]);

  const send = useCallback(() => {
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text || "(photo)",
      image: pendingImage ?? undefined,
      ts: Date.now(),
    };
    resumeKeyRef.current = `${CHAT_KEY}:${userMsg.ts}:${messages.length + 1}`;
    loadingRef.current = true;
    appendTaskMessage(CHAT_KEY, userMsg);
    setInput("");
    setPendingImage(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    void callChat([...messages, userMsg]);
  }, [appendTaskMessage, callChat, input, loading, messages, pendingImage]);

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

  if (!open) return null;

  const welcome =
    lang === "bn"
      ? "আমি আপনাকে প্রোফাইল, সেটিংস, MSME অনুরোধ, বা কোনো আচার্যের বোর্ডে নিয়ে যেতে পারি — বলুন কোথায় যেতে চান।"
      : lang === "hi"
        ? "मैं आपको प्रोफ़ाइल, सेटिंग्स, MSME अनुरोध, या किसी आचार्य के बोर्ड पर ले जा सकता हूँ — बताएँ कहाँ जाना है।"
        : "I can take you to Profile, Settings, MSME Requests, or an Acharya board — say where you'd like to go.";

  const visibleMessages = messages.filter(
    (m, i) => !(i === messages.length - 1 && m.role === "assistant" && m.content === ""),
  );
  const showLoadingDots =
    loading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={s.chatWith(acharyaName)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: "color-mix(in srgb, var(--ink) 35%, transparent)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "calc(100dvh - 72px)",
          minHeight: 380,
          display: "flex",
          flexDirection: "column",
          borderTopLeftRadius: "var(--r-md)",
          borderTopRightRadius: "var(--r-md)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "var(--rule)",
          background: "var(--page)",
          boxShadow: "0 -16px 48px color-mix(in srgb, var(--ink) 18%, transparent)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 16px",
            borderBottomWidth: 1,
            borderBottomStyle: "solid",
            borderBottomColor: "var(--rule)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--surface)",
            flexShrink: 0,
          }}
        >
          <AcharyaAvatar
            slug="mahacharya"
            name={acharyaName}
            imageUrl={acharyaAvatarUrl}
            initial={initial}
            size={36}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--green-deep)",
              }}
            >
              {s.homeMahAcharyaEyebrow}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 16,
                fontWeight: 500,
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {acharyaName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close chat"
            onClick={onClose}
            className="press"
            style={{ ...ghostIconButtonStyle, width: 36, height: 36, color: "var(--ink)" }}
          >
            <CloseIcon />
          </button>
        </div>

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
                  slug="mahacharya"
                  name={acharyaName}
                  imageUrl={acharyaAvatarUrl}
                  initial={initial}
                  size={28}
                />
                <div style={assistantBubble}>
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 14,
                    }}
                  >
                    {s.homeMahAcharyaWelcome(acharyaName)}
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
                  <span />
                  <span />
                  <span />
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
              <img
                src={pendingImage}
                alt=""
                style={{ width: 42, height: 42, borderRadius: 6, objectFit: "cover" }}
              />
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
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
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
