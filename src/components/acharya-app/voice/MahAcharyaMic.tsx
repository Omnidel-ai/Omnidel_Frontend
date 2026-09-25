"use client";

/**
 * Hosts the MahAcharya voice + chat controls **inline** on a list row. There is
 * no floating dock any more — these buttons are the only entry point.
 *
 * `HomeMahAcharyaGuide` owns the actual Gemini Live session (it must — it lives
 * in `(app)/layout.tsx` so the session survives navigation). It publishes a thin
 * control surface here; `<MahAcharyaInlineMic />` renders buttons wired to it.
 * Two components calling `useVoiceScreenContext` would clobber each other's tool
 * handlers, which is why this is a publish/consume context, not a second session.
 *
 * The provider must wrap BOTH the page tree and the guide — they are siblings in
 * the layout, so the provider sits one level above both.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { VoiceScreenHandle } from "@/components/voice/VoiceSessionProvider";
import { VoiceWaveform } from "@/components/voice/VoiceWaveform";

export interface MahAcharyaMicApi {
  /** Slug of the acharya this mic talks to — the row must match to host it. */
  slug: string;
  status: VoiceScreenHandle["status"];
  live: boolean;
  busy: boolean;
  label: string;
  toggle: () => void;
  /** Opens the text-chat sheet (ends any live session first). */
  openChat: () => void;
  chatOpen: boolean;
  chatLabel: string;
}

interface MicContextValue {
  mic: MahAcharyaMicApi | null;
  publishMic: (mic: MahAcharyaMicApi | null) => void;
}

const MicContext = createContext<MicContextValue | null>(null);

export function MahAcharyaMicProvider({ children }: { children: ReactNode }) {
  const [mic, setMic] = useState<MahAcharyaMicApi | null>(null);

  const value = useMemo<MicContextValue>(() => ({ mic, publishMic: setMic }), [mic]);

  return <MicContext.Provider value={value}>{children}</MicContext.Provider>;
}

export function useMahAcharyaMic(): MicContextValue | null {
  return useContext(MicContext);
}

/**
 * Inline mic button. Renders nothing unless the guide has published a control
 * surface for `slug`, so every other acharya's row stays untouched and the
 * button disappears on screens that own their own voice session.
 *
 * Voice only — the text-chat button that used to sit to its left is gone. On
 * the hero card it read as clutter beside the one control that matters; text
 * chat still lives on MahAcharya'ji's own board (tap the card's name block).
 */
export function MahAcharyaInlineMic({
  slug,
  size = 40,
}: {
  slug: string;
  size?: number;
}) {
  const ctx = useMahAcharyaMic();
  const mic = ctx?.mic ?? null;
  if (!mic || mic.slug !== slug) return null;

  // The host row is a link to the acharya board and handles Enter/Space — stop
  // both so activating a button never also navigates.
  const swallow = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
      onClick={swallow}
      onKeyDown={swallow}
      role="presentation"
    >
      <button
        type="button"
        className="press"
        disabled={mic.busy}
        aria-label={mic.label}
        aria-pressed={mic.live}
        title={mic.label}
        onClick={mic.toggle}
        style={{
          ...inlineMicBtn,
          width: size,
          height: size,
          ...(mic.live
            ? { background: "var(--crit)", borderColor: "var(--crit)", color: "var(--surface)" }
            : mic.status === "error"
              ? { background: "var(--ochre)", borderColor: "var(--ochre)", color: "var(--surface)" }
              : mic.busy
                ? { opacity: 0.55, cursor: "default" as const }
                : null),
        }}
      >
        {mic.live ? (
          // Live meter, not a pulse: it moves with the karigar's own voice, so
          // "is it hearing me?" is answered without them having to ask.
          <VoiceWaveform bars={3} height={Math.round(size * 0.42)} width={2.5} gap={2.5} color="var(--surface)" />
        ) : mic.busy ? (
          <MicConnectingDots />
        ) : (
          <MicGlyph />
        )}
      </button>
    </span>
  );
}

function MicGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicConnectingDots() {
  return (
    <span aria-hidden style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="mic-pulse"
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: "currentColor",
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </span>
  );
}

const inlineMicBtn: CSSProperties = {
  padding: 0,
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "transparent",
  background: "var(--green-deep)",
  color: "var(--surface)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  boxShadow: "var(--shadow-sm)",
};
