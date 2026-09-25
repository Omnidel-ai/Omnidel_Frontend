"use client";

import type { VoiceStatus } from "@/hooks/useGeminiLiveSession";
import { useStrings } from "@/lib/i18n/useLang";
import { VoiceWaveform } from "@/components/voice/VoiceWaveform";

/**
 * Start/End control for the open-mic voice session. Controlled: the screen
 * passes status + the bound start/end from useVoiceScreenContext.
 *
 * A round mic BUTTON, not a labelled pill. The pill ("Start conversation") was
 * a 180px slab floating over the board — it covered task cards wherever the
 * karigar parked it, and the wording did the job the icon already does. Now:
 * one 60px disc, the same target size as a phone dialler key, with the state
 * carried by colour (green idle → red live) and the live mic meter inside it.
 * The words survive as the accessible name.
 */

type Props = {
  status: VoiceStatus;
  onStart: () => void;
  onEnd: () => void;
  /** Diameter in px. */
  size?: number;
};

const DISC: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  borderRadius: 999,
  cursor: "pointer",
  borderWidth: 1,
  borderStyle: "solid",
  // Always present so status flips never remove borderColor (React warning).
  borderColor: "var(--green-deep)",
  transition: "background 140ms ease, color 140ms ease",
  boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
};

export function VoiceToggle({ status, onStart, onEnd, size = 60 }: Props) {
  const s = useStrings();
  const busy = status === "minting" || status === "connecting" || status === "reminting";
  const live = status === "live";

  const label =
    status === "idle"
      ? s.startConversation
      : status === "live"
        ? s.endConversation
        : status === "error"
          ? s.retry
          : s.connecting;

  const base: React.CSSProperties = { ...DISC, width: size, height: size };
  const style: React.CSSProperties = live
    ? { ...base, background: "var(--crit)", color: "var(--surface)", borderColor: "var(--crit)" }
    : busy
      ? {
          ...base,
          background: "var(--surface-sunk)",
          color: "var(--ink-mute)",
          borderColor: "var(--rule)",
          cursor: "default",
        }
      : status === "error"
        ? { ...base, background: "var(--ochre)", color: "var(--surface)", borderColor: "var(--ochre)" }
        : { ...base, background: "var(--green-deep)", color: "var(--surface)", borderColor: "var(--green-deep)" };

  return (
    <button
      type="button"
      className="press"
      style={style}
      disabled={busy}
      aria-label={label}
      title={label}
      aria-live="polite"
      onClick={live ? onEnd : onStart}
    >
      {live ? (
        // Meet-style meter driven by the real mic level — replaces the pulsing
        // dot, which animated identically whether or not audio was getting in.
        <VoiceWaveform bars={4} height={Math.round(size * 0.34)} width={3} gap={3} color="var(--surface)" />
      ) : busy ? (
        <ConnectingDots />
      ) : status === "error" ? (
        <RetryIcon size={Math.round(size * 0.4)} />
      ) : (
        <MicIcon size={Math.round(size * 0.42)} />
      )}
    </button>
  );
}

function ConnectingDots() {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="mic-pulse"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--ink-mute)",
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </span>
  );
}

function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function RetryIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
