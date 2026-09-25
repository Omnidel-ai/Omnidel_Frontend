"use client";

/**
 * The in-app picture-in-picture card for a live conversation.
 *
 * Not to be confused with `AcharyaPip`, which asks the BROWSER for a real
 * always-on-top window when the karigar leaves the tab. That one is unsupported
 * on Chrome for Android — the browser this app is actually used in — so on a
 * karigar's phone it renders nothing. This is the in-page version, and it is the
 * one they will see.
 *
 * It does two jobs the live-transcript strip it replaces could not:
 *
 *  1. It says the acharya is HERE. A line of scrolling transcript is the
 *     machinery of the conversation, not the presence of a mentor; a face is.
 *  2. It gives the karigar a way OUT. With the stage minimised on home there was
 *     no stop control anywhere on screen — the session kept running with the
 *     only evidence being text ticking past.
 *
 * Whole card ends the conversation, with the stop glyph carrying the meaning.
 * One target rather than a card that navigates and a small button that stops:
 * this sits under a thumb, over content, and a mis-tap that opens a screen
 * during a live call is worse than a mis-tap that ends one the karigar can
 * restart with the mic.
 *
 * It is drawn to be dragged — the caller wraps it in `DraggableDock`, which
 * owns the position and persists it per surface.
 */

import type { CSSProperties } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import TavusVideoTile from "@/components/voice/TavusVideoTile";
import { VoiceWaveform } from "@/components/voice/VoiceWaveform";
import { useStrings } from "@/lib/i18n/useLang";

const NIGHT = "#14110c";
const CREAM = "#f4efdf";

export function LiveAcharyaPip({
  slug,
  name,
  avatarUrl,
  onEnd,
  videoTrack = null,
  busy = false,
  width = 78,
}: {
  slug: string;
  name: string;
  avatarUrl: string | null;
  onEnd: () => void;
  /**
   * Live Tavus video. When present the card shows the SAME feed as the header —
   * the acharya who is actually speaking — rather than a still of them. A
   * portrait beside a live video of the same person reads as two acharyas.
   */
  videoTrack?: MediaStreamTrack | null;
  /** Connecting: the card is up but there is nothing to end yet. */
  busy?: boolean;
  /** Card width in px; height follows the 4:5 portrait ratio. */
  width?: number;
}) {
  const s = useStrings();
  const height = Math.round((width * 5) / 4);

  return (
    <button
      type="button"
      className="press"
      onClick={busy ? undefined : onEnd}
      disabled={busy}
      aria-label={s.endConversationWith(name)}
      title={s.endConversationWith(name)}
      style={{ ...card, width, height, opacity: busy ? 0.7 : 1 }}
    >
      {videoTrack ? (
        <TavusVideoTile track={videoTrack} objectPosition="center 22%" />
      ) : (
        <AcharyaAvatar
          slug={slug}
          name={name}
          imageUrl={avatarUrl}
          size={160}
          shape="rounded"
          style={frame}
          imageStyle={image}
          textStyle={initial}
        />
      )}

      {/* Scrim only across the bottom band, so the face stays readable at this
          size while the meter and glyph below it keep their contrast. */}
      <span style={footerScrim} aria-hidden />

      {/* The meter is driven by the real mic level, so a silent room looks
          silent — this is the same signal the mic disc shows when live, and it
          is what tells the karigar the acharya is still listening. */}
      <span style={meterRow} aria-hidden>
        <VoiceWaveform bars={4} height={12} width={2} gap={2} color={CREAM} />
      </span>

      {/* Stop, top-right, over its own disc so it reads on any portrait. */}
      <span style={stopBadge} aria-hidden>
        <StopIcon />
      </span>

      {/* A live ring rather than a blinking dot: it does not animate, so it
          costs nothing on a low-end phone and still separates "in a
          conversation" from "a photo parked on the screen". */}
      <span style={liveRing} aria-hidden />
    </button>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

const card: CSSProperties = {
  position: "relative",
  padding: 0,
  border: "none",
  borderRadius: 16,
  overflow: "hidden",
  background: NIGHT,
  cursor: "pointer",
  display: "block",
  // Reads as a floating window over whatever it covers, the way a PiP should.
  boxShadow: "0 10px 28px rgba(0,0,0,0.34)",
  WebkitTapHighlightColor: "transparent",
};

const frame: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: 16,
  borderWidth: 0,
  background: NIGHT,
  display: "block",
};

const image: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  // Same high crop the reels use — faces sit high in these portraits.
  objectPosition: "center 22%",
  display: "block",
};

const initial: CSSProperties = {
  fontSize: 30,
  color: `color-mix(in srgb, ${CREAM} 80%, transparent)`,
};

const footerScrim: CSSProperties = {
  position: "absolute",
  insetInline: 0,
  bottom: 0,
  height: "42%",
  pointerEvents: "none",
  background: `linear-gradient(to top, color-mix(in srgb, ${NIGHT} 88%, transparent) 0%, transparent 100%)`,
};

const meterRow: CSSProperties = {
  position: "absolute",
  insetInline: 0,
  bottom: 7,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
};

const stopBadge: CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 20,
  height: 20,
  borderRadius: 999,
  background: "var(--crit)",
  color: CREAM,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
};

const liveRing: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 16,
  pointerEvents: "none",
  borderWidth: 2,
  borderStyle: "solid",
  borderColor: "var(--crit)",
};
