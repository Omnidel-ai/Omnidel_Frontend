import { MobileIcon } from "./Icon";
import { VoiceWaveform } from "./VoiceWaveform";
import type { LevelSource } from "./micLevel";

/**
 * Where a voice session is. Both apps reduce their session states to these.
 *
 * Contractor's `minting` / `connecting` / `reminting` and Kaarigar's `busy`
 * are all `connecting`. `speaking` means the agent is talking (the button
 * shows a stop square). `denied` means the browser refused the mic.
 */
export type MicStatus = "idle" | "connecting" | "live" | "speaking" | "error" | "denied";

export interface MicButtonProps {
  status: MicStatus;
  onToggle: () => void;
  /** Accessible name — "Start conversation", "End conversation", … in the reader's language. */
  label: string;
  /** Diameter in px. The dock uses 58–60; inline rows use 40. */
  size?: number;
  /** Visible text beside the glyph turns it into a pill ("Talk now"). */
  text?: string;
  /** Level source for the live meter. Defaults to the app-wide bus. */
  level?: LevelSource;
  /** Disable while connecting. Off by default: the tap that stops a live
   *  session is the same tap that abandons a stuck connect. */
  disableWhileConnecting?: boolean;
}

/**
 * The microphone — the centre of both docks and the inline mic on cards.
 *
 * The colours were already the same in both apps: green at rest, terracotta-red
 * while live, ochre after an error, muted while connecting. Contractor's dock
 * mic (`MicDock`) and Kaarigar's `MahAcharyaInlineMic` / `MahAcharyaDockMic`
 * become this one button. Session logic stays in each app; this only draws the
 * state it is given.
 */
export function MicButton({ status, onToggle, label, size = 60, text, level, disableWhileConnecting = false }: MicButtonProps) {
  const live = status === "live" || status === "speaking";
  return (
    <button
      type="button"
      className={`am-mic am-press${text ? " am-mic--label" : ""}`}
      data-status={status}
      aria-label={label}
      aria-pressed={live}
      title={label}
      disabled={disableWhileConnecting && status === "connecting"}
      onClick={onToggle}
      style={{ height: size, minWidth: size, width: text ? "auto" : size }}
    >
      <MicGlyph status={status} size={size} level={level} />
      {text && <span>{text}</span>}
    </button>
  );
}

function MicGlyph({ status, size, level }: { status: MicStatus; size: number; level?: LevelSource }) {
  const glyph = Math.round(size * 0.44);
  switch (status) {
    case "live":
      return <VoiceWaveform bars={size >= 52 ? 4 : 3} height={Math.round(size * 0.4)} width={size >= 52 ? 3 : 2.5} gap={size >= 52 ? 3 : 2.5} color="var(--cream)" source={level} />;
    case "speaking":
      return (
        <svg width={Math.round(size * 0.38)} height={Math.round(size * 0.38)} viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="2.5" fill="currentColor" />
        </svg>
      );
    case "connecting":
      return <ConnectingDots />;
    case "denied":
      return <MobileIcon name="mic-off" size={glyph} />;
    case "error":
      return <MobileIcon name="retry" size={glyph} />;
    default:
      return <MobileIcon name="mic" size={glyph} />;
  }
}

/** Three pulsing dots — the same 0 / 150 / 300 ms stagger in both apps. */
export function ConnectingDots() {
  return (
    <span className="am-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
