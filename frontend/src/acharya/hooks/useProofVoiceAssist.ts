"use client";

import { useEffect, useRef } from "react";
import { useOptionalAcharyaShell } from "@/components/acharya/shell/AcharyaShell";
import type { VoiceStatus } from "@/acharya/hooks/useGeminiLiveSession";

export type ProofSheetReason = "break" | "expired" | "session" | "subtask" | "complete";

type Options = {
  /** Whether the proof / break / complete sheet is open. */
  open: boolean;
  reason: ProofSheetReason;
  /** Optional task title for the context note spoken to the model. */
  taskTitle?: string | null;
  /** Called when Acharya flips Text / Image on the open sheet. */
  onShowTab: (tab: "text" | "image") => void;
  /** Called when Acharya writes/replaces the sheet's Text field content by voice. */
  onSetText?: (text: string) => void;
  /** Current Text field content, read back to the model so it doesn't re-ask. */
  currentText?: string;
};

export type ProofVoiceAssist = {
  /** True when we can show the sheet mic (inside Acharya shell). */
  available: boolean;
  status: VoiceStatus;
  start: () => Promise<void>;
  end: () => void;
};

function buildProofContextNote(
  reason: ProofSheetReason,
  taskTitle?: string | null,
  currentText?: string,
): string {
  const taskBit = taskTitle?.trim() ? ` Task: "${taskTitle.trim()}".` : "";
  const trimmedCurrent = currentText?.trim();
  const currentBit = trimmedCurrent
    ? ` (current note: "${trimmedCurrent.slice(0, 300)}")`
    : "";
  switch (reason) {
    case "break":
      return `(context: proof sheet open — break. Photos and note are optional.${taskBit} Coach them briefly; they may take a break with no proof. As soon as they describe a note, call set_proof_text to write it (do not wait for them to type). Use show_proof_text_tab / show_proof_image_tab if needed.${currentBit} They must tap Submit themselves — you cannot submit.)`;
    case "expired":
      return `(context: proof sheet open — session timer ended. Both 1–5 photos AND a short note are required.${taskBit} Ask what they accomplished; the moment they answer, call set_proof_text with a short cleaned note so the Text field fills — do not leave them typing. Switch Text/Image tabs as needed.${currentBit} They must tap Submit themselves — you cannot submit.)`;
    case "session":
      return `(context: proof sheet open — session complete update. Both photos and a short note are required.${taskBit} Guide them through what they did this interval. As soon as they describe it, call set_proof_text to write the note. Use show_proof_text_tab / show_proof_image_tab as needed.${currentBit} They must tap Submit themselves.)`;
    case "subtask":
      return `(context: proof sheet open — subtask proof. Photos and note are required.${taskBit} Help them describe and photograph the completed subtask. As soon as they describe it, call set_proof_text to write the note. Use show_proof_text_tab / show_proof_image_tab as needed.${currentBit} They must tap Submit themselves.)`;
    case "complete":
    default:
      return `(context: proof sheet open — mark task done / final proof. Photos and a completion note are required.${taskBit} Ask them to explain what they finished; the moment they answer, call set_proof_text with a short cleaned note so the Text field fills — do not leave them typing. Guide them to add photos. Use show_proof_text_tab / show_proof_image_tab.${currentBit} They must tap "Submit for review" themselves — you cannot submit.)`;
  }
}

function extractProofText(args: Record<string, unknown> | undefined): string {
  if (!args) return "";
  const direct = args.text ?? args.note ?? args.content;
  if (typeof direct === "string") return direct.trim();
  if (direct != null && typeof direct !== "object") return String(direct).trim();
  return "";
}

/**
 * Binds the continuous Acharya Gemini Live session to an open proof sheet:
 * registers Text/Image tab tools, tells the model the sheet opened, and
 * exposes start/end for a mic control on the sheet (header is covered).
 */
export function useProofVoiceAssist(opts: Options): ProofVoiceAssist {
  const shell = useOptionalAcharyaShell();
  const { open, reason, taskTitle, onShowTab, onSetText, currentText } = opts;

  const onShowTabRef = useRef(onShowTab);
  useEffect(() => {
    onShowTabRef.current = onShowTab;
  }, [onShowTab]);

  const onSetTextRef = useRef(onSetText);
  useEffect(() => {
    onSetTextRef.current = onSetText;
  }, [onSetText]);

  const currentTextRef = useRef(currentText);
  useEffect(() => {
    currentTextRef.current = currentText;
  }, [currentText]);

  const shellRef = useRef(shell);
  useEffect(() => {
    shellRef.current = shell;
  }, [shell]);

  const notifiedKeyRef = useRef<string | null>(null);
  const inShell = Boolean(shell);

  // Register proof tab tools while the sheet is open (no re-mint — handlers
  // only). Uses the overlay slot, not setScreenHandlers, so the sheet layers
  // on top of the screen's own tools instead of clobbering them.
  useEffect(() => {
    const s = shellRef.current;
    if (!open || !s) return;

    console.info("[voice-tools] proof overlay handlers registered", { reason });
    s.setOverlayHandlers({
      show_proof_text_tab: async () => {
        onShowTabRef.current("text");
        return { ok: true };
      },
      show_proof_image_tab: async () => {
        onShowTabRef.current("image");
        return { ok: true };
      },
      set_proof_text: async (args) => {
        const text = extractProofText(args);
        console.info("[voice-tools] set_proof_text", { args, textLen: text.length });
        if (!text) return { ok: false, error: "empty_text" };
        onShowTabRef.current("text");
        onSetTextRef.current?.(text);
        return { ok: true, text };
      },
    });

    return () => {
      console.info("[voice-tools] proof overlay handlers cleared", { reason });
      shellRef.current?.setOverlayHandlers(null);
      notifiedKeyRef.current = null;
    };
  }, [open, inShell, reason]);

  const voiceStatus: VoiceStatus = shell?.voiceStatus ?? "idle";

  // When live + sheet open, inject a one-shot context note so Acharya coaches proof.
  useEffect(() => {
    const s = shellRef.current;
    if (!open || !s || voiceStatus !== "live") return;
    const key = `${reason}|${taskTitle ?? ""}`;
    if (notifiedKeyRef.current === key) return;
    notifiedKeyRef.current = key;
    s.notify(buildProofContextNote(reason, taskTitle, currentTextRef.current));
  }, [open, voiceStatus, reason, taskTitle]);

  if (!shell) {
    return {
      available: false,
      status: "idle",
      start: async () => undefined,
      end: () => undefined,
    };
  }

  return {
    available: true,
    status: shell.voiceStatus,
    start: shell.startVoice,
    end: shell.endVoice,
  };
}
