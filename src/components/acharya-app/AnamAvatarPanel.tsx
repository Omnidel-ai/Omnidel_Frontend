"use client";
import { useEffect, useRef, useState } from "react";
import { useAnamAvatar } from "@/hooks/useAnamAvatar";
import { ANAM_INLINE_VIDEO_ELEMENT_ID } from "@/lib/anam-constants";
import { useStore, type Lang } from "@/lib/store";
import AcharyaAvatar from "./acharya-avatar";
import { ghostIconOnMediaStyle } from "@/components/ghost-icon-button";

interface Props {
  workspaceSlug: string;
  taskId: string;
  acharyaSlug?: string;
  acharyaName: string;
  acharyaInitial: string;
  acharyaAvatarUrl?: string;
  lang: Lang;
  openFullscreenOnMount?: boolean;
  /**
   * Called with the karigar's voice text at the end of each turn. The parent
   * forwards this through the Claude chat pipeline so tool-use (e.g.
   * propose_status_change) can fire when the karigar says "done" / "stuck"
   * / "I started" by voice — the avatar itself has no tools.
   */
  onVoiceUserUtterance?: (text: string) => void;
}

const COPY = {
  en: {
    connect: "Connecting…",
    ready: "Listening — speak now",
    speak: " is speaking…",
    start: "Start live avatar",
    stop: "End session",
    live: "LIVE",
    hint: "Tap to talk live · microphone permission required",
    close: "Close",
  },
  hi: {
    connect: "जुड़ रहा है…",
    ready: "बोलो — सुन रहा है",
    speak: " बोल रहा है…",
    start: "लाइव अवतार शुरू",
    stop: "बंद करें",
    live: "लाइव",
    hint: "लाइव बात करने के लिए दबाएँ · माइक की अनुमति दें",
    close: "बंद",
  },
  bn: {
    connect: "যুক্ত হচ্ছে…",
    ready: "বলো — শুনছি",
    speak: " বলছে…",
    start: "লাইভ অ্যাভাটার চালু",
    stop: "শেষ করো",
    live: "লাইভ",
    hint: "লাইভ কথা বলতে চাপো · মাইক্রোফোনের অনুমতি দিন",
    close: "বন্ধ",
  },
} as const;

export default function AnamAvatarPanel({
  workspaceSlug,
  taskId,
  acharyaSlug,
  acharyaName,
  acharyaInitial,
  acharyaAvatarUrl,
  lang,
  openFullscreenOnMount = false,
  onVoiceUserUtterance,
}: Props) {
  const [live, setLive] = useState(false);
  const didAutoOpen = useRef(false);
  const appendTaskMessage = useStore((s) => s.appendTaskMessage);
  const session = useAnamAvatar({
    videoElementId: ANAM_INLINE_VIDEO_ELEMENT_ID,
    workspaceSlug,
    taskId,
    acharyaSlug,
    lang,
    active: live,
    // At each voice turn boundary:
    //   1. Persist BOTH transcripts to chat — this is the primary, lossless
    //      record of the conversation. If the Claude forward below silently
    //      fails, the karigar still sees what they said and what the avatar
    //      replied.
    //   2. Forward the karigar's utterance into the Claude chat pipeline so
    //      tool-use (propose_status_change etc.) can fire. Claude's reply
    //      lands as an additional assistant bubble; we accept the slight
    //      redundancy with the voice transcript in exchange for reliable
    //      modal triggering.
    onTurnEnd: ({ userText, modelText }) => {
      const ts = Date.now();
      if (userText) appendTaskMessage(taskId, { role: "user", content: userText, ts });
      if (modelText) appendTaskMessage(taskId, { role: "assistant", content: modelText, ts: ts + 1 });
      if (userText && onVoiceUserUtterance) onVoiceUserUtterance(userText);
    },
  });
  const c = COPY[lang] || COPY.en;
  const isConnecting = session.state === "connecting";
  const isStreaming = session.state === "ready" || session.state === "speaking";
  const isError = session.state === "error";

  useEffect(() => {
    if (!openFullscreenOnMount || didAutoOpen.current) return;
    didAutoOpen.current = true;
    setLive(true);
  }, [openFullscreenOnMount]);

  const stateLabel = isConnecting
    ? c.connect
    : session.state === "speaking"
    ? `${acharyaName}${c.speak}`
    : isStreaming
    ? c.ready
    : isError
    ? session.error || "Error"
    : c.hint;

  async function endSession() {
    await session.disconnect();
    setLive(false);
  }

  return (
    <>
      {/* ── Inline compact strip (visible above the chat) ─── */}
      <div className="shrink-0 border-b border-line bg-page px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <AcharyaAvatar
              slug={acharyaSlug}
              name={acharyaName}
              imageUrl={acharyaAvatarUrl}
              initial={acharyaInitial}
              size={isStreaming ? 80 : 64}
              shape="rounded"
              style={{ width: "clamp(64px, 20vw, 80px)", height: "clamp(64px, 20vw, 80px)" }}
            />
            {live && (
              <span
                className="absolute top-1 left-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[8px] tracking-[0.18em] uppercase"
                style={{ background: "var(--crit)", color: "var(--surface)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white mic-pulse" />
                {c.live}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-serif italic text-[15px] text-ink leading-tight" style={{ fontWeight: 500 }}>
              {acharyaName}
            </p>
            <p className="text-[11.5px] text-muted leading-snug truncate">{c.hint}</p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setLive(true)}
              className="press px-3 py-1.5 rounded text-xs font-bold"
              style={{ background: "var(--green-deep)", color: "var(--surface)" }}
            >
              {c.start}
            </button>
          </div>
        </div>
      </div>

      {/* ── Full-screen avatar overlay (mounted only when live) ─── */}
      {live && (
        <div
          className="fixed inset-0 z-[55] flex flex-col pt-safe pb-safe fade-in"
          style={{ background: "var(--green-deep)", color: "var(--surface)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Live avatar session"
        >
          {/* Top bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: "var(--color-gold-soft)" }}>
                Live · {acharyaName}
              </p>
              <p className="font-serif italic text-base mt-0.5 truncate" style={{ color: "var(--surface)" }}>
                {stateLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void endSession()}
              aria-label={c.close}
              title={c.close}
              className="press"
              style={ghostIconOnMediaStyle}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Video stage */}
          <div className="flex-1 flex items-center justify-center px-4 min-h-0">
            <div
              className="relative w-full max-w-md aspect-[3/4] sm:aspect-[4/5] rounded-md overflow-hidden"
              style={{ background: "color-mix(in srgb, var(--green-deep) 80%, black)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* Video element — always rendered while live so the Anam hook
                  finds it; placeholder layers on top while connecting/error. */}
              <video
                id={ANAM_INLINE_VIDEO_ELEMENT_ID}
                autoPlay
                playsInline
                muted={false}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {!isStreaming && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  style={{ background: "var(--green-deep)" }}
                >
                  <AcharyaAvatar
                    slug={acharyaSlug}
                    name={acharyaName}
                    imageUrl={acharyaAvatarUrl}
                    initial={acharyaInitial}
                    size={128}
                    decorative
                    style={{ marginBottom: 16, borderWidth: 0, borderStyle: "solid", borderColor: "transparent" }}
                    textStyle={{ fontSize: 72 }}
                  />
                  {isConnecting && (
                    <div className="flex gap-1.5 mb-3" aria-hidden>
                      <span className="w-2 h-2 rounded-full mic-pulse" style={{ background: "var(--color-gold)", animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full mic-pulse" style={{ background: "var(--color-gold)", animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full mic-pulse" style={{ background: "var(--color-gold)", animationDelay: "300ms" }} />
                    </div>
                  )}
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {isConnecting ? c.connect : isError ? "—" : c.ready}
                  </p>
                </div>
              )}

              {/* Streaming indicator pill */}
              {isStreaming && (
                <span
                  className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-mono text-[10px] tracking-[0.18em] uppercase"
                  style={{ background: "var(--crit)", color: "var(--surface)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white mic-pulse" />
                  {c.live}
                </span>
              )}
            </div>
          </div>

          {/* Transcript caption (last user + assistant line) */}
          {(session.userLine || session.assistantLine) && (
            <div className="shrink-0 px-5 pb-2 text-center space-y-1">
              {session.userLine && (
                <p className="text-[12.5px] italic leading-snug" style={{ color: "rgba(255,255,255,0.85)" }}>
                  &ldquo;{session.userLine}&rdquo;
                </p>
              )}
              {session.assistantLine && (
                <p className="text-[12.5px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {session.assistantLine}
                </p>
              )}
            </div>
          )}

          {/* Error banner */}
          {isError && session.error && (
            <div className="shrink-0 px-5 pb-3 text-center">
              <p className="text-[12.5px] leading-snug" style={{ color: "var(--color-gold-soft)" }}>
                {session.error}
              </p>
            </div>
          )}

          {/* End session — full-width primary action */}
          <div className="shrink-0 px-5 pb-3">
            <button
              type="button"
              onClick={() => void endSession()}
              className="press w-full px-4 py-3 rounded text-sm font-bold transition-colors"
              style={{ background: "var(--surface)", color: "var(--green-deep)" }}
            >
              {c.stop}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>;
}
