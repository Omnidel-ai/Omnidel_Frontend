"use client";

import { VoiceToggle } from "@/components/voice/VoiceToggle";
import type { VoiceStatus } from "@/hooks/useGeminiLiveSession";

/**
 * Mic control for proof / break / complete sheets. Same Gemini Live session as
 * the Acharya header — start / stop conversation so the karigar can talk while
 * the sheet covers the header mic. Barge-in is handled by the live session.
 */
type Props = {
  available: boolean;
  status: VoiceStatus;
  onStart: () => void;
  onEnd: () => void;
};

export function ProofConversationMic({ available, status, onStart, onEnd }: Props) {
  if (!available) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: 10,
      }}
    >
      {/* Smaller than the board dock — this one shares a sheet with the proof
          form, so it sits beside content rather than floating over it. */}
      <VoiceToggle status={status} onStart={onStart} onEnd={onEnd} size={48} />
    </div>
  );
}
